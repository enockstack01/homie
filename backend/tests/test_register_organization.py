"""
Targeted coverage for POST /v1/register-organization - the self-service "I'm signing up
as an Organization" path (see admin-dashboard's /welcome page). The one thing that matters
most here: it must only ever fire for a brand-new, still-default account (member, no
organization_id) - never silently re-parent or duplicate-organize an already-placed one.
"""

from unittest.mock import AsyncMock

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routes import chat as chat_module
from tests.conftest import make_fake_db


def _make_client(user: dict, db) -> TestClient:
    app = FastAPI()
    app.include_router(chat_module.router)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _member(**overrides) -> dict:
    base = {"_id": ObjectId(), "role": "member", "organization_id": None}
    base.update(overrides)
    return base


def test_success_creates_org_and_promotes_caller_to_org_admin():
    user = _member()
    users = AsyncMock()
    organizations = AsyncMock()
    organizations.find_one.return_value = None  # no existing org_id collision
    db = make_fake_db(users=users, organizations=organizations)
    client = _make_client(user, db)

    resp = client.post("/v1/register-organization", json={"name": "Acme Surveys"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["organization_name"] == "Acme Surveys"
    assert "organization_id" in body

    org_insert = organizations.insert_one.call_args.args[0]
    assert org_insert["name"] == "Acme Surveys"
    assert org_insert["credit_balance"].to_decimal() == 0
    assert org_insert["org_id"].startswith("acme_surveys_")
    assert body["org_id"] == org_insert["org_id"]

    update_call = users.update_one.call_args
    assert update_call.args[0] == {"_id": user["_id"]}
    assert update_call.args[1]["$set"]["role"] == "org_admin"


def test_rejects_member_already_in_an_organization():
    user = _member(organization_id=ObjectId())
    db = make_fake_db(users=AsyncMock(), organizations=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/register-organization", json={"name": "Acme Surveys"})

    assert resp.status_code == 400
    db.organizations.insert_one.assert_not_called()


def test_rejects_non_member_role():
    """An org_admin, platform_admin, or super_admin has nothing to "register" - this
    isn't a role upgrade path."""
    user = _member(role="org_admin")
    db = make_fake_db(users=AsyncMock(), organizations=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/register-organization", json={"name": "Acme Surveys"})

    assert resp.status_code == 400
    db.organizations.insert_one.assert_not_called()


def test_rejects_blank_name():
    user = _member()
    db = make_fake_db(users=AsyncMock(), organizations=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/register-organization", json={"name": "   "})

    assert resp.status_code == 400
    db.organizations.insert_one.assert_not_called()
