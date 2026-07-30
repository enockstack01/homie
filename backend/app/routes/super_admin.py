from datetime import datetime, timedelta, timezone

from bson import Decimal128, ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.auth import (
    ALL_ROLES,
    ALL_STATUSES,
    ROLE_ORG_ADMIN,
    ROLE_PLATFORM_ADMIN,
    ROLE_SUPER_ADMIN,
    STATUS_ACTIVE,
    get_clerk_client,
    require_platform_staff,
    require_super_admin,
)
from app.db import get_db
from app.services import anthropic_client, credit_engine, credit_transfer
from app.services.clerk_provisioning import get_api_key, issue_api_key
from app.services.organizations import create_organization_doc, ensure_org_id

router = APIRouter(prefix="/v1/super-admin", tags=["super-admin"])


def _oid(raw: str, label: str = "id") -> ObjectId:
    try:
        return ObjectId(raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"{label} is not a valid id") from exc


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


class CreateOrganizationRequest(BaseModel):
    name: str
    admin_email: str
    admin_username: str | None = None
    admin_password: str | None = None


@router.post("/organizations")
async def create_organization(
    request: CreateOrganizationRequest,
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Creates the organization, and makes admin_email its admin - either by making an
    already-existing Homie account that org's admin (a role/organization change, same as
    update_user_role would do, just bundled into one step), or, if no account exists yet
    for that email, by creating a real Clerk account for them too (working email+password
    login immediately, no separate invite/sign-up round trip - this is what
    admin_username/admin_password are for, and why they're only required in this branch).

    Reusing an existing account here instead of rejecting the request with "already
    exists" matters in practice: a super_admin very often wants to hand an org to someone
    who already has a Homie account (mid-onboarding with no organization yet, or already
    leading another org) - that's a routine role change, not a conflict.
    """
    name = request.name.strip()
    email = request.admin_email.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if not email:
        raise HTTPException(status_code=400, detail="admin_email is required")

    existing_user = await db.users.find_one({"email": email})

    if existing_user:
        mongo_org_id, org_id = await create_organization_doc(db, name)
        await db.users.update_one(
            {"_id": existing_user["_id"]},
            {"$set": {"organization_id": mongo_org_id, "role": ROLE_ORG_ADMIN}},
        )
        return {
            "id": str(mongo_org_id),
            "name": name,
            "org_id": org_id,
            "credit_balance": 0.0,
            "admin_email": email,
            "linked_existing_account": True,
        }

    if not request.admin_password:
        raise HTTPException(
            status_code=400,
            detail="admin_password is required when admin_email has no existing account.",
        )

    clerk = get_clerk_client()
    try:
        clerk_user = await clerk.users.create_async(
            email_address=[email],
            username=request.admin_username or None,
            password=request.admin_password,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not create Clerk account: {exc}") from exc

    mongo_org_id, org_id = await create_organization_doc(db, name)
    now = datetime.now(timezone.utc)
    await db.users.insert_one(
        {
            "clerk_user_id": clerk_user.id,
            "email": email,
            "role": ROLE_ORG_ADMIN,
            "organization_id": mongo_org_id,
            "status": STATUS_ACTIVE,
            "credit_balance": Decimal128("0"),
            "created_at": now,
            "updated_at": now,
        }
    )

    return {
        "id": str(mongo_org_id),
        "name": name,
        "org_id": org_id,
        "credit_balance": 0.0,
        "admin_email": email,
        "linked_existing_account": False,
    }


@router.get("/organizations")
async def list_organizations(
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[dict]:
    orgs = []
    async for org in db.organizations.find({}):
        # The org_admin's own account represents the organization itself, not one of its
        # members - counting it here would make a 1-member org read as having 2.
        member_count = await db.users.count_documents(
            {"organization_id": org["_id"], "role": {"$ne": ROLE_ORG_ADMIN}}
        )
        orgs.append(
            {
                "id": str(org["_id"]),
                "name": org["name"],
                "org_id": await ensure_org_id(db, org),
                "credit_balance": round(float(org["credit_balance"].to_decimal()), 2),
                "member_count": member_count,
                "created_at": org["created_at"].isoformat(),
                # Absent on any organization created before this field existed - 0.0 (no
                # markup) is the accurate read for those, same as create_organization_doc's
                # own default.
                "profit_margin_percent": float(org.get("profit_margin_percent", 0.0)),
            }
        )
    return orgs


class RenameOrganizationRequest(BaseModel):
    name: str


@router.patch("/organizations/{org_id}")
async def rename_organization(
    org_id: str,
    request: RenameOrganizationRequest,
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Mainly for organizations update_user_role auto-created with a generic
    "{email}'s Organization" name - gives the admin a way to fix that afterward."""
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    updated = await db.organizations.find_one_and_update(
        {"_id": _oid(org_id, "org_id")}, {"$set": {"name": name}}, return_document=True
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"id": str(updated["_id"]), "name": updated["name"]}


class GrantRequest(BaseModel):
    amount_usd_received: float
    payment_note: str = ""


class RevokeRequest(BaseModel):
    amount: float
    note: str = ""


@router.post("/organizations/{org_id}/grant-credits")
async def grant_credits_to_organization(
    org_id: str,
    request: GrantRequest,
    admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    new_balance = await credit_transfer.grant_external(
        db,
        target_collection="organizations",
        target_id=_oid(org_id, "org_id"),
        amount_usd_received=request.amount_usd_received,
        payment_note=request.payment_note,
        granted_by_user_id=admin["_id"],
    )
    return {"organization_id": org_id, "new_balance": new_balance}


@router.post("/organizations/{org_id}/revoke-credits")
async def revoke_organization_credits(
    org_id: str,
    request: RevokeRequest,
    admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Removes a specified amount from an organization's unallocated pool - does not touch
    what members have already been allocated out of it, only what's still sitting in the
    pool."""
    new_balance = await credit_transfer.revoke_credits(
        db,
        target_collection="organizations",
        target_id=_oid(org_id, "org_id"),
        amount=request.amount,
        revoked_by_user_id=admin["_id"],
        note=request.note,
    )
    return {"organization_id": org_id, "new_balance": new_balance}


class SetOrgAdminRequest(BaseModel):
    user_id: str


@router.post("/organizations/{org_id}/set-admin")
async def set_organization_admin(
    org_id: str,
    request: SetOrgAdminRequest,
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Promotes an existing member of this org to org_admin. The member must already be
    in the org - this endpoint only changes their role, it doesn't move them between
    orgs. For a general-purpose role change on any user, see update_user_role below."""
    org_oid = _oid(org_id, "org_id")
    if not await db.organizations.find_one({"_id": org_oid}):
        raise HTTPException(status_code=404, detail="Organization not found")

    updated = await db.users.find_one_and_update(
        {"_id": _oid(request.user_id, "user_id"), "organization_id": org_oid},
        {"$set": {"role": ROLE_ORG_ADMIN}},
        return_document=True,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="User is not a member of this organization")

    return {"id": str(updated["_id"]), "role": updated["role"]}


# ---------------------------------------------------------------------------
# Users (platform-wide - every organization's members, plus platform staff)
# ---------------------------------------------------------------------------


def _serialize_user(u: dict, org_name: str | None) -> dict:
    return {
        "id": str(u["_id"]),
        "email": u.get("email"),
        "role": u.get("role"),
        "status": u.get("status"),
        "organization_id": str(u["organization_id"]) if u.get("organization_id") else None,
        "organization_name": org_name,
        # Set only for someone invited by email who hasn't accepted yet (see
        # org_admin.add_member/routes/invitations.py) - lets the super-admin org detail
        # page (admin-dashboard's [id]/page.tsx) show a complete member list for that
        # org, not just confirmed members, the same completeness org_admin.list_members
        # already gives that org's own admin.
        "pending_organization_id": str(u["pending_organization_id"]) if u.get("pending_organization_id") else None,
        "has_api_key": bool(u.get("machine_id")),
        "credit_balance": round(float(u["credit_balance"].to_decimal()), 2),
    }


@router.get("/users")
async def list_users(
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[dict]:
    users = []
    async for u in db.users.find({}):
        org_name = None
        if u.get("organization_id"):
            org = await db.organizations.find_one({"_id": u["organization_id"]}, {"name": 1})
            org_name = org.get("name") if org else None
        users.append(_serialize_user(u, org_name))
    return users


@router.post("/users/{user_id}/grant-credits")
async def grant_credits_to_user(
    user_id: str,
    request: GrantRequest,
    admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Direct top-up of a user's own balance - a support override, since normal funding
    for an organization member goes through that org's own allocate-credits instead."""
    new_balance = await credit_transfer.grant_external(
        db,
        target_collection="users",
        target_id=_oid(user_id, "user_id"),
        amount_usd_received=request.amount_usd_received,
        payment_note=request.payment_note,
        granted_by_user_id=admin["_id"],
    )
    return {"user_id": user_id, "new_balance": new_balance}


@router.post("/users/{user_id}/revoke-credits")
async def revoke_user_credits(
    user_id: str,
    request: RevokeRequest,
    admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Removes a specified amount from a user's own balance - a support override, same as
    grant_credits_to_user above."""
    new_balance = await credit_transfer.revoke_credits(
        db,
        target_collection="users",
        target_id=_oid(user_id, "user_id"),
        amount=request.amount,
        revoked_by_user_id=admin["_id"],
        note=request.note,
    )
    return {"user_id": user_id, "new_balance": new_balance}


class IssueApiKeyResponse(BaseModel):
    api_key: str


@router.post("/users/{user_id}/issue-api-key", response_model=IssueApiKeyResponse)
async def issue_user_api_key(
    user_id: str,
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> IssueApiKeyResponse:
    user_oid = _oid(user_id, "user_id")
    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    label = user.get("email") or str(user_oid)
    secret = await issue_api_key(db, user_id=user_oid, name=f"Homie - {label}")
    return IssueApiKeyResponse(api_key=secret)


class ApiKeyResponse(BaseModel):
    api_key: str | None


@router.get("/users/{user_id}/api-key", response_model=ApiKeyResponse)
async def get_user_api_key(
    user_id: str,
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ApiKeyResponse:
    """Platform-wide: a super_admin (or platform_admin) can view any user's current key,
    not just the one they personally issued - visible per user everywhere, per the
    platform's own requirement, not just at the moment of issuance."""
    user = await db.users.find_one({"_id": _oid(user_id, "user_id")})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return ApiKeyResponse(api_key=await get_api_key(user))


class SetRoleRequest(BaseModel):
    role: str


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    request: SetRoleRequest,
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    General-purpose role change for any user, unlike set_organization_admin (which only
    promotes within one specific org). Enforces the one invariant a super_admin/
    platform_admin must hold: neither is ever scoped to an org (promoting to either
    clears organization_id). There is no "detach from organization" action here - every
    member is required to belong to one (see app/auth.py's role docstring); demoting a
    member out of an org isn't a role change, it's org_admin's remove_member.

    Promoting someone straight to org_admin with no organization doesn't error - it
    auto-creates one for them (named after their email, renameable afterward via
    rename_organization) and puts them in it. This is the same one-click role-change UX
    as everything else on this page; making the admin go create an org first and come
    back would just be a worse version of doing it here.
    """
    if request.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {ALL_ROLES}")

    user_oid = _oid(user_id, "user_id")
    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update: dict = {"role": request.role}
    if request.role in (ROLE_SUPER_ADMIN, ROLE_PLATFORM_ADMIN):
        update["organization_id"] = None
    elif request.role == ROLE_ORG_ADMIN and not user.get("organization_id"):
        label = user.get("email") or str(user_oid)
        new_org_id, _ = await create_organization_doc(db, f"{label}'s Organization")
        update["organization_id"] = new_org_id

    updated = await db.users.find_one_and_update(
        {"_id": user_oid}, {"$set": update}, return_document=True
    )
    return {
        "id": str(updated["_id"]),
        "role": updated["role"],
        "organization_id": str(updated["organization_id"]) if updated.get("organization_id") else None,
    }


class SetStatusRequest(BaseModel):
    status: str


async def _hard_delete_user(db: AsyncIOMotorDatabase, user: dict) -> None:
    """
    "Deleted" isn't a label a user document sits in - it's the trigger for actually
    removing them, per the platform's requirement that a deleted user disappears
    everywhere, not just gets flagged. Their Clerk identity/identities go first (a real
    Clerk user for dashboard sign-in, a Machine for the desktop Add-in, either, neither,
    or - in principle - both), then the Mongo doc itself. usage_logs and
    credit_transactions are deliberately left alone: they're audit/billing history, keyed
    by an ObjectId that simply won't resolve to a live user afterward, not something a
    delete should be able to erase.
    """
    clerk = get_clerk_client()

    clerk_user_id = user.get("clerk_user_id")
    if clerk_user_id:
        try:
            await clerk.users.delete_async(user_id=clerk_user_id)
        except Exception:
            pass  # Already gone/revoked on Clerk's side - not a reason to abort the delete.

    machine_id = user.get("machine_id")
    if machine_id:
        try:
            await clerk.machines.delete_async(machine_id=machine_id)
        except Exception:
            pass

    await db.users.delete_one({"_id": user["_id"]})


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    request: SetStatusRequest,
    admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """pending/active/banned - a normal field update (see auth.py's STATUS_* constants
    and _reject_if_blocked for what each gates). "deleted" is different: it actually
    removes the user (see _hard_delete_user) rather than persisting a status value - by
    the time this returns, there is no user document left to have a status at all."""
    if request.status not in ALL_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {ALL_STATUSES}")

    user_oid = _oid(user_id, "user_id")

    if request.status == "deleted":
        if user_oid == admin["_id"]:
            raise HTTPException(
                status_code=400,
                detail="You can't delete your own account - have another super_admin do it.",
            )
        user = await db.users.find_one({"_id": user_oid})
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        await _hard_delete_user(db, user)
        return {"id": user_id, "deleted": True}

    updated = await db.users.find_one_and_update(
        {"_id": user_oid},
        {"$set": {"status": request.status}},
        return_document=True,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")

    return {"id": str(updated["_id"]), "status": updated["status"]}


# ---------------------------------------------------------------------------
# Platform-wide usage / transactions
# ---------------------------------------------------------------------------


async def _batch_user_emails(db: AsyncIOMotorDatabase, user_ids: list[ObjectId]) -> dict[ObjectId, str | None]:
    """One query for every distinct user_id in a page of logs, instead of one find_one per
    row - this system has no separate "username" (Clerk sign-in here is email/password
    only, see docs/BLUEPRINT.md Section 3), so email is the only human-readable identity
    a usage log can show beyond the raw ObjectId."""
    if not user_ids:
        return {}
    emails: dict[ObjectId, str | None] = {}
    async for u in db.users.find({"_id": {"$in": list(set(user_ids))}}, {"email": 1}):
        emails[u["_id"]] = u.get("email")
    return emails


@router.get("/usage-logs")
async def list_usage_logs(
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
    limit: int = 100,
) -> list[dict]:
    raw_logs = await db.usage_logs.find({}).sort("timestamp", -1).limit(min(limit, 500)).to_list(length=None)
    emails = await _batch_user_emails(db, [log["user_id"] for log in raw_logs])

    logs = []
    for log in raw_logs:
        # Absent on any log written before organization margins existed - 0 (no margin
        # earned) is the accurate read for those, same as an organization that's never
        # set one.
        org_margin = log.get("org_margin_credits")
        logs.append(
            {
                "user_id": str(log["user_id"]),
                "user_email": emails.get(log["user_id"]),
                "model_id": log["model_id"],
                "input_tokens": log["input_tokens"],
                "output_tokens": log["output_tokens"],
                "credits_deducted": round(float(log["credits_deducted"].to_decimal()), 4),
                # An organization's own retained profit within credits_deducted above
                # (see credit_engine.apply_organization_margin) - not part of Homie's own
                # margin over Anthropic, which raw_api_cost_usd/user_billed_usd on
                # get_anthropic_spend below track separately and unaffected by this.
                "org_margin_credits": round(float(org_margin.to_decimal()), 4) if org_margin else 0.0,
                "timestamp": log["timestamp"].isoformat(),
            }
        )
    return logs


@router.get("/credit-transactions")
async def list_credit_transactions(
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
    limit: int = 100,
) -> list[dict]:
    """Read-only audit trail of all credit movement platform-wide: external grants (to
    orgs or directly to a user as a support override) and internal org-to-member
    allocations alike."""
    txns = []
    cursor = db.credit_transactions.find({}).sort("created_at", -1).limit(min(limit, 500))
    async for txn in cursor:
        granter = await db.users.find_one({"_id": txn["granted_by_user_id"]}, {"email": 1})
        txns.append(
            {
                "target_collection": txn["target_collection"],
                "target_id": str(txn["target_id"]),
                "granted_by_email": granter.get("email") if granter else None,
                "amount_usd_received": round(float(txn["amount_usd_received"].to_decimal()), 2),
                "credits_granted": round(float(txn["credits_granted"].to_decimal()), 2),
                "payment_note": txn.get("payment_note", ""),
                "created_at": txn["created_at"].isoformat(),
            }
        )
    return txns


# ---------------------------------------------------------------------------
# Platform resources - model pricing (the rate card credit_engine prices every request
# against). Previously only editable via scripts/seed_model_pricing.py + direct DB
# access; exposed here so a super_admin can adjust rates/markup or retire a model
# without shelling into the database.
#
# Every mutating route in this section uses require_super_admin, NOT
# require_platform_staff - this is the one deliberate gap between the two roles (see
# app/auth.py). The read-only routes (list_model_pricing, get_anthropic_api_key,
# get_credit_rate, get_anthropic_spend) use require_platform_staff like everything else,
# since "can't change platform resources" was never "can't see them".
# ---------------------------------------------------------------------------


def _serialize_model(m: dict) -> dict:
    return {
        "id": m["_id"],
        "model_id": m["model_id"],
        "display_name": m.get("display_name", m["model_id"]),
        "anthropic_input_per_m": float(m["anthropic_input_per_m"]),
        "anthropic_output_per_m": float(m["anthropic_output_per_m"]),
        "markup_multiplier": float(m["markup_multiplier"]),
        "is_active": m.get("is_active", False),
    }


@router.get("/model-pricing")
async def list_model_pricing(
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[dict]:
    models = []
    async for m in db.model_pricing.find({}):
        models.append(_serialize_model(m))
    return models


class UpdateModelPricingRequest(BaseModel):
    anthropic_input_per_m: float | None = None
    anthropic_output_per_m: float | None = None
    markup_multiplier: float | None = None
    is_active: bool | None = None


@router.patch("/model-pricing/{pricing_id}")
async def update_model_pricing(
    pricing_id: str,
    request: UpdateModelPricingRequest,
    _admin: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Validates every field that can affect the platform's guaranteed margin BEFORE writing
    anything - a rejected update must never partially apply. anthropic_input_per_m/
    anthropic_output_per_m must stay positive (a zero or negative Anthropic-side rate makes
    "margin" meaningless - Anthropic never charges $0, so billing $0 would be a pure loss);
    markup_multiplier must not drop below credit_engine.MINIMUM_MARKUP_MULTIPLIER (see
    assert_meets_minimum_margin - the margin ratio is scale-invariant, so this is checked
    independently of whatever the raw rates are, not recomputed against them).

    require_super_admin (not require_platform_staff): changing the rate card is the one
    thing platform_admin can't do - see app/auth.py.
    """
    update = {k: v for k, v in request.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")

    for field in ("anthropic_input_per_m", "anthropic_output_per_m"):
        if field in update and update[field] <= 0:
            raise HTTPException(status_code=400, detail=f"{field} must be positive")

    if "markup_multiplier" in update:
        try:
            credit_engine.assert_meets_minimum_margin(update["markup_multiplier"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = await db.model_pricing.find_one_and_update(
        {"_id": pricing_id}, {"$set": update}, return_document=True
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Model pricing entry not found")
    return _serialize_model(updated)


# ---------------------------------------------------------------------------
# Anthropic API key - the gateway's own key it calls Anthropic with, distinct
# from the per-user Homie keys members use to call this gateway.
# ---------------------------------------------------------------------------


class SetAnthropicKeyRequest(BaseModel):
    api_key: str


@router.get("/anthropic-api-key")
async def get_anthropic_api_key(
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    return {"api_key": await anthropic_client.get_current_key(db)}


@router.post("/anthropic-api-key")
async def set_anthropic_api_key(
    request: SetAnthropicKeyRequest,
    admin: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """require_super_admin (not require_platform_staff): setting the platform's Anthropic
    key is a platform-resource change - see app/auth.py."""
    key = request.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="api_key is required")
    await anthropic_client.set_key(db, new_key=key, updated_by_user_id=admin["_id"])
    return {"api_key": key}


@router.post("/anthropic-api-key/invalidate")
async def invalidate_anthropic_api_key(
    admin: dict = Depends(require_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Clears the key so nothing on the platform can call Anthropic until a super_admin
    sets a new one - see anthropic_client.invalidate_key for why this is a local kill
    switch rather than a real remote key revocation (Anthropic has no API for that).
    require_super_admin (not require_platform_staff): same platform-resource carve-out as
    set_anthropic_api_key above."""
    await anthropic_client.invalidate_key(db, updated_by_user_id=admin["_id"])
    return {"api_key": None}


async def _spend_totals(db: AsyncIOMotorDatabase, match: dict) -> dict:
    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": None,
                "raw_cost_usd": {"$sum": "$raw_api_cost_usd"},
                "billed_usd": {"$sum": "$user_billed_usd"},
                "request_count": {"$sum": 1},
            }
        },
    ]
    result = await db.usage_logs.aggregate(pipeline).to_list(length=1)
    if not result:
        return {"anthropic_cost_usd": 0.0, "billed_to_users_usd": 0.0, "realized_margin_usd": 0.0, "request_count": 0}

    doc = result[0]
    raw_cost_usd = float(doc["raw_cost_usd"].to_decimal())
    billed_usd = float(doc["billed_usd"].to_decimal())
    return {
        "anthropic_cost_usd": round(raw_cost_usd, 4),
        "billed_to_users_usd": round(billed_usd, 2),
        "realized_margin_usd": round(billed_usd - raw_cost_usd, 4),
        "request_count": doc["request_count"],
    }


@router.get("/credit-rate")
async def get_credit_rate(_admin: dict = Depends(require_platform_staff)) -> dict:
    """The fixed USD<->credit conversion every grant/allocation/deduction on the platform
    uses (see credit_engine.py's module docstring and docs/BLUEPRINT.md Section 4), plus
    the minimum markup_multiplier update_model_pricing enforces - exposed so the dashboard
    (the calculator, and the model-pricing edit form's own hint text) derives from the same
    single source of truth as the actual billing math, instead of hardcoded numbers in
    TypeScript that could silently drift from the real rate/guardrail."""
    return {
        "credits_per_usd": credit_engine.CREDITS_PER_USD,
        "minimum_markup_multiplier": credit_engine.MINIMUM_MARKUP_MULTIPLIER,
        "minimum_margin": credit_engine.MINIMUM_MARGIN,
    }


@router.get("/anthropic-spend")
async def get_anthropic_spend(
    _admin: dict = Depends(require_platform_staff),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Anthropic has no API endpoint for a prepaid account's remaining credit balance at all
    (confirmed - there is no GET .../balance; the only authoritative number lives in the
    Anthropic Console's billing page, console_url below). What this CAN show, built from
    data the gateway already records on every request: the real Anthropic-side cost every
    call has actually incurred (usage_logs.raw_api_cost_usd - pre-markup, computed in
    credit_engine.compute_final_charge) versus what was billed to users, i.e. this
    platform's own tracked draw against whatever balance is loaded in the Anthropic
    Console. A super_admin can read that Console balance and this endpoint's
    anthropic_cost_usd together to gauge runway, which is as close as this can get without
    Anthropic exposing the number itself.
    """
    since_30d = datetime.now(timezone.utc) - timedelta(days=30)

    return {
        "all_time": await _spend_totals(db, {}),
        "last_30_days": await _spend_totals(db, {"timestamp": {"$gte": since_30d}}),
        "console_url": "https://console.anthropic.com/settings/billing",
    }
