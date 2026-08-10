from pydantic import BaseModel


class Range(BaseModel):
    """A criterion's tolerance range. optimal_* is scored 100; suitability falls off
    linearly to 0 at min/max (standard FAO-style trapezoidal membership, simplified to
    linear since we don't yet have enough curated points per crop for a smoother curve)."""

    min: float
    optimal_min: float
    optimal_max: float
    max: float


class CropProfile(BaseModel):
    id: str
    name: str
    annual_rainfall_mm: Range
    mean_temp_c: Range
    elevation_m: Range
    max_slope_percent: float


# Seed data only, loosely adapted from FAO ECOCROP - not a substitute for a local
# agronomist's judgement. This is what a brand-new ~/.xcrop/params.json is initialized
# from (see params_store.py); once running, params_store.py's persisted copy is the real
# source of truth and these three profiles are freely editable/replaceable/deletable
# through the /crops routes, not fixed.
DEFAULT_CROP_PROFILES: dict[str, CropProfile] = {
    "avocado": CropProfile(
        id="avocado",
        name="Avocado",
        annual_rainfall_mm=Range(min=600, optimal_min=1000, optimal_max=1800, max=2500),
        mean_temp_c=Range(min=12, optimal_min=17, optimal_max=24, max=30),
        elevation_m=Range(min=800, optimal_min=1200, optimal_max=2000, max=2400),
        max_slope_percent=30,
    ),
    "maize": CropProfile(
        id="maize",
        name="Maize",
        annual_rainfall_mm=Range(min=500, optimal_min=600, optimal_max=1200, max=1800),
        mean_temp_c=Range(min=10, optimal_min=18, optimal_max=27, max=35),
        elevation_m=Range(min=0, optimal_min=500, optimal_max=1800, max=2200),
        max_slope_percent=20,
    ),
    "coffee_arabica": CropProfile(
        id="coffee_arabica",
        name="Coffee (Arabica)",
        annual_rainfall_mm=Range(min=1000, optimal_min=1200, optimal_max=1800, max=2200),
        mean_temp_c=Range(min=10, optimal_min=15, optimal_max=22, max=26),
        elevation_m=Range(min=1000, optimal_min=1400, optimal_max=2000, max=2300),
        max_slope_percent=35,
    ),
}

DEFAULT_CRITERION_WEIGHTS: dict[str, float] = {
    "annual_rainfall_mm": 0.4,
    "mean_temp_c": 0.4,
    "elevation_m": 0.2,
}
