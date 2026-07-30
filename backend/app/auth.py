from datetime import datetime, timezone
from functools import lru_cache

from bson import Decimal128
from clerk_backend_api import Clerk, AuthenticateRequestOptions
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.db import get_db

# Four tiers, per the platform's actual org structure (not just "admin"/"analyst"):
# - super_admin: the whole platform - all organizations, all users, platform resources
#   (model pricing, the Anthropic API key). organization_id is always None.
# - platform_admin: identical to super_admin - same organizations/users/credits/roles
#   access - EXCEPT it cannot change platform resources (model pricing, the Anthropic API
#   key): those stay gated behind require_super_admin specifically (see
#   routes/super_admin.py's update_model_pricing/set_anthropic_api_key/
#   invalidate_anthropic_api_key), while everything else uses the broader
#   require_platform_staff. organization_id is always None, same as super_admin.
# - org_admin: manages exactly one organization's members and allocates that org's credit
#   pool out to them. organization_id is always set (their own org).
# - member: an organization member, drawing down an allocation out of that org's shared
#   credit pool (see routes/org_admin.py's allocate_credits). organization_id is always
#   set once onboarding (registering that organization, see routes/chat.py's
#   register_organization) is complete - there is no standing "no organization" account
#   type on this platform; every self-signup is required to register or join one.
ROLE_SUPER_ADMIN = "super_admin"
ROLE_PLATFORM_ADMIN = "platform_admin"
ROLE_ORG_ADMIN = "org_admin"
ROLE_MEMBER = "member"
ALL_ROLES = (ROLE_SUPER_ADMIN, ROLE_PLATFORM_ADMIN, ROLE_ORG_ADMIN, ROLE_MEMBER)

# A user's lifecycle, settable by a super_admin (see routes/super_admin.py's
# update_user_status) independently of their role:
# - pending: invited (by email, via org_admin.add_member) but hasn't linked a real Clerk
#   identity yet by signing in - flips to active automatically the moment they do.
# - active: normal, can authenticate and (if a member) spend credits.
# - banned / deleted: blocked outright - get_current_user rejects every request before
#   even returning the user doc, so nothing downstream needs its own check.
STATUS_PENDING = "pending"
STATUS_ACTIVE = "active"
STATUS_BANNED = "banned"
STATUS_DELETED = "deleted"
ALL_STATUSES = (STATUS_PENDING, STATUS_ACTIVE, STATUS_BANNED, STATUS_DELETED)
_BLOCKED_STATUSES = (STATUS_BANNED, STATUS_DELETED)


@lru_cache
def get_clerk_client() -> Clerk:
    return Clerk(bearer_auth=get_settings().clerk_secret_key)


def _extract_identity_id(payload: dict) -> str | None:
    """Session tokens (JWTs from a signed-in browser, e.g. the admin dashboard) carry the
    Clerk user id under `sub` - verified against clerk_backend_api's own
    RequestState.to_auth() branching, not assumed from the blueprint."""
    return payload.get("sub")


async def _exchange_machine_secret_for_identity(machine_secret: str) -> str:
    """
    A member's desktop credential is a Clerk *Machine* secret key (`ak_...`, subject
    `mch_...`) - Clerk's per-user "API Keys" feature turned out to be plan-gated
    (403 feature_not_enabled) when this was built; Machines serves the same purpose here
    (one long-lived, non-interactive credential per member) and was available.

    A machine's secret key can't be sent directly as a bearer token, though - Clerk
    requires exchanging it for a short-lived (~1hr) M2M token first, a client-credentials-
    style pattern. Doing that exchange here, server-side, on every request means the
    Add-in itself never needs any token-refresh logic: it just sends the same persistent
    secret every time. `result.subject` (e.g. "mch_...") comes back already verified by
    Clerk as part of minting the token, so there's no separate authenticate_request call
    needed for this path.
    """
    try:
        async with Clerk(bearer_auth=machine_secret) as machine_client:
            result = await machine_client.m2m.create_token_async()
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or revoked Homie API key") from exc

    return result.subject


async def verify_clerk_user(request: Request) -> str:
    """
    `authenticate_request` takes any object with a `.headers` mapping (a `Requestish`),
    which FastAPI's own Request object already satisfies directly - no manual bearer-token
    header parsing needed for the session-token path. The machine-secret path (below) does
    need the raw header, since a machine secret is never a valid Clerk session/JWT itself.
    """
    auth_header = request.headers.get("authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()

    if token.startswith("ak_"):
        return await _exchange_machine_secret_for_identity(token)

    clerk = get_clerk_client()
    settings = get_settings()

    request_state = await clerk.authenticate_request_async(
        request,
        AuthenticateRequestOptions(authorized_parties=settings.clerk_authorized_parties_list or None),
    )

    if not request_state.is_signed_in or not request_state.payload:
        raise HTTPException(status_code=401, detail="Invalid or expired Clerk session")

    identity_id = _extract_identity_id(request_state.payload)
    if not identity_id:
        raise HTTPException(status_code=401, detail="Clerk token missing a user identity")

    return identity_id


async def _fetch_clerk_email(clerk_user_or_machine_id: str) -> str | None:
    """Best-effort lookup so a self-signed-up member's real email shows up in the
    super-admin/org-admin dashboards immediately, not just after their first grant. A
    machine identity (`mch_...`) has no email at all - that's expected, not an error."""
    if not clerk_user_or_machine_id.startswith("user_"):
        return None
    try:
        clerk = get_clerk_client()
        user = await clerk.users.get_async(user_id=clerk_user_or_machine_id)
        primary = next(
            (e.email_address for e in (user.email_addresses or []) if e.id == user.primary_email_address_id),
            None,
        )
        return primary or (user.email_addresses[0].email_address if user.email_addresses else None)
    except Exception:
        return None


async def get_current_user(
    identity_id: str = Depends(verify_clerk_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    A person can present two distinct Clerk identities for the same Homie account: their
    real Clerk user (`user_...`, a session token - dashboard sign-in) or their Machine
    (`mch_...`, a long-lived secret - the desktop Add-in). Both must resolve to the same
    user document, so this looks up by whichever field matches rather than assuming
    `clerk_user_id` alone (see services/clerk_provisioning.py for why there are two
    fields at all).

    Auto-provisions a local account (role=member, no organization, credit_balance=0) the
    first time a valid *user* identity is seen - there's no flow that creates a brand-new
    signup's first record otherwise, so without this every new signup would 404 forever
    with no path to an admin being able to find and fund them. Status starts at
    STATUS_PENDING, not active: an unsolicited self-signup hasn't been vetted by anyone,
    unlike an org-invited member (see the pending_invite branch below, which - because an
    org_admin already chose to invite that email - flips straight to active instead). A
    super_admin has to explicitly approve a self-signup via update_user_status before
    they can spend any credits (enforced in routes/chat.py, not here - /v1/me still needs
    to work while pending so the dashboard can show a "waiting for approval" notice). A
    brand-new *machine* identity with no matching account is not auto-provisioned this
    way - machines are always created by issue_api_key against an already-existing user,
    so one showing up unmatched means it was revoked/reassigned, not that it's a new
    signup.

    Before creating a brand-new doc, checks for a pending invite: an org_admin can add a
    member by email before that person has ever signed into Clerk (see
    routes/org_admin.py's add_member), which creates a doc with organization_id already
    set but no clerk_user_id yet. Skipping this check would make every invited member's
    actual first sign-in create a second, orgless duplicate account instead of linking up
    with the one they were already added to.
    """
    user = await db.users.find_one(
        {"$or": [{"clerk_user_id": identity_id}, {"machine_id": identity_id}]}
    )
    if user:
        _reject_if_blocked(user)
        return user

    if identity_id.startswith("mch_"):
        raise HTTPException(status_code=401, detail="This Homie API key is no longer valid")

    email = await _fetch_clerk_email(identity_id)

    if email:
        pending_invite = await db.users.find_one_and_update(
            {"email": email, "clerk_user_id": {"$exists": False}},
            # Signing in for the first time is exactly what "pending" was waiting on -
            # flip straight to active here rather than leaving a second admin step.
            {"$set": {"clerk_user_id": identity_id, "status": STATUS_ACTIVE}},
            return_document=True,
        )
        if pending_invite:
            _reject_if_blocked(pending_invite)
            return pending_invite

    now = datetime.now(timezone.utc)
    new_user = {
        "clerk_user_id": identity_id,
        # machine_id intentionally omitted, not set to None: it's a sparse unique index
        # (see db.py) so multiple users with no machine issued yet must not have the
        # field present at all, or they'd collide on a shared null value.
        "email": email,
        "role": ROLE_MEMBER,
        "organization_id": None,
        "status": STATUS_PENDING,
        "credit_balance": Decimal128("0"),
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db.users.insert_one(new_user)
    except DuplicateKeyError:
        # A brand-new sign-in triggers this same lookup from more than one place at once
        # (the root layout and the page it's rendering both call /v1/me for the same
        # first navigation) - both can reach this point seeing no existing account yet,
        # and lose the race to insert_one's unique clerk_user_id index (see db.py). The
        # loser isn't a real conflict, just a duplicate of work the winner already did -
        # its doc is already there, so fetch and return that instead of 500ing.
        existing = await db.users.find_one({"clerk_user_id": identity_id})
        if existing is None:
            raise  # Genuinely unexpected - some other cause collided on this same key.
        _reject_if_blocked(existing)
        return existing
    new_user["_id"] = result.inserted_id
    return new_user


def _reject_if_blocked(user: dict) -> None:
    if user.get("status") in _BLOCKED_STATUSES:
        raise HTTPException(status_code=403, detail=f"This account has been {user['status']}.")


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    """Strictly super_admin - platform_admin is deliberately excluded here. Use this only
    for the handful of routes that mutate platform resources (model pricing, the
    Anthropic API key); everything else a super_admin can do, platform_admin can too, via
    require_platform_staff below."""
    if user.get("role") != ROLE_SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super-admin role required")
    return user


async def require_platform_staff(user: dict = Depends(get_current_user)) -> dict:
    """super_admin or platform_admin - the whole super-admin dashboard except changing
    platform resources, which is exactly what require_super_admin (above) gates
    instead."""
    if user.get("role") not in (ROLE_SUPER_ADMIN, ROLE_PLATFORM_ADMIN):
        raise HTTPException(status_code=403, detail="Super-admin or platform-admin role required")
    return user


async def require_org_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != ROLE_ORG_ADMIN or not user.get("organization_id"):
        raise HTTPException(status_code=403, detail="Organization-admin role required")
    return user
