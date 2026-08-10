import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db, params_store
from app.connectors.climate import fetch_annual_climate
from app.connectors.elevation import fetch_elevation
from app.grid import build_grid
from app.suitability import PointResult, score_point, summarize
from app.terrain import compute_slope_percent

router = APIRouter(tags=["analyze"])


class AnalyzeRequest(BaseModel):
    project_id: str
    crop_id: str


@router.post("/analyze")
async def analyze_route(body: AnalyzeRequest) -> dict:
    project = db.get_project(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    crop = params_store.get_crop_profile(body.crop_id)
    if not crop:
        raise HTTPException(status_code=400, detail=f"Unknown crop_id '{body.crop_id}'")
    weights = params_store.get_criterion_weights()

    grid = build_grid(project["aoi_geojson"])
    all_points = [(c.lat, c.lon) for c in grid.cells]

    # Elevation is fetched for every grid cell (including outside-AOI ones) because slope
    # needs neighboring cells for its finite difference; climate is only fetched for
    # in-AOI cells since it isn't used as slope-neighbor context, saving API calls.
    #
    # Both connectors are plain httpx calls against a third-party API with no retry/circuit
    # breaker of their own - a timeout, rate limit, or outage otherwise surfaces as a raw,
    # unhandled 500 with a stack trace instead of something the desktop UI can show the
    # user, so translate connector failures into a clean 502 here (mirrors homie_client's
    # own connection-error handling for the same reason).
    try:
        elevations = await fetch_elevation(all_points)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Elevation lookup failed: {exc}") from exc
    slopes = compute_slope_percent(grid, elevations)

    inside_indices = [i for i, c in enumerate(grid.cells) if c.inside_aoi]
    inside_points = [all_points[i] for i in inside_indices]
    try:
        climate = await fetch_annual_climate(inside_points)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Climate lookup failed: {exc}") from exc

    results: list[PointResult] = []
    for climate_idx, grid_idx in enumerate(inside_indices):
        cell = grid.cells[grid_idx]
        point_climate = climate[climate_idx]
        scored = score_point(
            crop=crop,
            elevation_m=elevations[grid_idx],
            slope_percent=slopes[grid_idx],
            annual_rainfall_mm=point_climate["annual_rainfall_mm"],
            mean_temp_c=point_climate["mean_temp_c"],
            weights=weights,
        )
        results.append(
            PointResult(
                lat=cell.lat,
                lon=cell.lon,
                elevation_m=elevations[grid_idx],
                slope_percent=slopes[grid_idx],
                annual_rainfall_mm=point_climate["annual_rainfall_mm"],
                mean_temp_c=point_climate["mean_temp_c"],
                bounds=grid.cell_bounds(cell),
                **scored,
            )
        )

    summary = summarize(results)
    result_payload = {
        "points": [r.model_dump() for r in results],
        "summary": summary,
        "crop_name": crop.name,
        "weights_used": weights,
    }
    run = db.save_run(body.project_id, body.crop_id, result_payload)
    return run
