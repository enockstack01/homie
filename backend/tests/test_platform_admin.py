"""
Targeted coverage for platform_admin - a role identical to super_admin except it cannot
change platform resources (model pricing, the Anthropic API key). See app/auth.py's
require_super_admin (strict, platform resource mutations only) vs require_platform_staff
(super_admin OR platform_admin, everything else).
"""

from unittest.mock import AsyncMock, MagicMock

from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.db import get_db
from app.routes import super_admin as super_admin_module
from tests.conftest import make_fake_cursor, make_fake_db


def _make_client(db, role: str) -> TestClient:
    app = FastAPI()
    app.include_router(super_admin_module.router)
    app.dependency_overrides[get_current_user] = lambda: {"_id": ObjectId(), "role": role}
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)


class TestPlatformStaffRoutesAllowBothRoles:
    """Routes gated by require_platform_staff: everything except the platform-resource
    mutations - both super_admin and platform_admin must reach them."""

    def test_platform_admin_can_list_organizations(self):
        organizations = MagicMock()
        organizations.find = MagicMock(return_value=make_fake_cursor([]))
        db = make_fake_db(organizations=organizations, users=AsyncMock())
        client = _make_client(db, "platform_admin")

        resp = client.get("/v1/super-admin/organizations")

        assert resp.status_code == 200
        assert resp.json() == []

    def test_platform_admin_can_list_users(self):
        users = MagicMock()
        users.find = MagicMock(return_value=make_fake_cursor([]))
        db = make_fake_db(users=users)
        client = _make_client(db, "platform_admin")

        resp = client.get("/v1/super-admin/users")

        assert resp.status_code == 200
        assert resp.json() == []

    def test_platform_admin_can_view_model_pricing(self):
        model_pricing = MagicMock()
        model_pricing.find = MagicMock(return_value=make_fake_cursor([]))
        db = make_fake_db(model_pricing=model_pricing)
        client = _make_client(db, "platform_admin")

        resp = client.get("/v1/super-admin/model-pricing")

        assert resp.status_code == 200
        assert resp.json() == []

    def test_platform_admin_can_view_anthropic_api_key(self):
        db = make_fake_db(platform_config=AsyncMock())
        db.platform_config.find_one.return_value = {"anthropic_api_key": "sk-ant-existing"}
        client = _make_client(db, "platform_admin")

        resp = client.get("/v1/super-admin/anthropic-api-key")

        assert resp.status_code == 200
        assert resp.json() == {"api_key": "sk-ant-existing"}

    def test_super_admin_still_allowed_on_platform_staff_routes(self):
        organizations = MagicMock()
        organizations.find = MagicMock(return_value=make_fake_cursor([]))
        db = make_fake_db(organizations=organizations, users=AsyncMock())
        client = _make_client(db, "super_admin")

        resp = client.get("/v1/super-admin/organizations")

        assert resp.status_code == 200

    def test_member_is_rejected_from_platform_staff_routes(self):
        organizations = MagicMock()
        organizations.find = MagicMock(return_value=make_fake_cursor([]))
        db = make_fake_db(organizations=organizations, users=AsyncMock())
        client = _make_client(db, "member")

        resp = client.get("/v1/super-admin/organizations")

        assert resp.status_code == 403


class TestPlatformResourceMutationsAreSuperAdminOnly:
    """The one carve-out: platform_admin must be rejected from these three routes even
    though it passes require_platform_staff everywhere else."""

    def test_platform_admin_cannot_update_model_pricing(self):
        model_pricing = AsyncMock()
        db = make_fake_db(model_pricing=model_pricing)
        client = _make_client(db, "platform_admin")

        resp = client.patch(
            "/v1/super-admin/model-pricing/claude-sonnet-5-standard",
            json={"is_active": True},
        )

        assert resp.status_code == 403
        model_pricing.find_one_and_update.assert_not_called()

    def test_platform_admin_cannot_set_anthropic_api_key(self):
        db = make_fake_db(platform_config=AsyncMock())
        client = _make_client(db, "platform_admin")

        resp = client.post("/v1/super-admin/anthropic-api-key", json={"api_key": "sk-ant-new"})

        assert resp.status_code == 403

    def test_platform_admin_cannot_invalidate_anthropic_api_key(self):
        db = make_fake_db(platform_config=AsyncMock())
        client = _make_client(db, "platform_admin")

        resp = client.post("/v1/super-admin/anthropic-api-key/invalidate")

        assert resp.status_code == 403

    def test_super_admin_can_still_update_model_pricing(self):
        """Regression guard: splitting the dependency must not also lock out real
        super_admin accounts from the routes that were always meant for them."""
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
        client = _make_client(db, "super_admin")

        resp = client.patch(
            "/v1/super-admin/model-pricing/claude-sonnet-5-standard",
            json={"is_active": True},
        )

        assert resp.status_code == 200


class TestUpdateUserRoleAcceptsPlatformAdmin:
    def test_promoting_to_platform_admin_clears_organization_id(self):
        target = ObjectId()
        users = AsyncMock()
        users.find_one.return_value = {"_id": target, "organization_id": ObjectId(), "email": "a@example.com"}
        users.find_one_and_update.return_value = {"_id": target, "role": "platform_admin", "organization_id": None}
        db = make_fake_db(users=users)
        client = _make_client(db, "super_admin")

        resp = client.patch(f"/v1/super-admin/users/{target}/role", json={"role": "platform_admin"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["role"] == "platform_admin"
        assert body["organization_id"] is None
        set_fields = users.find_one_and_update.call_args.args[1]["$set"]
        assert set_fields == {"role": "platform_admin", "organization_id": None}
