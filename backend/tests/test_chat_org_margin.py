"""
Targeted coverage for routes/chat.py's organization-margin billing layer (see
credit_engine.apply_organization_margin and organizations.profit_margin_percent) - a
member's actual balance deduction, their organization's own pool credit-back, and the
pre-flight affordability check, once an organization has set a nonzero margin.

count_input_tokens/create_message are patched out (live Anthropic calls); Homie's own
charge math itself (compute_final_charge/plan_request_budget) is covered by
test_credit_engine.py and treated here as a trusted oracle, same as test_chat_route.py.
"""

from unittest.mock import AsyncMock, MagicMock, patch

from bson import Decimal128, ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routes import chat as chat_module
from app.services import credit_engine
from tests.conftest import make_fake_db

REQUEST_BODY = {"messages": [{"role": "user", "content": "hi"}]}
INPUT_TOKENS = 100
OUTPUT_TOKENS = 100


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


def _fake_anthropic_response(input_tokens=INPUT_TOKENS, output_tokens=OUTPUT_TOKENS):
    response = MagicMock()
    response.usage.input_tokens = input_tokens
    response.usage.output_tokens = output_tokens
    response.model_dump.return_value = {"fake": "message"}
    return response


def _run_chat(user: dict, db):
    with (
        patch.object(chat_module, "count_input_tokens", AsyncMock(return_value=INPUT_TOKENS)),
        patch.object(chat_module, "create_message", AsyncMock(return_value=_fake_anthropic_response())),
    ):
        return _make_client(user, db).post("/v1/chat", json=REQUEST_BODY)


def test_member_with_no_organization_pays_exactly_homies_price():
    """No organization_id at all - db.organizations is never even touched, and the
    member's deduction equals Homie's own compute_final_charge, unchanged from before
    organization margins existed."""
    user = _user()
    pricing = _pricing_doc()
    model_pricing = AsyncMock()
    model_pricing.find_one.return_value = pricing
    users = AsyncMock()
    users.find_one_and_update.return_value = {"credit_balance": Decimal128("500.0")}
    usage_logs = AsyncMock()
    organizations = AsyncMock()
    db = make_fake_db(users=users, model_pricing=model_pricing, usage_logs=usage_logs, organizations=organizations)

    resp = _run_chat(user, db)

    assert resp.status_code == 200
    organizations.find_one.assert_not_called()
    organizations.update_one.assert_not_called()

    expected = credit_engine.compute_final_charge(
        input_tokens=INPUT_TOKENS,
        output_tokens=OUTPUT_TOKENS,
        anthropic_input_per_m=pricing["anthropic_input_per_m"],
        anthropic_output_per_m=pricing["anthropic_output_per_m"],
        markup_multiplier=pricing["markup_multiplier"],
    )
    logged = usage_logs.insert_one.call_args.args[0]
    assert abs(float(logged["credits_deducted"].to_decimal()) - expected.credits_to_deduct) < 1e-9
    assert float(logged["org_margin_credits"].to_decimal()) == 0.0
    assert resp.json()["deducted_credits"] == round(expected.credits_to_deduct, 2)


def test_org_member_is_charged_the_margin_and_the_org_pool_is_credited_back():
    """A 25% organization margin: the member pays Homie's own price plus 25% on top, and
    that extra amount (not the member's whole payment) is credited into the
    organization's own pool - a closed loop, not new money from anywhere."""
    org_id = ObjectId()
    user = _user(organization_id=org_id)
    pricing = _pricing_doc()
    model_pricing = AsyncMock()
    model_pricing.find_one.return_value = pricing
    users = AsyncMock()
    users.find_one_and_update.return_value = {"credit_balance": Decimal128("500.0")}
    usage_logs = AsyncMock()
    organizations = AsyncMock()
    organizations.find_one.return_value = {"_id": org_id, "profit_margin_percent": 25.0}
    db = make_fake_db(users=users, model_pricing=model_pricing, usage_logs=usage_logs, organizations=organizations)

    resp = _run_chat(user, db)

    assert resp.status_code == 200
    homies_charge = credit_engine.compute_final_charge(
        input_tokens=INPUT_TOKENS,
        output_tokens=OUTPUT_TOKENS,
        anthropic_input_per_m=pricing["anthropic_input_per_m"],
        anthropic_output_per_m=pricing["anthropic_output_per_m"],
        markup_multiplier=pricing["markup_multiplier"],
    )
    homies_price = homies_charge.credits_to_deduct
    expected_member_deduction = credit_engine.apply_organization_margin(homies_price, 25.0)
    expected_org_credit = expected_member_deduction - homies_price

    # What actually left the member's balance.
    deduct_call = users.find_one_and_update.call_args
    deducted = -float(deduct_call.args[1]["$inc"]["credit_balance"].to_decimal())
    assert abs(deducted - expected_member_deduction) < 1e-9

    # What the organization's own pool was credited back.
    org_call = organizations.update_one.call_args
    assert org_call.args[0] == {"_id": org_id}
    org_credited = float(org_call.args[1]["$inc"]["credit_balance"].to_decimal())
    assert abs(org_credited - expected_org_credit) < 1e-9

    logged = usage_logs.insert_one.call_args.args[0]
    assert abs(float(logged["credits_deducted"].to_decimal()) - expected_member_deduction) < 1e-9
    assert abs(float(logged["org_margin_credits"].to_decimal()) - expected_org_credit) < 1e-9
    # Homie's own price-tracking fields must stay at Homie's true price, unaffected by
    # the organization's own separate markup on top of it.
    assert abs(float(logged["raw_api_cost_usd"].to_decimal()) - homies_charge.raw_cost_usd) < 1e-9
    assert abs(float(logged["user_billed_usd"].to_decimal()) - homies_charge.billed_usd) < 1e-9
    assert resp.json()["deducted_credits"] == round(expected_member_deduction, 2)


def test_org_member_with_zero_margin_behaves_identically_to_no_organization():
    """An organization that's never set a margin (or explicitly set 0%) must not touch
    its own pool at all - 0% margin is indistinguishable from having none."""
    org_id = ObjectId()
    user = _user(organization_id=org_id)
    pricing = _pricing_doc()
    model_pricing = AsyncMock()
    model_pricing.find_one.return_value = pricing
    users = AsyncMock()
    users.find_one_and_update.return_value = {"credit_balance": Decimal128("500.0")}
    usage_logs = AsyncMock()
    organizations = AsyncMock()
    organizations.find_one.return_value = {"_id": org_id, "profit_margin_percent": 0.0}
    db = make_fake_db(users=users, model_pricing=model_pricing, usage_logs=usage_logs, organizations=organizations)

    resp = _run_chat(user, db)

    assert resp.status_code == 200
    organizations.update_one.assert_not_called()
    logged = usage_logs.insert_one.call_args.args[0]
    assert float(logged["org_margin_credits"].to_decimal()) == 0.0


def test_org_margin_inflates_the_preflight_affordability_check():
    """A balance that comfortably affords the minimum output at Homie's own price must
    still 402 once a 100% organization margin doubles the member-facing rate past what
    that same balance can actually cover - the pre-flight check has to use the
    member-facing rate, not just Homie's own price underneath it."""
    pricing = _pricing_doc()
    org_id = ObjectId()

    def cost_to_cover(multiplier: float) -> float:
        budget = credit_engine.plan_request_budget(
            input_tokens=INPUT_TOKENS,
            current_balance_credits=1_000_000.0,  # unconstrained, just to read the rate
            anthropic_input_per_m=pricing["anthropic_input_per_m"],
            anthropic_output_per_m=pricing["anthropic_output_per_m"],
            markup_multiplier=multiplier,
            requested_max_tokens=10_000_000,
        )
        output_rate = credit_engine.billed_rate_per_million(pricing["anthropic_output_per_m"], multiplier)
        min_output_cost_credits = credit_engine.usd_to_credits(
            credit_engine.token_cost_usd(credit_engine.DEFAULT_MIN_OUTPUT_TOKENS, output_rate)
        )
        return budget.input_cost_credits + min_output_cost_credits

    base_multiplier = pricing["markup_multiplier"]
    doubled_multiplier = base_multiplier * 2  # 100% organization margin
    balance = (cost_to_cover(base_multiplier) + cost_to_cover(doubled_multiplier)) / 2

    user = _user(organization_id=org_id, credit_balance=Decimal128(str(balance)))
    model_pricing = AsyncMock()
    model_pricing.find_one.return_value = pricing
    organizations = AsyncMock()
    organizations.find_one.return_value = {"_id": org_id, "profit_margin_percent": 100.0}
    db = make_fake_db(users=AsyncMock(), model_pricing=model_pricing, organizations=organizations)

    with patch.object(chat_module, "count_input_tokens", AsyncMock(return_value=INPUT_TOKENS)):
        with patch.object(chat_module, "create_message", AsyncMock()) as create_message:
            resp = _make_client(user, db).post("/v1/chat", json=REQUEST_BODY)

    assert resp.status_code == 402
    create_message.assert_not_called()
