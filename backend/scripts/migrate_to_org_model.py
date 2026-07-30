"""
One-time migration for docs created before the org/role restructure:
- role "admin" -> "super_admin", "analyst" -> "member"
- any doc missing organization_id gets organization_id: None
- a doc whose clerk_user_id is actually a Machine id (mch_...) gets that value moved to
  machine_id instead, and clerk_user_id unset - see auth.py/clerk_provisioning.py for why
  those are two separate fields now.
- any doc missing status gets status: "active" (pre-dates the pending/active/banned/
  deleted lifecycle entirely, so "already active" is the only sensible default).

Safe to run more than once (every step is idempotent).

Usage:
    .venv/Scripts/python.exe -m scripts.migrate_to_org_model
"""

import asyncio

from app.db import get_db


async def main() -> None:
    db = get_db()

    # The pre-existing clerk_user_id index was created non-sparse (unique=True only);
    # changing app/db.py's create_index call doesn't retroactively alter an index that
    # already exists under the same name with different options, so drop it here and let
    # the next app startup's ensure_indexes() recreate it sparse.
    existing_indexes = await db.users.index_information()
    if "clerk_user_id_1" in existing_indexes and not existing_indexes["clerk_user_id_1"].get("sparse"):
        await db.users.drop_index("clerk_user_id_1")
        print("dropped non-sparse clerk_user_id index (will be recreated sparse on next app startup)")

    role_result_admin = await db.users.update_many({"role": "admin"}, {"$set": {"role": "super_admin"}})
    role_result_analyst = await db.users.update_many({"role": "analyst"}, {"$set": {"role": "member"}})
    print(f"role admin -> super_admin: {role_result_admin.modified_count} docs")
    print(f"role analyst -> member: {role_result_analyst.modified_count} docs")

    org_field_result = await db.users.update_many(
        {"organization_id": {"$exists": False}}, {"$set": {"organization_id": None}}
    )
    print(f"added organization_id: None: {org_field_result.modified_count} docs")

    moved = 0
    async for u in db.users.find({"clerk_user_id": {"$regex": "^mch_"}}):
        await db.users.update_one(
            {"_id": u["_id"]},
            {"$set": {"machine_id": u["clerk_user_id"]}, "$unset": {"clerk_user_id": ""}},
        )
        moved += 1
    print(f"moved clerk_user_id (mch_...) -> machine_id: {moved} docs")

    status_result = await db.users.update_many(
        {"status": {"$exists": False}}, {"$set": {"status": "active"}}
    )
    print(f"added status: active: {status_result.modified_count} docs")


if __name__ == "__main__":
    asyncio.run(main())
