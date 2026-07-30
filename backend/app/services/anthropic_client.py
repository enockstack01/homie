from datetime import datetime, timezone
from typing import Any

import anthropic
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import get_settings

_PLATFORM_CONFIG_ID = "platform_config"  # singleton document _id in db.platform_config

# This is *the* Anthropic key the gateway calls Anthropic with on every user's behalf -
# distinct from the per-user Homie keys members use to call this gateway (see
# clerk_provisioning.py). Persisted in Mongo so a super_admin can change or invalidate it
# from the dashboard without a redeploy; cached in-process (this runs as a single uvicorn
# worker) so the hot chat path never needs a DB round trip just to read it.
_client: anthropic.AsyncAnthropic | None = None


def _configure(key: str | None) -> None:
    global _client
    _client = anthropic.AsyncAnthropic(api_key=key) if key else None


async def ensure_configured(db: AsyncIOMotorDatabase) -> None:
    """Called once on app startup. Seeds db.platform_config from .env's
    ANTHROPIC_API_KEY on first run (so existing deployments keep working unchanged);
    every run after that, whatever's in the DB takes precedence over .env."""
    doc = await db.platform_config.find_one({"_id": _PLATFORM_CONFIG_ID})
    if doc is None:
        seed_key = get_settings().anthropic_api_key
        await db.platform_config.insert_one({"_id": _PLATFORM_CONFIG_ID, "anthropic_api_key": seed_key})
        _configure(seed_key)
    else:
        _configure(doc.get("anthropic_api_key"))


async def get_current_key(db: AsyncIOMotorDatabase) -> str | None:
    doc = await db.platform_config.find_one({"_id": _PLATFORM_CONFIG_ID})
    return doc.get("anthropic_api_key") if doc else None


async def set_key(db: AsyncIOMotorDatabase, *, new_key: str, updated_by_user_id) -> None:
    await db.platform_config.update_one(
        {"_id": _PLATFORM_CONFIG_ID},
        {
            "$set": {
                "anthropic_api_key": new_key,
                "updated_at": datetime.now(timezone.utc),
                "updated_by_user_id": updated_by_user_id,
            }
        },
        upsert=True,
    )
    _configure(new_key)


async def invalidate_key(db: AsyncIOMotorDatabase, *, updated_by_user_id) -> None:
    """Clears the stored key so the gateway can no longer call Anthropic at all - Anthropic
    keys can only be rotated/revoked from Anthropic's own console (there's no API for it),
    so this is the platform-side equivalent: a kill switch, not a real remote revocation.
    A super_admin re-sets a real key via set_key to restore service."""
    await db.platform_config.update_one(
        {"_id": _PLATFORM_CONFIG_ID},
        {
            "$set": {
                "anthropic_api_key": None,
                "updated_at": datetime.now(timezone.utc),
                "updated_by_user_id": updated_by_user_id,
            }
        },
        upsert=True,
    )
    _configure(None)


def get_anthropic_client() -> anthropic.AsyncAnthropic:
    if _client is None:
        raise HTTPException(
            status_code=503,
            detail="No Anthropic API key is configured - a super_admin must set one.",
        )
    return _client


async def count_input_tokens(
    *,
    model: str,
    messages: list[dict[str, Any]],
    system: str | list[dict[str, Any]] | None,
    tools: list[dict[str, Any]] | None,
) -> int:
    """
    Exact input token count with no completion generated - this is what makes the
    pre-call budget in credit_engine.plan_request_budget precise rather than estimated.
    Takes the full conversation + tool definitions, not just a single prompt string,
    since the client (the ArcGIS Pro Add-in) runs a multi-turn, tool-use agentic loop -
    every turn's cost depends on the whole running conversation, not one message.
    """
    client = get_anthropic_client()
    kwargs: dict[str, Any] = {"model": model, "messages": messages}
    if system is not None:
        kwargs["system"] = system
    if tools:
        kwargs["tools"] = tools

    result = await client.messages.count_tokens(**kwargs)
    return result.input_tokens


async def create_message(
    *,
    model: str,
    messages: list[dict[str, Any]],
    system: str | list[dict[str, Any]] | None,
    tools: list[dict[str, Any]] | None,
    max_tokens: int,
) -> anthropic.types.Message:
    client = get_anthropic_client()
    kwargs: dict[str, Any] = {"model": model, "max_tokens": max_tokens, "messages": messages}
    if system is not None:
        kwargs["system"] = system
    if tools:
        kwargs["tools"] = tools

    return await client.messages.create(**kwargs)
