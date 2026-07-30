from datetime import datetime, timezone
from typing import Any

from bson import Decimal128
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.auth import ROLE_MEMBER, ROLE_ORG_ADMIN, get_current_user
from app.db import get_db
from app.services import credit_engine
from app.services.anthropic_client import count_input_tokens, create_message
from app.services.clerk_provisioning import get_api_key, issue_api_key
from app.services.organizations import create_organization_doc

router = APIRouter(prefix="/v1", tags=["chat"])

DEFAULT_MAX_TOKENS = 4096


class ChatRequest(BaseModel):
    """
    Mirrors the shape of Anthropic's own Messages API (messages/system/tools/max_tokens)
    rather than a single "prompt" string - the ArcGIS Pro Add-in runs a multi-turn,
    tool-use agentic loop (it calls real geoprocessing tools in-process based on Claude's
    tool_use responses), so this endpoint has to carry the whole running conversation and
    tool definitions on every turn, not just one message. This gateway is a metered proxy
    in front of Anthropic's Messages API, not a separate simplified Q&A endpoint.

    model_id is accepted-but-ignored: which model actually gets called and billed is
    always the account's own preferred_model_id (see /v1/my-model), never client input -
    billing must never trust what the caller says it wants to use. Kept optional here
    only so an older client that still sends one doesn't fail request validation.
    """

    model_id: str | None = None
    messages: list[dict[str, Any]]
    system: str | list[dict[str, Any]] | None = None
    tools: list[dict[str, Any]] | None = None
    max_tokens: int = DEFAULT_MAX_TOKENS


@router.get("/me")
async def whoami(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Lets the Add-in (or the dashboard) show 'signed in as X, N credits remaining,
    part of org Y' without spending any credits, and lets the dashboard decide which
    portal (super-admin / org-admin / member) to route a freshly signed-in user into."""
    org_name = None
    if user.get("organization_id"):
        org = await db.organizations.find_one({"_id": user["organization_id"]}, {"name": 1})
        org_name = org.get("name") if org else None

    pending_org_name = None
    if user.get("pending_organization_id"):
        pending_org = await db.organizations.find_one(
            {"_id": user["pending_organization_id"]}, {"name": 1}
        )
        pending_org_name = pending_org.get("name") if pending_org else None

    return {
        "id": str(user["_id"]),
        "email": user.get("email"),
        "role": user.get("role"),
        "status": user.get("status"),
        "organization_id": str(user["organization_id"]) if user.get("organization_id") else None,
        "organization_name": org_name,
        "pending_organization_name": pending_org_name,
        "has_api_key": bool(user.get("machine_id")),
        "credit_balance": round(float(user["credit_balance"].to_decimal()), 2),
        "preferred_model_id": user.get("preferred_model_id"),
    }


class RegisterOrganizationRequest(BaseModel):
    name: str


@router.post("/register-organization")
async def register_organization(
    request: RegisterOrganizationRequest,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Self-service organization creation - one of the two choices every brand-new signup is
    given on the dashboard's /welcome screen (see
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL and join_organization below for the
    other); there is no standing "no organization" account type on this platform, so
    every self-signup resolves one of these two ways before they can do anything else.
    The only other way an organization gets created is a super_admin doing it directly
    (routes/super_admin.py's create_organization); this is the same underlying
    create_organization_doc, just self-service and scoped to the caller's own account.

    Deliberately only callable once, by whoever get_current_user's auto-provisioning left
    in the default state (role=member, no organization_id) - a member already in an
    organization, or already an org_admin/platform_admin/super_admin, has nothing sensible
    to "register" here, so this 400s rather than silently creating a second organization
    or re-parenting an existing account.
    """
    if user.get("role") != ROLE_MEMBER or user.get("organization_id"):
        raise HTTPException(
            status_code=400,
            detail="Only an account with no existing organization can register one.",
        )

    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    mongo_org_id, org_id = await create_organization_doc(db, name)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"role": ROLE_ORG_ADMIN, "organization_id": mongo_org_id}},
    )

    return {"organization_id": str(mongo_org_id), "organization_name": name, "org_id": org_id}


class JoinOrganizationRequest(BaseModel):
    org_id: str


@router.post("/join-organization")
async def join_organization(
    request: JoinOrganizationRequest,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Self-service membership request - the other of the two /welcome choices (see
    register_organization above). The caller enters an existing organization's own
    human-readable org_id (generated once at creation - see
    services/organizations.create_organization_doc - and shown on that org's org-admin
    dashboard so it can be shared with prospective members), and is matched to it
    directly.

    This only ever sets organization_id, never role or status - the caller joins as a
    plain member, not promoted the way register_organization promotes its caller to
    org_admin, and stays whatever status get_current_user's auto-provisioning already
    left them at (STATUS_PENDING for a brand-new signup). That's deliberate: org_admin.
    list_members already surfaces anyone with organization_id set regardless of status,
    so the org's own org_admin sees this member show up right away and can approve them
    (flip pending -> active) via the same update_member_status control used for every
    other member - no separate "approve join request" endpoint needed.
    """
    if user.get("role") != ROLE_MEMBER or user.get("organization_id"):
        raise HTTPException(
            status_code=400,
            detail="Only an account with no existing organization can join one.",
        )

    org_id = request.org_id.strip().lower()
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID is required")

    org = await db.organizations.find_one({"org_id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="No organization found with that ID.")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"organization_id": org["_id"]}},
    )

    return {"organization_id": str(org["_id"]), "organization_name": org["name"]}


@router.get("/my-api-key")
async def my_api_key(user: dict = Depends(get_current_user)) -> dict:
    """Lets a member see their own current Homie API key on their own dashboard - the
    whole point of Clerk Machines supporting re-fetch (see clerk_provisioning.get_api_key)
    instead of a one-time reveal is that this doesn't need its own "issue" step first."""
    return {"api_key": await get_api_key(user)}


@router.post("/my-api-key/issue")
async def issue_my_api_key(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Self-service issue/rotate, for any account (member, org_admin, super_admin alike) -
    unlike issue_api_key's other two callers (super_admin/org_admin routes, which target
    *someone else's* user_id), this always targets the caller's own account, no elevated
    role required. If a key is ever compromised, or someone just wants a fresh one, they
    shouldn't have to find an admin to do it for them.
    """
    label = user.get("email") or str(user["_id"])
    secret = await issue_api_key(db, user_id=user["_id"], name=f"Homie - {label}")
    return {"api_key": secret}


@router.get("/available-models")
async def list_available_models(
    _user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[dict]:
    """The models a user can choose from for /v1/my-model - only ever the ones a
    super_admin has activated on the platform's rate card (routes/super_admin.py's
    model-pricing endpoints). Exposes the *billed* rate only (Anthropic's own per-token
    cost and the markup multiplier that produces it stay internal - see
    credit_engine.billed_rate_per_million), so a user can compare cost without seeing the
    platform's margin structure."""
    models = []
    async for m in db.model_pricing.find({"is_active": True}):
        anthropic_input_per_m = float(m["anthropic_input_per_m"])
        anthropic_output_per_m = float(m["anthropic_output_per_m"])
        markup_multiplier = float(m["markup_multiplier"])
        models.append(
            {
                "model_id": m["model_id"],
                "display_name": m.get("display_name", m["model_id"]),
                "billed_input_credits_per_m": round(
                    credit_engine.usd_to_credits(
                        credit_engine.billed_rate_per_million(anthropic_input_per_m, markup_multiplier)
                    ),
                    2,
                ),
                "billed_output_credits_per_m": round(
                    credit_engine.usd_to_credits(
                        credit_engine.billed_rate_per_million(anthropic_output_per_m, markup_multiplier)
                    ),
                    2,
                ),
            }
        )
    return models


class SetMyModelRequest(BaseModel):
    model_id: str


@router.post("/my-model")
async def set_my_model(
    request: SetMyModelRequest,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """Self-service, every role alike - the account's own choice of which active model
    their API key uses for every future /v1/chat call. Must be one of the platform's
    currently active models; picking a retired or unknown model_id is rejected outright
    rather than silently falling back to something else."""
    model = await db.model_pricing.find_one({"model_id": request.model_id, "is_active": True})
    if not model:
        raise HTTPException(status_code=400, detail="That model isn't available on this platform.")

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"preferred_model_id": request.model_id}})
    return {"model_id": request.model_id, "display_name": model.get("display_name", request.model_id)}


@router.get("/my-usage-logs")
async def my_usage_logs(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
    limit: int = 50,
) -> list[dict]:
    """Any signed-in user's own consumption history, for the member portal - deliberately
    unscoped by role (unlike the admin usage-log views), since seeing your own usage
    needs no special privilege."""
    logs = []
    cursor = db.usage_logs.find({"user_id": user["_id"]}).sort("timestamp", -1).limit(min(limit, 200))
    async for log in cursor:
        logs.append(
            {
                "model_id": log["model_id"],
                "input_tokens": log["input_tokens"],
                "output_tokens": log["output_tokens"],
                "credits_deducted": round(float(log["credits_deducted"].to_decimal()), 4),
                "timestamp": log["timestamp"].isoformat(),
            }
        )
    return logs


@router.post("/chat")
async def handle_chat_request(
    request: ChatRequest,
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    # get_current_user already rejects banned/deleted outright; "pending" is allowed
    # through as far as /v1/me (so a pending user can still see their own status), but
    # not allowed to actually spend credits until an admin's action (or their own first
    # sign-in linking) has flipped them to active.
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail=f"Account status is '{user.get('status')}', not active.")

    current_balance = float(user["credit_balance"].to_decimal())
    if current_balance <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credit balance. Ask an admin for a top-up.")

    # The model actually used is always the account's own choice (see /v1/my-model),
    # never request.model_id - billing must never trust what the caller says it wants.
    preferred_model_id = user.get("preferred_model_id")
    if not preferred_model_id:
        raise HTTPException(
            status_code=400,
            detail="No model selected yet - choose one in your dashboard before chatting.",
        )

    # model_id (the real Anthropic API model string) is distinct from a pricing doc's
    # _id (a tier slug) - see scripts/seed_model_pricing.py for why.
    model = await db.model_pricing.find_one({"model_id": preferred_model_id, "is_active": True})
    if not model:
        raise HTTPException(
            status_code=400,
            detail="Your selected model is no longer available - choose another in your dashboard.",
        )

    anthropic_input_per_m = float(model["anthropic_input_per_m"])
    anthropic_output_per_m = float(model["anthropic_output_per_m"])
    markup_multiplier = float(model["markup_multiplier"])

    # An organization's own additional margin on top of Homie's price (see
    # credit_engine.apply_organization_margin and organizations.profit_margin_percent) -
    # 0 for every account with no organization, same as before this existed.
    org_margin_percent = 0.0
    organization_id = user.get("organization_id")
    if organization_id:
        org = await db.organizations.find_one({"_id": organization_id}, {"profit_margin_percent": 1})
        org_margin_percent = float(org.get("profit_margin_percent", 0.0)) if org else 0.0

    input_tokens = await count_input_tokens(
        model=preferred_model_id,
        messages=request.messages,
        system=request.system,
        tools=request.tools,
    )

    # Budget planning uses the MEMBER-FACING multiplier (Homie's own markup, with the
    # organization's own margin layered on top) - the pre-call affordability check and
    # output-token cap must reflect what will actually leave the member's balance, not
    # just Homie's own price underneath it, or a member could be approved for a request
    # whose real (org-marked-up) cost exceeds what they can afford.
    member_facing_multiplier = markup_multiplier * (1.0 + org_margin_percent / 100.0)
    budget = credit_engine.plan_request_budget(
        input_tokens=input_tokens,
        current_balance_credits=current_balance,
        anthropic_input_per_m=anthropic_input_per_m,
        anthropic_output_per_m=anthropic_output_per_m,
        markup_multiplier=member_facing_multiplier,
        requested_max_tokens=request.max_tokens,
    )

    if not budget.affordable:
        raise HTTPException(
            status_code=402,
            detail="Insufficient credit balance for this request. Ask an admin for a top-up.",
        )

    response = await create_message(
        model=preferred_model_id,
        messages=request.messages,
        system=request.system,
        tools=request.tools,
        max_tokens=budget.capped_max_tokens,
    )

    in_tok = response.usage.input_tokens
    out_tok = response.usage.output_tokens
    # Homie's own true price - unaffected by any organization's margin, so this (and the
    # raw_api_cost_usd/user_billed_usd logged below) stay accurate to the platform's own
    # margin over Anthropic (see routes/super_admin.py's get_anthropic_spend), not
    # conflated with an organization's own separate markup on top of it.
    charge = credit_engine.compute_final_charge(
        input_tokens=in_tok,
        output_tokens=out_tok,
        anthropic_input_per_m=anthropic_input_per_m,
        anthropic_output_per_m=anthropic_output_per_m,
        markup_multiplier=markup_multiplier,
    )
    # What actually leaves the member's own balance - Homie's true price plus this
    # organization's own margin on top of it (0 margin -> identical to charge itself).
    member_deduction = credit_engine.apply_organization_margin(charge.credits_to_deduct, org_margin_percent)
    org_margin_credits = member_deduction - charge.credits_to_deduct

    async with await db.client.start_session() as session:
        async with session.start_transaction():
            result = await db.users.find_one_and_update(
                {
                    "_id": user["_id"],
                    "credit_balance": {"$gte": Decimal128(str(member_deduction))},
                },
                {"$inc": {"credit_balance": Decimal128(str(-member_deduction))}},
                return_document=True,
                session=session,
            )
            if result is None:
                # Should be unreachable given the pre-call budget cap above; if it does
                # happen it's a genuine concurrent-request race, not an uncapped overage.
                raise HTTPException(status_code=409, detail="Balance changed concurrently - retry.")

            if organization_id and org_margin_credits > 0:
                # The organization's own retained profit on its own credit pool (see
                # routes/org_admin.py's update_profit_margin) - not sent anywhere
                # external, just moved from the member's own balance (which was itself
                # originally allocated out of this same pool) back into it.
                await db.organizations.update_one(
                    {"_id": organization_id},
                    {"$inc": {"credit_balance": Decimal128(str(org_margin_credits))}},
                    session=session,
                )

            await db.usage_logs.insert_one(
                {
                    "user_id": user["_id"],
                    # Denormalized so org_admin's usage view can filter with no join.
                    "organization_id": organization_id,
                    "model_id": preferred_model_id,
                    "input_tokens": in_tok,
                    "output_tokens": out_tok,
                    "raw_api_cost_usd": Decimal128(str(charge.raw_cost_usd)),
                    "user_billed_usd": Decimal128(str(charge.billed_usd)),
                    # The real amount deducted from the member (Homie's price plus the
                    # organization's own margin, if any) - the true ledger event, so this
                    # always equals the member's actual balance change.
                    "credits_deducted": Decimal128(str(member_deduction)),
                    "org_margin_credits": Decimal128(str(org_margin_credits)),
                    "timestamp": datetime.now(timezone.utc),
                },
                session=session,
            )

    return {
        # The raw Anthropic Message, verbatim - same shape the Add-in would get calling
        # Anthropic directly, so its existing response-parsing logic barely has to change.
        "message": response.model_dump(mode="json"),
        "deducted_credits": round(member_deduction, 2),
        "remaining_credits": round(float(result["credit_balance"].to_decimal()), 2),
    }
