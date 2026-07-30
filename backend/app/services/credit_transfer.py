"""
Four kinds of credit movement, all built on the same atomic find_one_and_update-then-log
pattern as the original single-tier grant flow:

1. External funding (`grant_external`): a super_admin recording money that came in
   *outside* the system (a bank transfer, an invoice) and crediting it to either an
   organization's pool, or a user's own balance directly as a support override. The
   source is external/unlimited - this never checks a balance, it only ever adds.

2. Internal allocation (`allocate_from_organization`): an org_admin moving credits they
   already have out of their organization's own pool into one of their members' personal
   balances. This DOES check the org can afford it, atomically, the same way
   routes/chat.py's spend-time deduction does - two allocations racing against a nearly-
   empty pool must not both succeed.

3. Revocation (`revoke_credits`): a super_admin removing a *specified amount* of credits
   from a user's balance or an organization's pool - the exact inverse of grant_external,
   and only ever callable by a super_admin (org_admin's equivalent power is scoped to
   `reclaim_from_member` below, since an org_admin never gets to destroy credits, only
   move them back into their own org's pool). Recorded as a negative credits_granted
   entry in the same ledger grant_external and allocate_from_organization write to.

4. Reclamation (`reclaim_from_member`): an org_admin moving a specified amount of credits
   *back* out of one of their members' personal balances and into their own
   organization's pool - the exact inverse of allocate_from_organization. Unlike
   revoke_credits, this never destroys credits; the total inside the organization
   (pool + all members' balances) is unchanged, only redistributed.
"""

from datetime import datetime, timezone

from bson import Decimal128, ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.credit_engine import usd_to_credits


async def grant_external(
    db: AsyncIOMotorDatabase,
    *,
    target_collection: str,  # "users" or "organizations"
    target_id: ObjectId,
    amount_usd_received: float,
    payment_note: str,
    granted_by_user_id: ObjectId,
) -> float:
    """Returns the new balance. Raises 404 if target_id doesn't exist, 400 if the amount
    isn't positive."""
    if amount_usd_received <= 0:
        raise HTTPException(status_code=400, detail="amount_usd_received must be positive")

    credits_to_grant = usd_to_credits(amount_usd_received)
    collection = db[target_collection]

    async with await db.client.start_session() as session:
        async with session.start_transaction():
            updated = await collection.find_one_and_update(
                {"_id": target_id},
                {"$inc": {"credit_balance": Decimal128(str(credits_to_grant))}},
                return_document=True,
                session=session,
            )
            if updated is None:
                raise HTTPException(status_code=404, detail=f"{target_collection[:-1]} not found")

            await db.credit_transactions.insert_one(
                {
                    "target_collection": target_collection,
                    "target_id": target_id,
                    "granted_by_user_id": granted_by_user_id,
                    "amount_usd_received": Decimal128(str(amount_usd_received)),
                    "credits_granted": Decimal128(str(credits_to_grant)),
                    "payment_note": payment_note,
                    "created_at": datetime.now(timezone.utc),
                },
                session=session,
            )

    return round(float(updated["credit_balance"].to_decimal()), 2)


async def allocate_from_organization(
    db: AsyncIOMotorDatabase,
    *,
    organization_id: ObjectId,
    member_user_id: ObjectId,
    credits_to_allocate: float,
    allocated_by_user_id: ObjectId,
) -> dict:
    """Returns {"organization_balance": ..., "member_balance": ...}. Raises 402 if the
    organization's pool can't cover it, 404 if the member isn't actually in that org."""
    if credits_to_allocate <= 0:
        raise HTTPException(status_code=400, detail="credits_to_allocate must be positive")

    amount = Decimal128(str(credits_to_allocate))

    async with await db.client.start_session() as session:
        async with session.start_transaction():
            org = await db.organizations.find_one_and_update(
                {"_id": organization_id, "credit_balance": {"$gte": amount}},
                {"$inc": {"credit_balance": Decimal128(str(-credits_to_allocate))}},
                return_document=True,
                session=session,
            )
            if org is None:
                raise HTTPException(
                    status_code=402,
                    detail="Organization's credit pool can't cover this allocation.",
                )

            member = await db.users.find_one_and_update(
                {"_id": member_user_id, "organization_id": organization_id},
                {"$inc": {"credit_balance": amount}},
                return_document=True,
                session=session,
            )
            if member is None:
                raise HTTPException(status_code=404, detail="Member not found in this organization")

            await db.credit_transactions.insert_one(
                {
                    "target_collection": "users",
                    "target_id": member_user_id,
                    "source_collection": "organizations",
                    "source_id": organization_id,
                    "granted_by_user_id": allocated_by_user_id,
                    "amount_usd_received": Decimal128("0"),  # internal transfer, not new external funding
                    "credits_granted": amount,
                    "payment_note": "Allocated from organization pool",
                    "created_at": datetime.now(timezone.utc),
                },
                session=session,
            )

    return {
        "organization_balance": round(float(org["credit_balance"].to_decimal()), 2),
        "member_balance": round(float(member["credit_balance"].to_decimal()), 2),
    }


async def revoke_credits(
    db: AsyncIOMotorDatabase,
    *,
    target_collection: str,  # "users" or "organizations"
    target_id: ObjectId,
    amount: float,
    revoked_by_user_id: ObjectId,
    note: str = "",
) -> float:
    """Removes a specific amount of credits from a target's balance and logs it as a
    negative credits_granted entry. Returns the new balance. Raises 404 if the target
    doesn't exist, 400 if amount isn't positive, 402 if the target's balance is genuinely
    less than amount.

    The UI only ever shows/accepts a balance rounded to 2 decimal places, but the stored
    balance can carry more precision (fractional-credit usage deductions accumulate across
    many chat requests) - so "revoke everything" naturally submits the *rounded* balance,
    which can be a hair more than what's actually stored (e.g. displayed 864.82 for a true
    864.8166666666666). Within a cent of that rounding noise, clamp down to the real
    balance instead of bouncing an admin's "revoke all" as insufficient funds."""
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be positive")

    collection = db[target_collection]
    # An organization's credit_balance *is* its unallocated pool - it has no separate
    # "balance" the way a user does - so error/retry messages should say so.
    noun = "pool" if target_collection == "organizations" else "balance"

    async with await db.client.start_session() as session:
        async with session.start_transaction():
            existing = await collection.find_one({"_id": target_id}, session=session)
            if existing is None:
                raise HTTPException(status_code=404, detail=f"{target_collection[:-1]} not found")

            current = float(existing["credit_balance"].to_decimal())
            if amount > current:
                if amount - current <= 0.01:
                    amount = current
                else:
                    raise HTTPException(
                        status_code=402,
                        detail=f"Can't revoke {amount:g} credits - current {noun} is only {round(current, 2)}.",
                    )

            if amount <= 0:
                return round(current, 2)

            amount128 = Decimal128(str(amount))
            updated = await collection.find_one_and_update(
                {"_id": target_id, "credit_balance": {"$gte": amount128}},
                {"$inc": {"credit_balance": Decimal128(str(-amount))}},
                return_document=True,
                session=session,
            )
            if updated is None:
                raise HTTPException(
                    status_code=409,
                    detail=f"{target_collection[:-1].capitalize()}'s {noun} changed concurrently - please retry.",
                )

            await db.credit_transactions.insert_one(
                {
                    "target_collection": target_collection,
                    "target_id": target_id,
                    "granted_by_user_id": revoked_by_user_id,
                    "amount_usd_received": Decimal128("0"),
                    "credits_granted": Decimal128(str(-amount)),
                    "payment_note": note or "Credits revoked by platform admin",
                    "created_at": datetime.now(timezone.utc),
                },
                session=session,
            )

    return round(float(updated["credit_balance"].to_decimal()), 2)


async def reclaim_from_member(
    db: AsyncIOMotorDatabase,
    *,
    organization_id: ObjectId,
    member_user_id: ObjectId,
    credits_to_reclaim: float,
    reclaimed_by_user_id: ObjectId,
) -> dict:
    """Returns {"organization_balance": ..., "member_balance": ...}. Raises 402 if the
    member's own balance genuinely can't cover it, 404 if the member isn't actually in
    this organization.

    Same rounding-noise clamp as revoke_credits: the UI only shows/accepts a balance
    rounded to 2 decimals, but a member's stored balance can carry more precision, so
    "reclaim everything" can submit a hair more than what's actually stored - within a
    cent, this clamps down to the real balance instead of bouncing it."""
    if credits_to_reclaim <= 0:
        raise HTTPException(status_code=400, detail="credits_to_reclaim must be positive")

    async with await db.client.start_session() as session:
        async with session.start_transaction():
            existing_member = await db.users.find_one(
                {"_id": member_user_id, "organization_id": organization_id}, session=session
            )
            if existing_member is None:
                raise HTTPException(status_code=404, detail="Member not found in this organization")

            member_current = float(existing_member["credit_balance"].to_decimal())
            if credits_to_reclaim > member_current:
                if credits_to_reclaim - member_current <= 0.01:
                    credits_to_reclaim = member_current
                else:
                    raise HTTPException(
                        status_code=402,
                        detail=f"Can't reclaim {credits_to_reclaim:g} credits - member's balance is only {round(member_current, 2)}.",
                    )

            if credits_to_reclaim <= 0:
                org_unchanged = await db.organizations.find_one({"_id": organization_id}, session=session)
                return {
                    "organization_balance": round(float(org_unchanged["credit_balance"].to_decimal()), 2),
                    "member_balance": round(member_current, 2),
                }

            amount = Decimal128(str(credits_to_reclaim))
            member = await db.users.find_one_and_update(
                {
                    "_id": member_user_id,
                    "organization_id": organization_id,
                    "credit_balance": {"$gte": amount},
                },
                {"$inc": {"credit_balance": Decimal128(str(-credits_to_reclaim))}},
                return_document=True,
                session=session,
            )
            if member is None:
                raise HTTPException(
                    status_code=409, detail="Member's balance changed concurrently - please retry."
                )

            org = await db.organizations.find_one_and_update(
                {"_id": organization_id},
                {"$inc": {"credit_balance": amount}},
                return_document=True,
                session=session,
            )

            await db.credit_transactions.insert_one(
                {
                    "target_collection": "organizations",
                    "target_id": organization_id,
                    "source_collection": "users",
                    "source_id": member_user_id,
                    "granted_by_user_id": reclaimed_by_user_id,
                    "amount_usd_received": Decimal128("0"),  # internal transfer, not new external funding
                    "credits_granted": amount,
                    "payment_note": "Reclaimed from member back to organization pool",
                    "created_at": datetime.now(timezone.utc),
                },
                session=session,
            )

    return {
        "organization_balance": round(float(org["credit_balance"].to_decimal()), 2),
        "member_balance": round(float(member["credit_balance"].to_decimal()), 2),
    }
