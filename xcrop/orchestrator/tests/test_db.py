import pytest

from app import db


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Points DB_PATH at a throwaway sqlite file per test, same isolation reasoning as
    test_params_store.py's isolated_params_file - without this, tests would read/write
    the real ~/.xcrop/xcrop.sqlite3."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.sqlite3")
    db.init_db()


def test_list_all_runs_joins_project_name_newest_first():
    project_a = db.create_project("Project A", {"type": "Polygon", "coordinates": []})
    project_b = db.create_project("Project B", {"type": "Polygon", "coordinates": []})

    db.save_run(project_a["id"], "avocado", {"summary": {"mean_suitability": 80.0}})
    db.save_run(project_b["id"], "maize", {"summary": {"mean_suitability": 60.0}})

    runs = db.list_all_runs()

    assert len(runs) == 2
    # Newest first: project B's run was saved second.
    assert runs[0]["project_name"] == "Project B"
    assert runs[0]["crop_id"] == "maize"
    assert runs[1]["project_name"] == "Project A"
    assert runs[1]["crop_id"] == "avocado"


def test_list_all_runs_respects_limit():
    project = db.create_project("Project", {"type": "Polygon", "coordinates": []})
    for crop_id in ("avocado", "maize", "coffee_arabica"):
        db.save_run(project["id"], crop_id, {"summary": {}})

    assert len(db.list_all_runs(limit=2)) == 2


def test_list_all_runs_empty_when_no_runs():
    assert db.list_all_runs() == []
