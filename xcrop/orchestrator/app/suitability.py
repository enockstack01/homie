from pydantic import BaseModel

from app.crops import CropProfile, Range

# Weights are now user-editable (see params_store.py / routes/params.py) rather than a
# fixed constant - this is just the fallback used if the persisted store is somehow
# missing an entry for a criterion. Slope stays a hard Boolean exclusion
# (crop_profile.max_slope_percent), matching the doc's "rule-based evaluation for hard
# exclusion criteria", not weighted in here regardless of what the store holds.
DEFAULT_WEIGHT = 0.0

# FAO land suitability classes (doc Glossary: S1-N), thresholds on the 0-100 overlay score.
_CLASS_THRESHOLDS = (
    (85, "S1", "Highly suitable"),
    (70, "S2", "Moderately suitable"),
    (50, "S3", "Marginally suitable"),
)


class PointResult(BaseModel):
    lat: float
    lon: float
    elevation_m: float
    slope_percent: float
    annual_rainfall_mm: float | None
    mean_temp_c: float | None
    criterion_scores: dict[str, float]
    suitability_score: float
    suitability_class: str
    limiting_factor: str | None
    # [min_lon, min_lat, max_lon, max_lat] of this point's grid cell - lets the map render
    # suitability as a tiled, edge-to-edge filled surface instead of sparse point markers.
    # Optional only because score_point()/tests build a PointResult without grid context;
    # routes/analyze.py always sets it for real runs.
    bounds: list[float] | None = None


def _membership_score(value: float, r: Range) -> float:
    """Linear trapezoidal membership: 0 at/beyond min or max, 100 across [optimal_min,
    optimal_max], ramping linearly in between. Same shape as the doc's fuzzy-membership
    standardisation (Layer 6), simplified to piecewise-linear rather than a smooth fuzzy
    curve."""
    if value <= r.min or value >= r.max:
        return 0.0
    if r.optimal_min <= value <= r.optimal_max:
        return 100.0
    if value < r.optimal_min:
        return 100.0 * (value - r.min) / (r.optimal_min - r.min)
    return 100.0 * (r.max - value) / (r.max - r.optimal_max)


def score_point(
    crop: CropProfile,
    elevation_m: float,
    slope_percent: float,
    annual_rainfall_mm: float | None,
    mean_temp_c: float | None,
    weights: dict[str, float] | None = None,
) -> dict:
    """Returns the raw fields for one PointResult (as a dict, so routes/analyze.py can
    attach lat/lon/bounds before validating into the model). weights defaults to the
    equally-weighted fallback so existing callers/tests that don't pass one still work;
    routes/analyze.py always passes the user's current persisted weights
    (params_store.get_criterion_weights())."""
    if weights is None:
        weights = {"annual_rainfall_mm": 1.0, "mean_temp_c": 1.0, "elevation_m": 1.0}

    if slope_percent > crop.max_slope_percent:
        return {
            "criterion_scores": {},
            "suitability_score": 0.0,
            "suitability_class": "N",
            "limiting_factor": "slope",
        }

    criterion_scores: dict[str, float] = {
        "elevation_m": _membership_score(elevation_m, crop.elevation_m),
    }
    if annual_rainfall_mm is not None:
        criterion_scores["annual_rainfall_mm"] = _membership_score(annual_rainfall_mm, crop.annual_rainfall_mm)
    if mean_temp_c is not None:
        criterion_scores["mean_temp_c"] = _membership_score(mean_temp_c, crop.mean_temp_c)

    total_weight = sum(weights.get(k, DEFAULT_WEIGHT) for k in criterion_scores)
    if total_weight <= 0:
        overall = 0.0
    else:
        overall = sum(criterion_scores[k] * weights.get(k, DEFAULT_WEIGHT) for k in criterion_scores) / total_weight
    overall = round(overall, 1)

    limiting_factor = min(criterion_scores, key=lambda k: criterion_scores[k]) if criterion_scores else None

    suitability_class = "N"
    for threshold, code, _label in _CLASS_THRESHOLDS:
        if overall >= threshold:
            suitability_class = code
            break

    return {
        "criterion_scores": criterion_scores,
        "suitability_score": overall,
        "suitability_class": suitability_class,
        "limiting_factor": limiting_factor,
    }


def summarize(points: list[PointResult]) -> dict:
    if not points:
        return {"mean_suitability": 0.0, "class_distribution": {}, "dominant_limiting_factor": None}

    mean_suitability = round(sum(p.suitability_score for p in points) / len(points), 1)

    class_distribution: dict[str, int] = {}
    for p in points:
        class_distribution[p.suitability_class] = class_distribution.get(p.suitability_class, 0) + 1

    limiting_counts: dict[str, int] = {}
    for p in points:
        if p.limiting_factor:
            limiting_counts[p.limiting_factor] = limiting_counts.get(p.limiting_factor, 0) + 1
    dominant_limiting_factor = max(limiting_counts, key=lambda k: limiting_counts[k]) if limiting_counts else None

    return {
        "mean_suitability": mean_suitability,
        "class_distribution": class_distribution,
        "dominant_limiting_factor": dominant_limiting_factor,
    }
