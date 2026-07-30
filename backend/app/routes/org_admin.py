from datetime import datetime, timezone

from bson import Decimal128, ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.auth import (
    ROLE_MEMBER,
    STATUS_ACTIVE,
    STATUS_BANNED,
    STATUS_PENDING,
    get_clerk_client,
    require_org_admin,
)
from app.db import get_db
from app.services import credit_engine, credit_transfer
from app.services.clerk_provisioning import get_api_key, issue_api_key
from app.services.organizations import ensure_org_id

router = APIRouter(prefix="/v1/org-admin", tags=["org-admin"])


def _oid(raw: str, label: str = "id") -> ObjectId:
    try:
        return ObjectId(raw)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"{label} is not a valid id") from exc


@router.get("/organization")
async def get_my_organization(
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    org = await db.organizations.find_one({"_id": admin["organization_id"]})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "id": str(org["_id"]),
        "name": org["name"],
        "org_id": await ensure_org_id(db, org),
        "credit_balance": round(float(org["credit_balance"].to_decimal()), 2),
        # Absent on any organization created before this field existed - 0.0 (no markup,
        # identical to not having one at all) is the same default create_organization_doc
        # gives every new organization.
        "profit_margin_percent": float(org.get("profit_margin_percent", 0.0)),
    }


class SetProfitMarginRequest(BaseModel):
    margin_percent: float


@router.patch("/organization/profit-margin")
async def update_profit_margin(
    request: SetProfitMarginRequest,
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    The organization's own additional margin on top of Homie's already-marked-up price
    (see credit_engine.apply_organization_margin) - applied when one of this
    organization's members spends credits (routes/chat.py's handle_chat_request), with
    the extra amount credited back into this organization's own pool as retained profit.
    0-100%, self-service, no minimum required - unlike the platform's own guaranteed
    margin (credit_engine.MINIMUM_MARGIN), this is entirely the organization's own choice
    about its own credit pool.
    """
    try:
        credit_engine.assert_valid_organization_margin(request.margin_percent)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = await db.organizations.find_one_and_update(
        {"_id": admin["organization_id"]},
        {"$set": {"profit_margin_percent": request.margin_percent}},
        return_document=True,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "id": str(updated["_id"]),
        "profit_margin_percent": float(updated["profit_margin_percent"]),
    }


@router.get("/members")
async def list_members(
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[dict]:
    org_id = admin["organization_id"]
    members = []
    # Confirmed members (organization_id) AND people who've been invited but haven't
    # accepted yet (pending_organization_id) both belong on this list - an invite an
    # org_admin can't even see would be useless. The admin's own account is excluded: it
    # represents the organization itself, not one of its members, and is already managed
    # via the separate "Your Homie API key" card on this same page.
    async for u in db.users.find({"$or": [{"organization_id": org_id}, {"pending_organization_id": org_id}]}):
        if u["_id"] == admin["_id"]:
            continue
        members.append(
            {
                "id": str(u["_id"]),
                "email": u.get("email"),
                "role": u.get("role"),
                "status": u.get("status"),
                "has_api_key": bool(u.get("machine_id")),
                "credit_balance": round(float(u["credit_balance"].to_decimal()), 2),
                "invite_accepted": u.get("organization_id") == org_id,
            }
        )
    return members


class AddMemberRequest(BaseModel):
    email: str


@router.post("/members")
async def add_member(
    request: AddMemberRequest,
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Invites a person to this org by email - this never errors "already exists", because
    an existing Homie account is the *normal* case, not a conflict: someone mid-onboarding
    with no organization yet, or who leads another org already, can still be invited here.
    Either way, they only actually become a member once they accept (see
    routes/invitations.py) - this only ever sets pending_organization_id, never
    organization_id directly.

    Three cases:
    - Already has a Homie account (found in `users` by email): just point their
      pending_organization_id at this org. Their platform status/role/other org
      membership, if any, is untouched until they accept.
    - Has a Clerk account but no Homie account yet: create one, linked (clerk_user_id
      set), status active (a real Clerk identity is already validated).
    - Has neither: create a placeholder doc with no clerk_user_id (sparse-index safe -
      see db.py), status pending. auth.get_current_user's pending-invite-by-email
      backfill links clerk_user_id the moment they actually sign in - but that alone no
      longer makes them a member, only eligible to see and accept the invite.
    """
    email = request.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email is required")

    org_id = admin["organization_id"]

    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        if existing_user.get("organization_id") == org_id:
            return {"id": str(existing_user["_id"]), "email": email, "already_a_member": True}
        await db.users.update_one(
            {"_id": existing_user["_id"]}, {"$set": {"pending_organization_id": org_id}}
        )
        return {"id": str(existing_user["_id"]), "email": email, "invited_existing_account": True}

    clerk = get_clerk_client()
    existing_clerk_users = await clerk.users.list_async(
        request={"email_address": [email]}  # type: ignore[arg-type]
    )
    clerk_user_id = existing_clerk_users[0].id if existing_clerk_users else None

    now = datetime.now(timezone.utc)
    doc = {
        "email": email,
        "role": ROLE_MEMBER,
        "organization_id": None,
        "pending_organization_id": org_id,
        "status": STATUS_ACTIVE if clerk_user_id else STATUS_PENDING,
        "credit_balance": Decimal128("0"),
        "created_at": now,
        "updated_at": now,
    }
    if clerk_user_id:
        doc["clerk_user_id"] = clerk_user_id
    # else: clerk_user_id intentionally omitted (see docstring above).

    result = await db.users.insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "email": email,
        "pending_invite": clerk_user_id is None,
    }


@router.delete("/members/{user_id}")
async def remove_member(
    user_id: str,
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Removes a member (or retracts a not-yet-accepted invitation) from this org - does
    not delete their account or touch their remaining balance, so nothing they've already
    been allocated evaporates; it just stops counting as (or being invited to) this org."""
    org_id = admin["organization_id"]
    updated = await db.users.find_one_and_update(
        {"_id": _oid(user_id, "user_id"), "$or": [{"organization_id": org_id}, {"pending_organization_id": org_id}]},
        {"$set": {"organization_id": None, "pending_organization_id": None, "role": ROLE_MEMBER}},
        return_document=True,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Member not found in this organization")
    return {"id": str(updated["_id"]), "removed": True}


ORG_ADMIN_ALLOWED_STATUSES = (STATUS_ACTIVE, STATUS_PENDING, STATUS_BANNED)


class SetMemberStatusRequest(BaseModel):
    status: str


@router.patch("/members/{user_id}/status")
async def update_member_status(
    user_id: str,
    request: SetMemberStatusRequest,
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Lets an org_admin ban, reinstate, or reset a member of their *own* org - narrower
    than super_admin's update_user_status: no "deleted" here (that's a real, irreversible,
    platform-wide account deletion - reserved for the platform admin, see
    routes/super_admin.py's _hard_delete_user), and scoped to confirmed members of this
    org_admin's organization only (not pending invites - those are managed via
    remove_member's "cancel invite" instead). Banning blocks the account (enforced by
    auth.py's _reject_if_blocked) without detaching them from the org the way remove_member
    does - their allocated balance and org membership stay intact, just unusable."""
    target_id = _oid(user_id, "user_id")
    if target_id == admin["_id"]:
        raise HTTPException(status_code=400, detail="You can't change your own status.")
    if request.status not in ORG_ADMIN_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of: {', '.join(ORG_ADMIN_ALLOWED_STATUSES)}",
        )

    updated = await db.users.find_one_and_update(
        {"_id": target_id, "organization_id": admin["organization_id"]},
        {"$set": {"status": request.status}},
        return_document=True,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Member not found in this organization")
    return {"id": str(updated["_id"]), "status": updated["status"]}


class AllocateRequest(BaseModel):
    credits: float


@router.post("/members/{user_id}/allocate-credits")
async def allocate_credits(
    user_id: str,
    request: AllocateRequest,
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    # An org_admin is also a member of the org they administer, and shows up in their own
    # /members list - without this check they could unilaterally move the shared pool
    # into their own personal balance with no other party involved at all. Allocation is
    # for funding *other* members; moving credits into the admin's own balance isn't a
    # thing this action is meant to do.
    if _oid(user_id, "user_id") == admin["_id"]:
        raise HTTPException(status_code=400, detail="You can't allocate credits to yourself.")

    return await credit_transfer.allocate_from_organization(
        db,
        organization_id=admin["organization_id"],
        member_user_id=_oid(user_id, "user_id"),
        credits_to_allocate=request.credits,
        allocated_by_user_id=admin["_id"],
    )


class ReclaimRequest(BaseModel):
    credits: float


@router.post("/members/{user_id}/reclaim-credits")
async def reclaim_credits(
    user_id: str,
    request: ReclaimRequest,
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """The inverse of allocate-credits: moves a specified amount back out of a member's
    own balance and into this organization's pool. Same self-allocation guard as
    allocate-credits - an admin can't reclaim from themselves through this action."""
    if _oid(user_id, "user_id") == admin["_id"]:
        raise HTTPException(status_code=400, detail="You can't reclaim credits from yourself.")

    return await credit_transfer.reclaim_from_member(
        db,
        organization_id=admin["organization_id"],
        member_user_id=_oid(user_id, "user_id"),
        credits_to_reclaim=request.credits,
        reclaimed_by_user_id=admin["_id"],
    )


class IssueApiKeyResponse(BaseModel):
    api_key: str


@router.post("/members/{user_id}/issue-api-key", response_model=IssueApiKeyResponse)
async def issue_member_api_key(
    user_id: str,
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> IssueApiKeyResponse:
    user_oid = _oid(user_id, "user_id")
    member = await db.users.find_one({"_id": user_oid, "organization_id": admin["organization_id"]})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this organization")

    label = member.get("email") or str(user_oid)
    secret = await issue_api_key(db, user_id=user_oid, name=f"Homie - {label}")
    return IssueApiKeyResponse(api_key=secret)


class ApiKeyResponse(BaseModel):
    api_key: str | None


@router.get("/members/{user_id}/api-key", response_model=ApiKeyResponse)
async def get_member_api_key(
    user_id: str,
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ApiKeyResponse:
    """An org_admin can view any of their own org's members' current keys - scoped the
    same way every other org_admin action is (organization_id must match their own)."""
    member = await db.users.find_one(
        {"_id": _oid(user_id, "user_id"), "organization_id": admin["organization_id"]}
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this organization")
    return ApiKeyResponse(api_key=await get_api_key(member))


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
async def list_org_usage_logs(
    admin: dict = Depends(require_org_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
    limit: int = 100,
) -> list[dict]:
    raw_logs = await (
        db.usage_logs.find({"organization_id": admin["organization_id"]})
        .sort("timestamp", -1)
        .limit(min(limit, 500))
        .to_list(length=None)
    )
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
                # This organization's own retained profit within credits_deducted above
                # (see credit_engine.apply_organization_margin) - not a separate charge.
                "org_margin_credits": round(float(org_margin.to_decimal()), 4) if org_margin else 0.0,
                "timestamp": log["timestamp"].isoformat(),
            }
        )
    return logs
