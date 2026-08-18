import json
import os
from pathlib import Path

from pydantic import BaseModel

# xcrop, unlike xGIS.AddIn, is a single-tenant consumer product pointed at Homie's own
# hosted backend - there's no "your organization's gateway" concept here for a user to
# configure, so the default must be the real deployed backend, not localhost. Without
# this, a key pasted into the desktop app's Settings panel (see routes/settings.py's
# PUT /settings) would validate against nothing listening on 127.0.0.1:8000, fail, and
# silently never set has_api_key - the account still shows disconnected in the UI with no
# error anywhere. Overridable via env var for local backend development only.
DEFAULT_HOMIE_API_BASE = os.environ.get("XCROP_HOMIE_API_BASE", "https://homie-platform.onrender.com")

# Non-secret settings persist to a JSON file under the OS user-data dir - this is a
# local-first desktop tool for a single user on a single machine, so there is no case yet
# for a real database server. See xcrop/orchestrator/app/db.py for the project/run store,
# which layers a tiny JSON-backed repository on top of this same directory.
#
# homie_api_key is deliberately NOT part of what gets written here (see save_settings) -
# it lives only in this process's memory for the process's lifetime. At-rest persistence
# is Electron's job: electron/main.ts encrypts it via safeStorage (OS keychain/DPAPI-backed)
# into its own userData directory, and re-pushes it into this orchestrator's memory (via
# PUT /settings) every time it spawns a fresh orchestrator process. Plaintext-on-disk here
# would undercut that entirely, since anything with filesystem access could read it back
# out regardless of how carefully Electron encrypts its own copy.
DATA_DIR = Path.home() / ".xcrop"
SETTINGS_PATH = DATA_DIR / "settings.json"


class Settings(BaseModel):
    # The gateway that owns the real Anthropic key and meters usage against this account's
    # credit balance (see backend/app/routes/chat.py) - never called with a raw Anthropic
    # key from here, same reason the ArcGIS Pro Add-in's ClaudeAgentService goes through it.
    homie_api_base: str = DEFAULT_HOMIE_API_BASE
    homie_api_key: str | None = None


def _read_persisted_base() -> str:
    if not SETTINGS_PATH.exists():
        return Settings().homie_api_base
    try:
        raw = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return Settings().homie_api_base
    return raw.get("homie_api_base") or Settings().homie_api_base


def _persist_base(homie_api_base: str) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps({"homie_api_base": homie_api_base}, indent=2), encoding="utf-8")


_current = Settings(homie_api_base=_read_persisted_base())


def get_settings() -> Settings:
    return _current


def set_api_key(homie_api_key: str | None) -> Settings:
    """In-memory only - see the module docstring for why this never touches disk."""
    global _current
    _current = _current.model_copy(update={"homie_api_key": homie_api_key})
    return _current


def set_api_base(homie_api_base: str) -> Settings:
    global _current
    _current = _current.model_copy(update={"homie_api_base": homie_api_base})
    _persist_base(homie_api_base)
    return _current
