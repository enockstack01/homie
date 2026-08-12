from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings, set_api_base, set_api_key
from app.homie_client import HomieApiError, HomieClient

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/account")
async def get_account_route() -> dict:
    """Account info for whichever key is currently primed (see config.py - in-memory
    only, re-primed by Electron on every orchestrator spawn) - lets the Dashboard show
    "signed in as X" on every load, not just right after PUT /settings's own one-time
    response, without the renderer needing to hold onto that response itself."""
    settings = get_settings()
    if not settings.homie_api_key:
        raise HTTPException(status_code=401, detail="No Homie API key configured.")
    try:
        client = HomieClient(settings)
        return await client.whoami()
    except HomieApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


class SettingsOut(BaseModel):
    homie_api_base: str
    has_api_key: bool


class SettingsIn(BaseModel):
    homie_api_base: str | None = None
    homie_api_key: str


@router.get("")
async def get_settings_route() -> SettingsOut:
    settings = get_settings()
    return SettingsOut(homie_api_base=settings.homie_api_base, has_api_key=bool(settings.homie_api_key))


@router.put("")
async def put_settings(body: SettingsIn) -> dict:
    """Verifies the key against /v1/me before accepting it, so a typo is caught here
    rather than surfacing later as a confusing 401 mid-analysis. The key itself is kept
    in memory only for this process's lifetime (see config.py) - Electron's main process
    is what persists it at rest (encrypted via safeStorage) and is also what calls this
    same endpoint on every fresh orchestrator spawn to re-prime it, exactly like a user
    typing it into the Settings panel would."""
    if body.homie_api_base:
        set_api_base(body.homie_api_base)

    candidate = get_settings().model_copy(update={"homie_api_key": body.homie_api_key})
    client = HomieClient(candidate)
    try:
        whoami = await client.whoami()
    except HomieApiError as exc:
        return {"saved": False, "error": exc.detail}

    set_api_key(body.homie_api_key)
    return {"saved": True, "account": whoami}


@router.delete("")
async def delete_settings() -> dict:
    """Sign-out: drops the in-memory key (see config.py) so GET /settings/account and
    everything gated on has_api_key goes back to signed-out immediately. Electron's own
    at-rest copy is a separate erase (xcrop:clearApiKey, called alongside this by the
    renderer) - clearing only one of the two would leave the other resurrecting the key on
    the next orchestrator spawn (this one) or the next Settings-panel read (that one)."""
    set_api_key(None)
    return {"cleared": True}
