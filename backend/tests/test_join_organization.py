"""
Targeted coverage for POST /v1/join-organization - the self-service "I'm joining an
existing Organization" path (see admin-dashboard's /welcome page, and
test_register_organization.py for the sibling "I'm creating one" path). A member enters
an organization's own human-readable org_id and is matched to it directly - unlike
register_organization, this never promotes the caller, and never touches status: the
org's own org_admin sees them show up (org_admin.list_members already includes anyone
with organization_id set, regardless of status) and approves via the existing
update_member_status control.
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


def test_success_sets_organization_id_without_promoting_or_touching_status():
    user = _member()
    org_id = ObjectId()
    users = AsyncMock()
    organizations = AsyncMock()
    organizations.find_one.return_value = {"_id": org_id, "name": "Acme Surveys", "org_id": "acme_surveys_ab12cd"}
    db = make_fake_db(users=users, organizations=organizations)
    client = _make_client(user, db)

    resp = client.post("/v1/join-organization", json={"org_id": "acme_surveys_ab12cd"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["organization_id"] == str(org_id)
    assert body["organization_name"] == "Acme Surveys"

    update_call = users.update_one.call_args
    assert update_call.args[0] == {"_id": user["_id"]}
    assert update_call.args[1]["$set"] == {"organization_id": org_id}
    # Only organization_id changes - role/status are left exactly as auto-provisioning
    # set them, unlike register_organization which also promotes to org_admin.
    assert "role" not in update_call.args[1]["$set"]
    assert "status" not in update_call.args[1]["$set"]


def test_lookup_is_case_insensitive_and_trims_whitespace():
    user = _member()
    org_id = ObjectId()
    organizations = AsyncMock()
    organizations.find_one.return_value = {"_id": org_id, "name": "Acme Surveys", "org_id": "acme_surveys_ab12cd"}
    db = make_fake_db(users=AsyncMock(), organizations=organizations)
    client = _make_client(user, db)

    resp = client.post("/v1/join-organization", json={"org_id": "  ACME_Surveys_AB12CD  "})

    assert resp.status_code == 200
    organizations.find_one.assert_called_once_with({"org_id": "acme_surveys_ab12cd"})


def test_unknown_org_id_is_rejected():
    user = _member()
    organizations = AsyncMock()
    organizations.find_one.return_value = None
    db = make_fake_db(users=AsyncMock(), organizations=organizations)
    client = _make_client(user, db)

    resp = client.post("/v1/join-organization", json={"org_id": "does_not_exist"})

    assert resp.status_code == 404


def test_blank_org_id_is_rejected():
    user = _member()
    db = make_fake_db(users=AsyncMock(), organizations=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/join-organization", json={"org_id": "   "})

    assert resp.status_code == 400
    db.organizations.find_one.assert_not_called()


def test_rejects_member_already_in_an_organization():
    user = _member(organization_id=ObjectId())
    db = make_fake_db(users=AsyncMock(), organizations=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/join-organization", json={"org_id": "acme_surveys_ab12cd"})

    assert resp.status_code == 400
    db.organizations.find_one.assert_not_called()


def test_rejects_non_member_role():
    user = _member(role="org_admin")
    db = make_fake_db(users=AsyncMock(), organizations=AsyncMock())
    client = _make_client(user, db)

    resp = client.post("/v1/join-organization", json={"org_id": "acme_surveys_ab12cd"})

    assert resp.status_code == 400
    db.organizations.find_one.assert_not_called()
