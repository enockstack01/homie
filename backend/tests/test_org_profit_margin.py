"""
Targeted coverage for PATCH /v1/org-admin/organization/profit-margin and the
profit_margin_percent field on GET /v1/org-admin/organization - the org_admin-facing side
of credit_engine.apply_organization_margin (see tests/test_chat_org_margin.py for the
member-spend-time side of the same feature).
"""

from unittest.mock import AsyncMock

from bson import Decimal128, ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routes import org_admin as org_admin_module
from tests.conftest import make_fake_db


def _make_client(user: dict, db) -> TestClient:
    app = FastAPI()
    app.include_router(org_admin_module.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _admin(org_id: ObjectId) -> dict:
    return {"_id": ObjectId(), "role": "org_admin", "organization_id": org_id}


def test_get_organization_reports_zero_margin_when_field_is_absent():
    """An organization created before this field existed (or one that's simply never set
    one) must read back as 0% - identical to explicitly choosing no markup."""
    org_id = ObjectId()
    org_doc = {"_id": org_id, "name": "Acme", "credit_balance": Decimal128("100.0")}
    organizations = AsyncMock()
    # First call (get_my_organization's own lookup, by _id) returns the org; the second
    # (ensure_org_id's backfill collision-check, by org_id) must see no collision.
    organizations.find_one.side_effect = lambda query, *a, **kw: org_doc if "_id" in query else None
    db = make_fake_db(organizations=organizations)
    client = _make_client(_admin(org_id), db)

    resp = client.get("/v1/org-admin/organization")

    assert resp.status_code == 200
    assert resp.json()["profit_margin_percent"] == 0.0


def test_set_profit_margin_updates_the_organizations_own_document():
    org_id = ObjectId()
    organizations = AsyncMock()
    organizations.find_one_and_update.return_value = {"_id": org_id, "profit_margin_percent": 30.0}
    db = make_fake_db(organizations=organizations)
    client = _make_client(_admin(org_id), db)

    resp = client.patch("/v1/org-admin/organization/profit-margin", json={"margin_percent": 30.0})

    assert resp.status_code == 200
    assert resp.json()["profit_margin_percent"] == 30.0
    set_fields = organizations.find_one_and_update.call_args.args[1]["$set"]
    assert set_fields == {"profit_margin_percent": 30.0}


def test_set_profit_margin_rejects_negative_values():
    org_id = ObjectId()
    organizations = AsyncMock()
    db = make_fake_db(organizations=organizations)
    client = _make_client(_admin(org_id), db)

    resp = client.patch("/v1/org-admin/organization/profit-margin", json={"margin_percent": -5.0})

    assert resp.status_code == 400
    organizations.find_one_and_update.assert_not_called()


def test_set_profit_margin_rejects_over_100():
    org_id = ObjectId()
    organizations = AsyncMock()
    db = make_fake_db(organizations=organizations)
    client = _make_client(_admin(org_id), db)

    resp = client.patch("/v1/org-admin/organization/profit-margin", json={"margin_percent": 100.01})

    assert resp.status_code == 400
    organizations.find_one_and_update.assert_not_called()


def test_set_profit_margin_allows_the_full_boundary_values():
    org_id = ObjectId()
    organizations = AsyncMock()
    organizations.find_one_and_update.return_value = {"_id": org_id, "profit_margin_percent": 100.0}
    db = make_fake_db(organizations=organizations)
    client = _make_client(_admin(org_id), db)

    resp = client.patch("/v1/org-admin/organization/profit-margin", json={"margin_percent": 100.0})

    assert resp.status_code == 200
    assert resp.json()["profit_margin_percent"] == 100.0
