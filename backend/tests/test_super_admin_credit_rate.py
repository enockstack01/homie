"""
get_credit_rate just re-exports credit_engine.CREDITS_PER_USD over HTTP so the dashboard's
grant-amount reference table/calculator derives from the same source as the real billing
math (see the route's own docstring) - this only guards that wiring, not the rate's value
(test_credit_engine.py already covers the conversion math itself).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.routes import super_admin as super_admin_module
from app.services import credit_engine


def _make_client(user: dict) -> TestClient:
    app = FastAPI()
    app.include_router(super_admin_module.router)
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def test_credit_rate_matches_credit_engine_constant():
    client = _make_client({"role": "super_admin"})

    resp = client.get("/v1/super-admin/credit-rate")

    assert resp.status_code == 200
    assert resp.json() == {
        "credits_per_usd": credit_engine.CREDITS_PER_USD,
        "minimum_markup_multiplier": credit_engine.MINIMUM_MARKUP_MULTIPLIER,
        "minimum_margin": credit_engine.MINIMUM_MARGIN,
    }


def test_credit_rate_requires_super_admin_role():
    client = _make_client({"role": "member"})

    resp = client.get("/v1/super-admin/credit-rate")

    assert resp.status_code == 403
