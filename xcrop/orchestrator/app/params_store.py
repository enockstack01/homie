import json

from app.config import DATA_DIR
from app.crops import DEFAULT_CRITERION_WEIGHTS, DEFAULT_CROP_PROFILES, CropProfile

# Crop profiles and criterion weights used to be hardcoded module-level constants - this
# makes them a real, user-editable store instead (doc Section 5's Crop Library / Layer 6's
# weight editor, at least the data layer for it - see routes/params.py for the CRUD
# endpoints a UI panel actually calls). Not secret, so plain JSON on disk is fine (unlike
# config.py's API key, which deliberately never touches disk - see that file's docstring).
PARAMS_PATH = DATA_DIR / "params.json"


def _defaults() -> dict:
    return {
        "crops": {k: v.model_dump() for k, v in DEFAULT_CROP_PROFILES.items()},
        "criterion_weights": dict(DEFAULT_CRITERION_WEIGHTS),
    }


def _read() -> dict:
    if not PARAMS_PATH.exists():
        data = _defaults()
        _write(data)
        return data
    try:
        data = json.loads(PARAMS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _defaults()
    # Tolerate a partially-written or older-shaped file rather than crashing every route.
    data.setdefault("crops", _defaults()["crops"])
    data.setdefault("criterion_weights", _defaults()["criterion_weights"])
    return data


def _write(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PARAMS_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def list_crop_profiles() -> list[CropProfile]:
    data = _read()
    return [CropProfile(**c) for c in data["crops"].values()]


def get_crop_profile(crop_id: str) -> CropProfile | None:
    data = _read()
    raw = data["crops"].get(crop_id)
    return CropProfile(**raw) if raw else None


def upsert_crop_profile(profile: CropProfile) -> CropProfile:
    """Creates a new crop profile, or overwrites an existing one with the same id -
    routes/params.py exposes this as both POST (create) and PUT (update) since the
    underlying operation is identical either way."""
    data = _read()
    data["crops"][profile.id] = profile.model_dump()
    _write(data)
    return profile


def delete_crop_profile(crop_id: str) -> bool:
    data = _read()
    if crop_id not in data["crops"]:
        return False
    del data["crops"][crop_id]
    _write(data)
    return True


def get_criterion_weights() -> dict[str, float]:
    return dict(_read()["criterion_weights"])


def set_criterion_weights(weights: dict[str, float]) -> dict[str, float]:
    data = _read()
    data["criterion_weights"] = dict(weights)
    _write(data)
    return data["criterion_weights"]
