"""
Coverage for the platform requirement that deleting a user (super_admin's
update_user_status with status="deleted") removes them everywhere, not just flags a
status field: their Clerk identity/identities go first (see
routes/super_admin.py's _hard_delete_user), then the Mongo doc itself.
"""

from unittest.mock import AsyncMock, MagicMock

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routes import super_admin as super_admin_module
from tests.conftest import make_fake_db


def _make_client(db, admin_id: ObjectId, role: str = "super_admin") -> TestClient:
    app = FastAPI()
    app.include_router(super_admin_module.router)
    app.dependency_overrides[get_current_user] = lambda: {"_id": admin_id, "role": role}
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


def _fake_clerk():
    clerk = MagicMock()
    clerk.users.delete_async = AsyncMock()
    clerk.machines.delete_async = AsyncMock()
    return clerk


class TestHardDeleteUser:
    def test_deleting_a_user_removes_their_clerk_user_and_mongo_doc(self, monkeypatch):
        target_id = ObjectId()
        admin_id = ObjectId()
        users = AsyncMock()
        users.find_one.return_value = {
            "_id": target_id,
            "clerk_user_id": "user_abc123",
            "email": "gone@example.com",
        }
        db = make_fake_db(users=users)
        clerk = _fake_clerk()
        monkeypatch.setattr(super_admin_module, "get_clerk_client", lambda: clerk)

        client = _make_client(db, admin_id)
        resp = client.patch(f"/v1/super-admin/users/{target_id}/status", json={"status": "deleted"})

        assert resp.status_code == 200
        assert resp.json() == {"id": str(target_id), "deleted": True}
        clerk.users.delete_async.assert_awaited_once_with(user_id="user_abc123")
        clerk.machines.delete_async.assert_not_awaited()
        users.delete_one.assert_awaited_once_with({"_id": target_id})

    def test_deleting_a_user_with_a_machine_credential_removes_that_too(self, monkeypatch):
        target_id = ObjectId()
        admin_id = ObjectId()
        users = AsyncMock()
        users.find_one.return_value = {
            "_id": target_id,
            "clerk_user_id": "user_abc123",
            "machine_id": "mch_xyz789",
            "email": "gone@example.com",
        }
        db = make_fake_db(users=users)
        clerk = _fake_clerk()
        monkeypatch.setattr(super_admin_module, "get_clerk_client", lambda: clerk)

        client = _make_client(db, admin_id)
        resp = client.patch(f"/v1/super-admin/users/{target_id}/status", json={"status": "deleted"})

        assert resp.status_code == 200
        clerk.users.delete_async.assert_awaited_once_with(user_id="user_abc123")
        clerk.machines.delete_async.assert_awaited_once_with(machine_id="mch_xyz789")
        users.delete_one.assert_awaited_once_with({"_id": target_id})

    def test_deleting_a_pending_invite_with_no_clerk_identity_still_removes_the_doc(self, monkeypatch):
        """A pending invite (org_admin's add_member) may have no clerk_user_id/machine_id
        yet - deleting them must still succeed and not call Clerk at all."""
        target_id = ObjectId()
        admin_id = ObjectId()
        users = AsyncMock()
        users.find_one.return_value = {"_id": target_id, "email": "invited@example.com"}
        db = make_fake_db(users=users)
        clerk = _fake_clerk()
        monkeypatch.setattr(super_admin_module, "get_clerk_client", lambda: clerk)

        client = _make_client(db, admin_id)
        resp = client.patch(f"/v1/super-admin/users/{target_id}/status", json={"status": "deleted"})

        assert resp.status_code == 200
        clerk.users.delete_async.assert_not_awaited()
        clerk.machines.delete_async.assert_not_awaited()
        users.delete_one.assert_awaited_once_with({"_id": target_id})

    def test_clerk_deletion_failure_does_not_block_removing_the_local_doc(self, monkeypatch):
        """A Clerk identity that's already gone/revoked on Clerk's side must not abort the
        delete - the local doc still has to disappear."""
        target_id = ObjectId()
        admin_id = ObjectId()
        users = AsyncMock()
        users.find_one.return_value = {
            "_id": target_id,
            "clerk_user_id": "user_already_gone",
            "email": "gone@example.com",
        }
        db = make_fake_db(users=users)
        clerk = _fake_clerk()
        clerk.users.delete_async.side_effect = Exception("404 from Clerk")
        monkeypatch.setattr(super_admin_module, "get_clerk_client", lambda: clerk)

        client = _make_client(db, admin_id)
        resp = client.patch(f"/v1/super-admin/users/{target_id}/status", json={"status": "deleted"})

        assert resp.status_code == 200
        users.delete_one.assert_awaited_once_with({"_id": target_id})

    def test_a_super_admin_cannot_delete_their_own_account(self):
        admin_id = ObjectId()
        users = AsyncMock()
        db = make_fake_db(users=users)
        client = _make_client(db, admin_id)

        resp = client.patch(f"/v1/super-admin/users/{admin_id}/status", json={"status": "deleted"})

        assert resp.status_code == 400
        users.find_one.assert_not_awaited()
        users.delete_one.assert_not_awaited()

    def test_deleting_a_nonexistent_user_404s(self, monkeypatch):
        admin_id = ObjectId()
        users = AsyncMock()
        users.find_one.return_value = None
        db = make_fake_db(users=users)
        clerk = _fake_clerk()
        monkeypatch.setattr(super_admin_module, "get_clerk_client", lambda: clerk)

        client = _make_client(db, admin_id)
        resp = client.patch(f"/v1/super-admin/users/{ObjectId()}/status", json={"status": "deleted"})

        assert resp.status_code == 404
        clerk.users.delete_async.assert_not_awaited()
