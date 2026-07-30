"""
One-time bootstrap: super_admin routes require an existing super_admin, but there's no
path to create the FIRST one. Run this once, manually, against a real Clerk user id.

Usage:
    .venv/Scripts/python.exe -m scripts.create_super_admin --clerk-user-id user_2abcXYZ --email you@example.com
"""

import argparse
import asyncio
from datetime import datetime, timezone

from bson import Decimal128

from app.db import get_db


async def main(clerk_user_id: str, email: str) -> None:
    db = get_db()
    now = datetime.now(timezone.utc)
    result = await db.users.update_one(
        {"clerk_user_id": clerk_user_id},
        {
            "$set": {
                "email": email,
                "role": "super_admin",
                "organization_id": None,
                "status": "active",
                "updated_at": now,
            },
            "$setOnInsert": {
                "credit_balance": Decimal128("0"),
                "created_at": now,
            },
        },
        upsert=True,
    )
    if result.upserted_id:
        print(f"Created new super_admin user: {result.upserted_id}")
    else:
        print(f"Promoted existing user (clerk_user_id={clerk_user_id}) to super_admin")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--clerk-user-id", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    asyncio.run(main(args.clerk_user_id, args.email))
