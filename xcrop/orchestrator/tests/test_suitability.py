from app.crops import DEFAULT_CROP_PROFILES
from app.suitability import score_point


def get_crop_profile(crop_id: str):
    return DEFAULT_CROP_PROFILES[crop_id]


def test_optimal_conditions_score_100():
    crop = get_crop_profile("avocado")
    result = score_point(crop, elevation_m=1600, slope_percent=5, annual_rainfall_mm=1400, mean_temp_c=20)
    assert result["suitability_score"] == 100.0
    assert result["suitability_class"] == "S1"


def test_steep_slope_is_hard_excluded():
    crop = get_crop_profile("avocado")
    result = score_point(crop, elevation_m=1600, slope_percent=45, annual_rainfall_mm=1400, mean_temp_c=20)
    assert result["suitability_score"] == 0.0
    assert result["suitability_class"] == "N"
    assert result["limiting_factor"] == "slope"


def test_out_of_range_rainfall_scores_zero_on_that_criterion():
    crop = get_crop_profile("avocado")
    result = score_point(crop, elevation_m=1600, slope_percent=5, annual_rainfall_mm=100, mean_temp_c=20)
    assert result["criterion_scores"]["annual_rainfall_mm"] == 0.0
    assert result["limiting_factor"] == "annual_rainfall_mm"
    assert result["suitability_score"] < 100.0


def test_missing_climate_data_falls_back_to_available_criteria():
    crop = get_crop_profile("maize")
    result = score_point(crop, elevation_m=1200, slope_percent=5, annual_rainfall_mm=None, mean_temp_c=None)
    assert set(result["criterion_scores"]) == {"elevation_m"}
    assert result["suitability_score"] == result["criterion_scores"]["elevation_m"]
