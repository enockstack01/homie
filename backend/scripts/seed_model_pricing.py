"""
Populates model_pricing from the blueprint's Section 4 rate card. Run once against a
fresh database, and again any time raw Anthropic rates change - it's idempotent (upsert).

Each document's `_id` is a pricing-tier slug, distinct from `model_id` (the literal string
sent to the Anthropic API and by the client in ChatRequest.model_id). This decouples "which
Anthropic model to call" from "which price tier applies right now" - chat.py looks pricing
up by `model_id` + `is_active`, so Sonnet 5's intro/standard cutover (Section 9 step 6) is
a matter of flipping `is_active` on two documents, never a client-visible ID change.

Usage: .venv/Scripts/python.exe -m scripts.seed_model_pricing
"""

import asyncio
from datetime import datetime, timezone

from app.db import get_db
from app.services.credit_engine import MINIMUM_MARKUP_MULTIPLIER

MARKUP = MINIMUM_MARKUP_MULTIPLIER  # exact 40% margin, ~1.6667 - see app/services/credit_engine.py

PRICING_DOCS = [
    {
        "_id": "claude-haiku-4-5",
        "model_id": "claude-haiku-4-5",
        "display_name": "Claude Haiku 4.5",
        "anthropic_input_per_m": 1.00,
        "anthropic_output_per_m": 5.00,
        "markup_multiplier": MARKUP,
        "effective_from": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "is_active": True,
    },
    {
        "_id": "claude-sonnet-5-intro",
        "model_id": "claude-sonnet-5",
        "display_name": "Claude Sonnet 5 (Intro)",
        "anthropic_input_per_m": 2.00,
        "anthropic_output_per_m": 10.00,
        "markup_multiplier": MARKUP,
        "effective_from": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "effective_until": datetime(2026, 8, 31, 23, 59, 59, tzinfo=timezone.utc),
        "is_active": True,
    },
    {
        "_id": "claude-sonnet-5-standard",
        "model_id": "claude-sonnet-5",
        "display_name": "Claude Sonnet 5 (Standard)",
        "anthropic_input_per_m": 3.00,
        "anthropic_output_per_m": 15.00,
        "markup_multiplier": MARKUP,
        "effective_from": datetime(2026, 9, 1, tzinfo=timezone.utc),
        # Not yet active - flip_sonnet_rate.py turns this on and retires the intro
        # document on 2026-09-01, per the blueprint's Section 9 step 6.
        "is_active": False,
    },
    {
        "_id": "claude-opus-4-8",
        "model_id": "claude-opus-4-8",
        "display_name": "Claude Opus 4.8",
        "anthropic_input_per_m": 5.00,
        "anthropic_output_per_m": 25.00,
        "markup_multiplier": MARKUP,
        "effective_from": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "is_active": True,
    },
]


async def main() -> None:
    db = get_db()
    for doc in PRICING_DOCS:
        await db.model_pricing.replace_one({"_id": doc["_id"]}, doc, upsert=True)
        print(f"upserted model_pricing/{doc['_id']}")


if __name__ == "__main__":
    asyncio.run(main())
