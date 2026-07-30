"""
Issues and retrieves a member's desktop credential: a Clerk Machine (see auth.py's module
docstring for why Machines rather than per-user API Keys). This is the one place that
calls clerk.machines.* - super_admin (any user), org_admin (their own org's members), and
the member themselves all call through here so there is exactly one implementation to
keep in sync with whatever Clerk's Machines API looks like.

Unlike a typical "shown once at creation" secret (GitHub PATs, etc.), Clerk's
machines.get_secret_key_async lets it be re-fetched any time after creation - verified
directly against a real Machine before relying on it. That's what makes "the key is
always visible to the account holder and to admins" (rather than a one-time reveal)
possible at all.
"""

from datetime import datetime, timezone

from bson import ObjectId
from clerk_backend_api import Clerk
from clerk_backend_api.models.createmachineop import CreateMachineRequestBody
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth import get_clerk_client


async def issue_api_key(db: AsyncIOMotorDatabase, *, user_id: ObjectId, name: str) -> str:
    """
    Creates a new Clerk Machine and stores its identity (mch_...) in this user's
    `machine_id` field - deliberately NOT `clerk_user_id`. A person can have two distinct
    Clerk identities on one Homie account: their real Clerk user (`user_...`, a session
    token, used to sign into this dashboard) and their Machine (`mch_...`, a long-lived
    secret, used by the desktop Add-in). Overwriting `clerk_user_id` here would sever
    their own dashboard sign-in from this account. get_current_user looks up by either
    field to land on the same account regardless of which credential was presented.

    Clerk requires machine names to be unique per instance. A plain "Homie - {email}"
    label collides with itself on every re-issue for the same user - the *previous*
    run's machine still exists (holding that exact name) even after its machine_id is
    overwritten below, so create_async started rejecting every second issue with
    form_identifier_exists (confirmed live: the first issue succeeds, the second 500s).
    The timestamp suffix keeps each created machine's name unique no matter how many
    times this runs for the same user; deleting the old machine afterward (best-effort)
    also stops Clerk from accumulating one orphaned machine per re-issue forever.
    """
    clerk = get_clerk_client()
    unique_name = f"{name} ({datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')}Z)"
    machine = await clerk.machines.create_async(request=CreateMachineRequestBody(name=unique_name))

    user = await db.users.find_one({"_id": user_id})
    old_machine_id = user.get("machine_id") if user else None

    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"machine_id": machine.id}},
    )

    if old_machine_id:
        try:
            await clerk.machines.delete_async(machine_id=old_machine_id)
        except Exception:
            pass  # Best-effort cleanup - the new key already works either way.

    return machine.secret_key


async def get_api_key(user: dict) -> str | None:
    """Returns the user's current Homie API key, or None if they've never had one issued."""
    machine_id = user.get("machine_id")
    if not machine_id:
        return None

    clerk = get_clerk_client()
    result = await clerk.machines.get_secret_key_async(machine_id=machine_id)
    return result.secret
