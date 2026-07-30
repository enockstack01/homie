"""
Blueprint Section 9, step 6: flips Claude Sonnet 5 from the intro rate to the standard
rate. A pure data change (is_active flags), never a code change or deployment - point a
cron job / cloud scheduler at this script for 2026-09-01T00:00:00Z. Safe to run more than
once (idempotent).

Usage: .venv/Scripts/python.exe -m scripts.flip_sonnet_rate
"""

import asyncio

from app.db import get_db

INTRO_ID = "claude-sonnet-5-intro"
STANDARD_ID = "claude-sonnet-5-standard"


async def main() -> None:
    db = get_db()
    await db.model_pricing.update_one({"_id": INTRO_ID}, {"$set": {"is_active": False}})
    result = await db.model_pricing.update_one({"_id": STANDARD_ID}, {"$set": {"is_active": True}})
    if result.matched_count == 0:
        raise SystemExit(
            f"'{STANDARD_ID}' pricing document not found - run scripts.seed_model_pricing first."
        )
    print(f"Deactivated {INTRO_ID}, activated {STANDARD_ID}.")


if __name__ == "__main__":
    asyncio.run(main())
