"""
Targeted coverage for app/services/credit_transfer.py - the four ways credits move
between users and organizations. Every function here guards real money, so the cases
that matter most are the rejection paths (can't overdraw, can't act on a nonexistent
target) and the "rounding noise" clamp both revoke_credits and reclaim_from_member apply
(see their own docstrings for why a displayed-and-resubmitted balance can be a hair more
than what's actually stored).
"""

from unittest.mock import AsyncMock

import pytest
from bson import Decimal128, ObjectId
from fastapi import HTTPException

from app.services.credit_transfer import (
    allocate_from_organization,
    grant_external,
    reclaim_from_member,
    revoke_credits,
)
from tests.conftest import make_fake_db


def _doc(balance: float, **extra) -> dict:
    return {"_id": ObjectId(), "credit_balance": Decimal128(str(balance)), **extra}


# ---- grant_external -------------------------------------------------------------


async def test_grant_external_rejects_non_positive_amount():
    db = make_fake_db(users=AsyncMock(), credit_transactions=AsyncMock())
    with pytest.raises(HTTPException) as exc:
        await grant_external(
            db,
            target_collection="users",
            target_id=ObjectId(),
            amount_usd_received=0,
            payment_note="",
            granted_by_user_id=ObjectId(),
        )
    assert exc.value.status_code == 400


async def test_grant_external_404_when_target_missing():
    users = AsyncMock()
    users.find_one_and_update.return_value = None
    db = make_fake_db(users=users, credit_transactions=AsyncMock())
    with pytest.raises(HTTPException) as exc:
        await grant_external(
            db,
            target_collection="users",
            target_id=ObjectId(),
            amount_usd_received=10,
            payment_note="invoice",
            granted_by_user_id=ObjectId(),
        )
    assert exc.value.status_code == 404


async def test_grant_external_success_converts_usd_to_credits():
    users = AsyncMock()
    users.find_one_and_update.return_value = _doc(10_000.0)  # $10 -> 10,000 credits
    transactions = AsyncMock()
    db = make_fake_db(users=users, credit_transactions=transactions)

    new_balance = await grant_external(
        db,
        target_collection="users",
        target_id=ObjectId(),
        amount_usd_received=10,
        payment_note="invoice #1",
        granted_by_user_id=ObjectId(),
    )

    assert new_balance == 10_000.0
    logged = transactions.insert_one.call_args.args[0]
    assert logged["credits_granted"] == Decimal128("10000.0")


# ---- revoke_credits --------------------------------------------------------------


async def test_revoke_credits_rejects_when_balance_genuinely_insufficient():
    users = AsyncMock()
    users.find_one.return_value = _doc(5.0)
    db = make_fake_db(users=users, credit_transactions=AsyncMock())

    with pytest.raises(HTTPException) as exc:
        await revoke_credits(
            db,
            target_collection="users",
            target_id=ObjectId(),
            amount=10.0,
            revoked_by_user_id=ObjectId(),
        )
    assert exc.value.status_code == 402


async def test_revoke_credits_clamps_within_a_cent_of_rounding_noise():
    """Displayed balance 864.82 for a true 864.8166666... - revoking the displayed
    (rounded-up) figure must succeed by clamping to the real balance, not bounce as
    insufficient funds."""
    true_balance = 864.8166666666666
    users = AsyncMock()
    users.find_one.return_value = _doc(true_balance)
    users.find_one_and_update.return_value = _doc(0.0)
    db = make_fake_db(users=users, credit_transactions=AsyncMock())

    result = await revoke_credits(
        db,
        target_collection="users",
        target_id=ObjectId(),
        amount=864.82,
        revoked_by_user_id=ObjectId(),
    )

    assert result == 0.0
    clamped_amount = users.find_one_and_update.call_args.args[0]["credit_balance"]["$gte"]
    assert clamped_amount == Decimal128(str(true_balance))


async def test_revoke_credits_404_when_target_missing():
    users = AsyncMock()
    users.find_one.return_value = None
    db = make_fake_db(users=users, credit_transactions=AsyncMock())

    with pytest.raises(HTTPException) as exc:
        await revoke_credits(
            db,
            target_collection="users",
            target_id=ObjectId(),
            amount=1.0,
            revoked_by_user_id=ObjectId(),
        )
    assert exc.value.status_code == 404


# ---- allocate_from_organization ---------------------------------------------------


async def test_allocate_from_organization_rejects_when_pool_cant_cover_it():
    organizations = AsyncMock()
    organizations.find_one_and_update.return_value = None  # $gte filter didn't match
    db = make_fake_db(
        organizations=organizations, users=AsyncMock(), credit_transactions=AsyncMock()
    )

    with pytest.raises(HTTPException) as exc:
        await allocate_from_organization(
            db,
            organization_id=ObjectId(),
            member_user_id=ObjectId(),
            credits_to_allocate=1000.0,
            allocated_by_user_id=ObjectId(),
        )
    assert exc.value.status_code == 402


async def test_allocate_from_organization_404_when_member_not_in_org():
    organizations = AsyncMock()
    organizations.find_one_and_update.return_value = _doc(5000.0)
    users = AsyncMock()
    users.find_one_and_update.return_value = None
    db = make_fake_db(organizations=organizations, users=users, credit_transactions=AsyncMock())

    with pytest.raises(HTTPException) as exc:
        await allocate_from_organization(
            db,
            organization_id=ObjectId(),
            member_user_id=ObjectId(),
            credits_to_allocate=100.0,
            allocated_by_user_id=ObjectId(),
        )
    assert exc.value.status_code == 404


async def test_allocate_from_organization_success_moves_credits_both_ways():
    organizations = AsyncMock()
    organizations.find_one_and_update.return_value = _doc(4900.0)
    users = AsyncMock()
    users.find_one_and_update.return_value = _doc(100.0)
    transactions = AsyncMock()
    db = make_fake_db(organizations=organizations, users=users, credit_transactions=transactions)

    result = await allocate_from_organization(
        db,
        organization_id=ObjectId(),
        member_user_id=ObjectId(),
        credits_to_allocate=100.0,
        allocated_by_user_id=ObjectId(),
    )

    assert result == {"organization_balance": 4900.0, "member_balance": 100.0}
    assert transactions.insert_one.called


# ---- reclaim_from_member ----------------------------------------------------------


async def test_reclaim_from_member_rejects_when_member_balance_genuinely_insufficient():
    users = AsyncMock()
    users.find_one.return_value = _doc(10.0)
    db = make_fake_db(users=users, organizations=AsyncMock(), credit_transactions=AsyncMock())

    with pytest.raises(HTTPException) as exc:
        await reclaim_from_member(
            db,
            organization_id=ObjectId(),
            member_user_id=ObjectId(),
            credits_to_reclaim=50.0,
            reclaimed_by_user_id=ObjectId(),
        )
    assert exc.value.status_code == 402


async def test_reclaim_from_member_success_moves_credits_both_ways():
    users = AsyncMock()
    users.find_one.return_value = _doc(100.0)
    users.find_one_and_update.return_value = _doc(0.0)
    organizations = AsyncMock()
    organizations.find_one_and_update.return_value = _doc(5100.0)
    transactions = AsyncMock()
    db = make_fake_db(users=users, organizations=organizations, credit_transactions=transactions)

    result = await reclaim_from_member(
        db,
        organization_id=ObjectId(),
        member_user_id=ObjectId(),
        credits_to_reclaim=100.0,
        reclaimed_by_user_id=ObjectId(),
    )

    assert result == {"organization_balance": 5100.0, "member_balance": 0.0}
    assert transactions.insert_one.called
