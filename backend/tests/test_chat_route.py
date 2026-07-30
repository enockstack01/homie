"""
Targeted coverage for routes/chat.py's handle_chat_request - specifically the guard
clauses that run BEFORE the real Anthropic call, since that's what the margin-leak fix in
credit_engine.plan_request_budget (see docs/BLUEPRINT.md Section 5) depends on actually
being reached. count_input_tokens/create_message are patched out (live Anthropic calls);
the transactional deduct-and-log success path itself is covered by
test_credit_engine.py's budget math plus test_credit_transfer.py's same
find_one_and_update-in-a-transaction pattern, so it isn't re-verified end-to-end here.
"""

from unittest.mock import AsyncMock, patch

from bson import Decimal128, ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routes import chat as chat_module
from tests.conftest import make_fake_db

REQUEST_BODY = {"messages": [{"role": "user", "content": "hi"}]}


def _make_client(user: dict, db) -> TestClient:
    app = FastAPI()
    app.include_router(chat_module.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _user(**overrides) -> dict:
    base = {
        "_id": ObjectId(),
        "status": "active",
        "credit_balance": Decimal128("1000.0"),
        "preferred_model_id": "claude-sonnet-5",
    }
    base.update(overrides)
    return base


def _pricing_doc(**overrides) -> dict:
    base = {
        "model_id": "claude-sonnet-5",
        "display_name": "Claude Sonnet 5",
        "anthropic_input_per_m": 3.00,
        "anthropic_output_per_m": 15.00,
        "markup_multiplier": 1.0 / 0.60,
        "is_active": True,
    }
    base.update(overrides)
    return base


def test_non_active_account_is_rejected_before_touching_balance():
    user = _user(status="pending")
    db = make_fake_db(users=AsyncMock(), model_pricing=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/chat", json=REQUEST_BODY)

    assert resp.status_code == 403
    assert "not active" in resp.json()["detail"]


def test_zero_balance_is_rejected_before_selecting_a_model():
    user = _user(credit_balance=Decimal128("0"))
    db = make_fake_db(users=AsyncMock(), model_pricing=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/chat", json=REQUEST_BODY)

    assert resp.status_code == 402
    assert "Insufficient credit balance" in resp.json()["detail"]


def test_no_model_selected_is_rejected():
    user = _user(preferred_model_id=None)
    db = make_fake_db(users=AsyncMock(), model_pricing=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/chat", json=REQUEST_BODY)

    assert resp.status_code == 400
    assert "No model selected" in resp.json()["detail"]


def test_retired_model_selection_is_rejected():
    user = _user()
    model_pricing = AsyncMock()
    model_pricing.find_one.return_value = None  # not found among is_active docs
    db = make_fake_db(users=AsyncMock(), model_pricing=model_pricing)
    client = _make_client(user, db)

    resp = client.post("/v1/chat", json=REQUEST_BODY)

    assert resp.status_code == 400
    assert "no longer available" in resp.json()["detail"]


def test_request_that_cant_afford_minimum_output_is_rejected_before_calling_anthropic():
    """The core margin-leak-fix behavior: a request whose input cost alone would leave
    less than DEFAULT_MIN_OUTPUT_TOKENS of headroom must 402 out WITHOUT ever reaching
    create_message."""
    user = _user(credit_balance=Decimal128("0.001"))  # affordable input, ~nothing left
    model_pricing = AsyncMock()
    model_pricing.find_one.return_value = _pricing_doc()
    db = make_fake_db(users=AsyncMock(), model_pricing=model_pricing)
    client = _make_client(user, db)

    with (
        patch.object(chat_module, "count_input_tokens", AsyncMock(return_value=100)),
        patch.object(chat_module, "create_message", AsyncMock()) as create_message,
    ):
        resp = client.post("/v1/chat", json=REQUEST_BODY)

    assert resp.status_code == 402
    assert "Insufficient credit balance for this request" in resp.json()["detail"]
    create_message.assert_not_called()
