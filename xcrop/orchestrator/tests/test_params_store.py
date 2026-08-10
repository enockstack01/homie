import pytest

from app import params_store
from app.crops import CropProfile, Range


@pytest.fixture(autouse=True)
def isolated_params_file(tmp_path, monkeypatch):
    """Points PARAMS_PATH at a throwaway file per test - without this, tests would read
    and write the real ~/.xcrop/params.json, leaking state across test runs and any real
    usage of the app on this machine."""
    monkeypatch.setattr(params_store, "PARAMS_PATH", tmp_path / "params.json")


def test_seeds_defaults_on_first_read():
    profiles = params_store.list_crop_profiles()
    ids = {p.id for p in profiles}
    assert {"avocado", "maize", "coffee_arabica"} <= ids


def test_upsert_creates_new_profile():
    new_crop = CropProfile(
        id="rice",
        name="Rice",
        annual_rainfall_mm=Range(min=1000, optimal_min=1500, optimal_max=2500, max=3000),
        mean_temp_c=Range(min=20, optimal_min=24, optimal_max=32, max=38),
        elevation_m=Range(min=0, optimal_min=0, optimal_max=800, max=1200),
        max_slope_percent=5,
    )
    params_store.upsert_crop_profile(new_crop)
    assert params_store.get_crop_profile("rice").name == "Rice"


def test_upsert_overwrites_existing_profile():
    avocado = params_store.get_crop_profile("avocado")
    updated = avocado.model_copy(update={"max_slope_percent": 99})
    params_store.upsert_crop_profile(updated)
    assert params_store.get_crop_profile("avocado").max_slope_percent == 99


def test_delete_removes_profile():
    assert params_store.delete_crop_profile("maize") is True
    assert params_store.get_crop_profile("maize") is None


def test_delete_unknown_profile_returns_false():
    assert params_store.delete_crop_profile("does_not_exist") is False


def test_weights_roundtrip():
    params_store.set_criterion_weights({"annual_rainfall_mm": 0.5, "mean_temp_c": 0.3, "elevation_m": 0.2})
    assert params_store.get_criterion_weights() == {
        "annual_rainfall_mm": 0.5,
        "mean_temp_c": 0.3,
        "elevation_m": 0.2,
    }


def test_persists_across_reads():
    params_store.set_criterion_weights({"annual_rainfall_mm": 1.0, "mean_temp_c": 0.0, "elevation_m": 0.0})
    # A fresh read (no in-memory cache to fall back on) must see the same value.
    assert params_store.get_criterion_weights()["annual_rainfall_mm"] == 1.0
