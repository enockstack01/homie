"""
The one place a new organization document gets created - shared by routes/super_admin.py
(an admin creating one on someone else's behalf, or auto-creating one when promoting a
user to org_admin with no org yet) and routes/chat.py's register_organization (self-service,
the mandatory step every brand-new signup completes before they can do anything else - see
admin-dashboard's /welcome page). Keeping this in one function means both paths can never
drift apart on the document's shape.
"""

import re
import secrets
import string
from datetime import datetime, timezone

from bson import Decimal128, ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

_SUFFIX_ALPHABET = string.ascii_lowercase + string.digits
_SUFFIX_LENGTH = 6
_MAX_GENERATION_ATTEMPTS = 10


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")
    return slug or "org"


async def _generate_unique_org_id(db: AsyncIOMotorDatabase, name: str) -> str:
    """The organization's own human-readable id - what a prospective member types into
    admin-dashboard's JoinOrganizationForm to request joining (see routes/chat.py's
    join_organization), shown to the org_admin on their dashboard so they can share it.
    Always starts with the organization's own (slugified) name, followed by a random
    suffix that guarantees uniqueness even when two organizations share a name - names
    themselves are never required to be unique, only this id is (see db.py's index)."""
    base = _slugify(name)
    for _ in range(_MAX_GENERATION_ATTEMPTS):
        suffix = "".join(secrets.choice(_SUFFIX_ALPHABET) for _ in range(_SUFFIX_LENGTH))
        candidate = f"{base}_{suffix}"
        if not await db.organizations.find_one({"org_id": candidate}, {"_id": 1}):
            return candidate
    raise RuntimeError(f"Could not generate a unique organization id for {name!r}")


async def create_organization_doc(db: AsyncIOMotorDatabase, name: str) -> tuple[ObjectId, str]:
    """Returns (mongo _id, human-readable org_id)."""
    org_id = await _generate_unique_org_id(db, name)
    now = datetime.now(timezone.utc)
    result = await db.organizations.insert_one(
        {
            "name": name,
            "org_id": org_id,
            "credit_balance": Decimal128("0"),
            # No markup by default - identical to a platform account with no organization
            # at all until an org_admin explicitly opts into one (see
            # routes/org_admin.py's update_profit_margin).
            "profit_margin_percent": 0.0,
            "created_at": now,
            "updated_at": now,
        }
    )
    return result.inserted_id, org_id


async def ensure_org_id(db: AsyncIOMotorDatabase, org: dict) -> str:
    """Backfills org_id on an organization that predates this field (see db.py's sparse
    index) the first time it's read, instead of requiring a one-off migration script -
    every organization ends up with one lazily, the same "heal on read" spirit as
    auth.get_current_user's pending-invite email backfill. Call sites that already have
    the org doc in hand (list_organizations, get_my_organization) use this rather than
    re-fetching."""
    existing = org.get("org_id")
    if existing:
        return existing
    org_id = await _generate_unique_org_id(db, org["name"])
    await db.organizations.update_one({"_id": org["_id"]}, {"$set": {"org_id": org_id}})
    return org_id
