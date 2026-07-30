from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(get_settings().mongodb_uri)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency - `db: AsyncIOMotorDatabase = Depends(get_db)`."""
    return get_client()[get_settings().mongodb_db_name]


async def ensure_indexes() -> None:
    """Called once on app startup."""
    db = get_db()
    # Sparse: an org_admin can pre-invite a member by email before that person has ever
    # signed into Clerk, creating a doc with no clerk_user_id yet (see auth.py's
    # get_current_user, which backfills it by email on their first real sign-in) - a
    # non-sparse unique index would treat every one of those pending invites as
    # colliding on a shared null value.
    await db.users.create_index("clerk_user_id", unique=True, sparse=True)
    # Sparse: most users never get a machine_id until an admin issues them an API key,
    # and a non-sparse unique index would treat every one of those "not issued yet" users
    # as colliding on a shared null value.
    await db.users.create_index("machine_id", unique=True, sparse=True)
    await db.users.create_index("organization_id")
    await db.users.create_index("pending_organization_id")
    # Every organization created after this field existed gets one at creation (see
    # services/organizations.py) - the human-readable id a prospective member types in to
    # request joining (routes/chat.py's join_organization), so it must be unique
    # platform-wide. Sparse for the same reason as clerk_user_id/machine_id above: an
    # organization from before this field existed has none yet (backfilled lazily on next
    # read - see services/organizations.ensure_org_id), and a non-sparse index would treat
    # every one of those as colliding on a shared null value.
    await db.organizations.create_index("org_id", unique=True, sparse=True)
    await db.usage_logs.create_index([("user_id", 1), ("timestamp", -1)])
    await db.credit_transactions.create_index([("target_collection", 1), ("target_id", 1), ("created_at", -1)])
    await db.model_pricing.create_index([("model_id", 1), ("is_active", 1)])
