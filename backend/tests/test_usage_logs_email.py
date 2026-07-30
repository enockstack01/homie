"""
Targeted coverage for the user_email attached to usage-log rows (super_admin's
list_usage_logs and org_admin's list_org_usage_logs) - both batch-fetch email in one
query per page via a local _batch_user_emails helper (duplicated per-file, not shared,
matching this codebase's existing per-route-module `_helper` convention) rather than one
find_one per row.
"""

from unittest.mock import AsyncMock, MagicMock

from bson import Decimal128, ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routes import org_admin as org_admin_module
from app.routes import super_admin as super_admin_module
from tests.conftest import make_fake_cursor, make_fake_db


def _log(user_id: ObjectId, **overrides) -> dict:
    base = {
        "user_id": user_id,
        "model_id": "claude-sonnet-5",
        "input_tokens": 100,
        "output_tokens": 50,
        "credits_deducted": Decimal128("1.5"),
        "timestamp": __import__("datetime").datetime(2026, 7, 29, tzinfo=__import__("datetime").timezone.utc),
    }
    base.update(overrides)
    return base


class TestSuperAdminUsageLogs:
    def _make_client(self, db) -> TestClient:
        app = FastAPI()
        app.include_router(super_admin_module.router)
        app.dependency_overrides[get_current_user] = lambda: {"role": "super_admin"}
        app.dependency_overrides[get_db] = lambda: db
        return TestClient(app)

    def test_attaches_email_per_log_and_none_for_a_deleted_user(self):
        known_user = ObjectId()
        deleted_user = ObjectId()

        usage_logs = MagicMock()
        usage_logs.find = MagicMock(return_value=make_fake_cursor([_log(known_user), _log(deleted_user)]))

        users = MagicMock()
        users.find = MagicMock(return_value=make_fake_cursor([{"_id": known_user, "email": "a@example.com"}]))

        db = make_fake_db(usage_logs=usage_logs, users=users)
        client = self._make_client(db)

        resp = client.get("/v1/super-admin/usage-logs")

        assert resp.status_code == 200
        body = resp.json()
        by_id = {row["user_id"]: row for row in body}
        assert by_id[str(known_user)]["user_email"] == "a@example.com"
        assert by_id[str(deleted_user)]["user_email"] is None

    def test_empty_log_list_never_queries_users(self):
        usage_logs = MagicMock()
        usage_logs.find = MagicMock(return_value=make_fake_cursor([]))
        users = MagicMock()
        users.find = MagicMock(return_value=make_fake_cursor([]))

        db = make_fake_db(usage_logs=usage_logs, users=users)
        client = self._make_client(db)

        resp = client.get("/v1/super-admin/usage-logs")

        assert resp.status_code == 200
        assert resp.json() == []
        users.find.assert_not_called()


class TestOrgAdminUsageLogs:
    def _make_client(self, db, admin: dict) -> TestClient:
        app = FastAPI()
        app.include_router(org_admin_module.router)
        app.dependency_overrides[get_current_user] = lambda: admin
        app.dependency_overrides[get_db] = lambda: db
        return TestClient(app)

    def test_attaches_email_scoped_to_the_admins_organization(self):
        org_id = ObjectId()
        member = ObjectId()

        usage_logs = MagicMock()
        usage_logs.find = MagicMock(return_value=make_fake_cursor([_log(member)]))
        users = MagicMock()
        users.find = MagicMock(return_value=make_fake_cursor([{"_id": member, "email": "member@org.example"}]))

        db = make_fake_db(usage_logs=usage_logs, users=users)
        admin = {"role": "org_admin", "organization_id": org_id}
        client = self._make_client(db, admin)

        resp = client.get("/v1/org-admin/usage-logs")

        assert resp.status_code == 200
        body = resp.json()
        assert body[0]["user_email"] == "member@org.example"
        usage_logs.find.assert_called_once_with({"organization_id": org_id})
