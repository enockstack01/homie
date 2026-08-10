from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import params_store
from app.crops import CropProfile, Range

router = APIRouter(tags=["params"])


@router.get("/crops")
async def list_crops_route() -> list[CropProfile]:
    return params_store.list_crop_profiles()


class CropProfileIn(BaseModel):
    id: str
    name: str
    annual_rainfall_mm: Range
    mean_temp_c: Range
    elevation_m: Range
    max_slope_percent: float


def _validate_ranges(body: CropProfileIn) -> None:
    """min <= optimal_min <= optimal_max <= max for every criterion, and a non-negative
    slope ceiling - the suitability engine's linear membership (see
    suitability.py's _membership_score) silently produces nonsense scores otherwise rather
    than erroring, so it's worth rejecting a malformed edit here instead."""
    for field_name in ("annual_rainfall_mm", "mean_temp_c", "elevation_m"):
        r: Range = getattr(body, field_name)
        if not (r.min <= r.optimal_min <= r.optimal_max <= r.max):
            raise HTTPException(
                status_code=400,
                detail=f"{field_name}: must satisfy min ≤ optimal_min ≤ optimal_max ≤ max",
            )
    if body.max_slope_percent < 0:
        raise HTTPException(status_code=400, detail="max_slope_percent must be ≥ 0")


@router.post("/crops")
async def create_crop_route(body: CropProfileIn) -> CropProfile:
    if params_store.get_crop_profile(body.id):
        raise HTTPException(status_code=409, detail=f"Crop '{body.id}' already exists - use PUT to update it.")
    _validate_ranges(body)
    return params_store.upsert_crop_profile(CropProfile(**body.model_dump()))


@router.put("/crops/{crop_id}")
async def update_crop_route(crop_id: str, body: CropProfileIn) -> CropProfile:
    if not params_store.get_crop_profile(crop_id):
        raise HTTPException(status_code=404, detail=f"Crop '{crop_id}' not found")
    _validate_ranges(body)
    # The path segment, not whatever id the client happened to send, is the identity of
    # the record being updated - overwrite body.id so a typo'd payload can't silently
    # rename/fork the profile.
    profile = CropProfile(**{**body.model_dump(), "id": crop_id})
    return params_store.upsert_crop_profile(profile)


@router.delete("/crops/{crop_id}")
async def delete_crop_route(crop_id: str) -> dict:
    if not params_store.delete_crop_profile(crop_id):
        raise HTTPException(status_code=404, detail=f"Crop '{crop_id}' not found")
    return {"deleted": crop_id}


@router.get("/weights")
async def get_weights_route() -> dict[str, float]:
    return params_store.get_criterion_weights()


class WeightsIn(BaseModel):
    annual_rainfall_mm: float
    mean_temp_c: float
    elevation_m: float


@router.put("/weights")
async def set_weights_route(body: WeightsIn) -> dict[str, float]:
    if any(v < 0 for v in body.model_dump().values()):
        raise HTTPException(status_code=400, detail="Weights must be ≥ 0")
    if sum(body.model_dump().values()) == 0:
        raise HTTPException(status_code=400, detail="At least one weight must be greater than 0")
    return params_store.set_criterion_weights(body.model_dump())
