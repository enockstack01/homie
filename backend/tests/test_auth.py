"""
Targeted coverage for app/auth.py's get_current_user - the account-provisioning and
lifecycle logic every other route relies on. _fetch_clerk_email is patched out in every
case (it's a live Clerk API call) so these stay pure logic, same spirit as
test_credit_engine.py.
"""

from unittest.mock import AsyncMock, patch

import pytest
from bson import Decimal128, ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.auth import (
    ROLE_MEMBER,
    STATUS_ACTIVE,
    STATUS_BANNED,
    STATUS_PENDING,
    get_current_user,
)
from tests.conftest import make_fake_db


async def test_existing_user_found_by_clerk_user_id_is_returned_as_is():
    existing = {"_id": ObjectId(), "clerk_user_id": "user_abc", "status": STATUS_ACTIVE}
    users = AsyncMock()
    users.find_one.return_value = existing
    db = make_fake_db(users=users)

    result = await get_current_user(identity_id="user_abc", db=db)

    assert result is existing
    users.find_one_and_update.assert_not_called()
    users.insert_one.assert_not_called()


async def test_banned_existing_user_is_rejected_before_reaching_a_route():
    banned = {"_id": ObjectId(), "clerk_user_id": "user_abc", "status": STATUS_BANNED}
    users = AsyncMock()
    users.find_one.return_value = banned
    db = make_fake_db(users=users)

    with pytest.raises(HTTPException) as exc:
        await get_current_user(identity_id="user_abc", db=db)
    assert exc.value.status_code == 403


async def test_unmatched_machine_identity_is_rejected_not_auto_provisioned():
    """A brand-new machine id with no matching account means revoked/reassigned, not a
    new signup - machines are only ever created by issue_api_key against an existing
    user, so there's no legitimate way for this to be a fresh signup."""
    users = AsyncMock()
    users.find_one.return_value = None
    db = make_fake_db(users=users)

    with pytest.raises(HTTPException) as exc:
        await get_current_user(identity_id="mch_unknown", db=db)
    assert exc.value.status_code == 401
    users.insert_one.assert_not_called()


async def test_pending_invite_is_linked_and_flipped_active_on_first_sign_in():
    """An org_admin invited this email before the person ever signed into Clerk - their
    real first sign-in should link up with that existing doc, not create a duplicate."""
    invited_doc = {
        "_id": ObjectId(),
        "email": "new@org.example",
        "organization_id": ObjectId(),
        "status": STATUS_PENDING,
    }
    linked_doc = {**invited_doc, "clerk_user_id": "user_new", "status": STATUS_ACTIVE}
    users = AsyncMock()
    users.find_one.return_value = None
    users.find_one_and_update.return_value = linked_doc
    db = make_fake_db(users=users)

    with patch("app.auth._fetch_clerk_email", AsyncMock(return_value="new@org.example")):
        result = await get_current_user(identity_id="user_new", db=db)

    assert result["status"] == STATUS_ACTIVE
    assert result["organization_id"] == invited_doc["organization_id"]
    users.insert_one.assert_not_called()


async def test_brand_new_self_signup_is_auto_provisioned_as_pending_member():
    users = AsyncMock()
    users.find_one.return_value = None
    users.find_one_and_update.return_value = None  # no matching pending invite
    inserted = AsyncMock()
    inserted.inserted_id = ObjectId()
    users.insert_one.return_value = inserted
    db = make_fake_db(users=users)

    with patch("app.auth._fetch_clerk_email", AsyncMock(return_value="fresh@example.com")):
        result = await get_current_user(identity_id="user_fresh", db=db)

    assert result["status"] == STATUS_PENDING
    assert result["role"] == ROLE_MEMBER
    assert result["organization_id"] is None
    assert result["credit_balance"] == Decimal128("0")
    assert "machine_id" not in result  # sparse unique index - must be absent, not None
    users.insert_one.assert_called_once()


async def test_concurrent_first_sign_in_loses_the_insert_race_gracefully():
    """
    A brand-new sign-in's very first navigation triggers get_current_user from more than
    one place at once (the root layout and the page it's rendering both call /v1/me) -
    both can reach the auto-provisioning branch seeing no existing account yet. Only one
    insert_one can win the unique clerk_user_id index (see db.py); the loser must return
    the winner's doc instead of 500ing with an unhandled DuplicateKeyError (this
    reproduces a real crash observed right after sign-up).
    """
    winner_doc = {
        "_id": ObjectId(),
        "clerk_user_id": "user_fresh",
        "role": ROLE_MEMBER,
        "organization_id": None,
        "status": STATUS_PENDING,
        "credit_balance": Decimal128("0"),
    }
    users = AsyncMock()
    # First call: no existing account yet (this request is racing the other one). Second
    # call (after losing the insert race): the winner's doc is now there.
    users.find_one.side_effect = [None, winner_doc]
    users.find_one_and_update.return_value = None  # no matching pending invite
    users.insert_one.side_effect = DuplicateKeyError("dup key")
    db = make_fake_db(users=users)

    with patch("app.auth._fetch_clerk_email", AsyncMock(return_value="fresh@example.com")):
        result = await get_current_user(identity_id="user_fresh", db=db)

    assert result is winner_doc
    users.insert_one.assert_called_once()


async def test_insert_race_loser_still_rejects_a_banned_winner():
    """The doc the race's winner just created might already be banned/deleted by the time
    the loser fetches it (unlikely in the same request, but the same _reject_if_blocked
    guard every other lookup path goes through must still apply here)."""
    banned_winner = {"_id": ObjectId(), "clerk_user_id": "user_fresh", "status": "banned"}
    users = AsyncMock()
    users.find_one.side_effect = [None, banned_winner]
    users.find_one_and_update.return_value = None
    users.insert_one.side_effect = DuplicateKeyError("dup key")
    db = make_fake_db(users=users)

    with patch("app.auth._fetch_clerk_email", AsyncMock(return_value="fresh@example.com")):
        with pytest.raises(HTTPException) as exc:
            await get_current_user(identity_id="user_fresh", db=db)
    assert exc.value.status_code == 403


async def test_insert_race_with_no_matching_doc_reraises_the_original_error():
    """If insert_one fails on a duplicate key but a re-fetch finds nothing, something else
    entirely is going on - that must surface as the original DuplicateKeyError, not be
    silently swallowed into a confusing 500 with no traceback context."""
    users = AsyncMock()
    users.find_one.side_effect = [None, None]
    users.find_one_and_update.return_value = None
    users.insert_one.side_effect = DuplicateKeyError("dup key")
    db = make_fake_db(users=users)

    with patch("app.auth._fetch_clerk_email", AsyncMock(return_value="fresh@example.com")):
        with pytest.raises(DuplicateKeyError):
            await get_current_user(identity_id="user_fresh", db=db)
