"""
Targeted coverage for PATCH /v1/super-admin/model-pricing/{id} - specifically that it
rejects, BEFORE writing anything, any edit that would erode the platform's guaranteed
margin (see credit_engine.assert_meets_minimum_margin) or set a non-positive Anthropic
rate. The math itself is covered by test_credit_engine.py's TestMinimumMarginGuardrail;
this file only covers that the route actually wires that guardrail in and never partially
applies a rejected update.
"""

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routes import super_admin as super_admin_module
from tests.conftest import make_fake_db


def _make_client(db) -> TestClient:
    app = FastAPI()
    app.include_router(super_admin_module.router)
    app.dependency_overrides[get_current_user] = lambda: {"role": "super_admin"}
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def test_markup_below_minimum_is_rejected_and_never_written():
    model_pricing = AsyncMock()
    db = make_fake_db(model_pricing=model_pricing)
    client = _make_client(db)

    resp = client.patch("/v1/super-admin/model-pricing/claude-sonnet-5-standard", json={"markup_multiplier": 1.0})

    assert resp.status_code == 400
    assert "guaranteed minimum" in resp.json()["detail"]
    model_pricing.find_one_and_update.assert_not_called()


def test_markup_at_exactly_the_minimum_is_accepted():
    model_pricing = AsyncMock()
    model_pricing.find_one_and_update.return_value = {
        "_id": "claude-sonnet-5-standard",
        "model_id": "claude-sonnet-5",
        "anthropic_input_per_m": 3.0,
        "anthropic_output_per_m": 15.0,
        "markup_multiplier": 1.0 / 0.60,
        "is_active": True,
    }
    db = make_fake_db(model_pricing=model_pricing)
    client = _make_client(db)

    resp = client.patch(
        "/v1/super-admin/model-pricing/claude-sonnet-5-standard",
        json={"markup_multiplier": 1.0 / 0.60},
    )

    assert resp.status_code == 200
    model_pricing.find_one_and_update.assert_called_once()


def test_zero_anthropic_input_rate_is_rejected():
    model_pricing = AsyncMock()
    db = make_fake_db(model_pricing=model_pricing)
    client = _make_client(db)

    resp = client.patch(
        "/v1/super-admin/model-pricing/claude-sonnet-5-standard",
        json={"anthropic_input_per_m": 0},
    )

    assert resp.status_code == 400
    assert "anthropic_input_per_m" in resp.json()["detail"]
    model_pricing.find_one_and_update.assert_not_called()


def test_negative_anthropic_output_rate_is_rejected():
    model_pricing = AsyncMock()
    db = make_fake_db(model_pricing=model_pricing)
    client = _make_client(db)

    resp = client.patch(
        "/v1/super-admin/model-pricing/claude-sonnet-5-standard",
        json={"anthropic_output_per_m": -5},
    )

    assert resp.status_code == 400
    assert "anthropic_output_per_m" in resp.json()["detail"]
    model_pricing.find_one_and_update.assert_not_called()


def test_updating_is_active_alone_does_not_require_margin_fields():
    """Flipping a tier's activation (see scripts/flip_sonnet_rate.py) must not be blocked
    by margin validation - it doesn't touch pricing at all."""
    model_pricing = AsyncMock()
    model_pricing.find_one_and_update.return_value = {
        "_id": "claude-sonnet-5-standard",
        "model_id": "claude-sonnet-5",
        "anthropic_input_per_m": 3.0,
        "anthropic_output_per_m": 15.0,
        "markup_multiplier": 1.0 / 0.60,
        "is_active": True,
    }
    db = make_fake_db(model_pricing=model_pricing)
    client = _make_client(db)

    resp = client.patch("/v1/super-admin/model-pricing/claude-sonnet-5-standard", json={"is_active": True})

    assert resp.status_code == 200
