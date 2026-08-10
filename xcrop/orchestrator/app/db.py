import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from app.config import DATA_DIR

DB_PATH = DATA_DIR / "xcrop.sqlite3"

# Project/SuitabilityRun below are a deliberately thin slice of the full Data Model
# (Section 12 of the AICSIS doc) - just enough to persist "what AOI, what crop, what
# result" across app restarts. Scenario/Criterion/WorkflowRecord/Dataset versioning are
# not modelled yet; see xcrop/README.md for what's deferred and why.
_SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aoi_geojson TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    crop_id TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(_SCHEMA)


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_project(name: str, aoi_geojson: dict) -> dict:
    project = {
        "id": str(uuid.uuid4()),
        "name": name,
        "aoi_geojson": aoi_geojson,
        "created_at": _now(),
    }
    with _connect() as conn:
        conn.execute(
            "INSERT INTO projects (id, name, aoi_geojson, created_at) VALUES (?, ?, ?, ?)",
            (project["id"], project["name"], json.dumps(aoi_geojson), project["created_at"]),
        )
    return project


def list_projects() -> list[dict]:
    # rowid DESC as a tiebreaker: two projects/runs created within the same
    # microsecond (isoformat()'s own resolution - plausible back-to-back, not just in
    # tests) would otherwise sort ambiguously on created_at alone. rowid is SQLite's own
    # implicit auto-increment column, strictly increasing with insertion order, so this
    # always resolves ties as "most recently inserted first" with no extra column needed.
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC, rowid DESC").fetchall()
    return [_row_to_project(r) for r in rows]


def get_project(project_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _row_to_project(row) if row else None


def _row_to_project(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "aoi_geojson": json.loads(row["aoi_geojson"]),
        "created_at": row["created_at"],
    }


def save_run(project_id: str, crop_id: str, result: dict[str, Any]) -> dict:
    run = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "crop_id": crop_id,
        "result": result,
        "created_at": _now(),
    }
    with _connect() as conn:
        conn.execute(
            "INSERT INTO runs (id, project_id, crop_id, result_json, created_at) VALUES (?, ?, ?, ?, ?)",
            (run["id"], project_id, crop_id, json.dumps(result), run["created_at"]),
        )
    return run


def get_run(run_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "crop_id": row["crop_id"],
        "result": json.loads(row["result_json"]),
        "created_at": row["created_at"],
    }


def list_runs(project_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC, rowid DESC", (project_id,)
        ).fetchall()
    return [
        {
            "id": r["id"],
            "project_id": r["project_id"],
            "crop_id": r["crop_id"],
            "result": json.loads(r["result_json"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def list_all_runs(limit: int = 200) -> list[dict]:
    """Every run across every project, newest first, with the owning project's name
    joined in - the Dashboard's run history needs this cross-project view; the
    per-project list_runs above only serves the map view's own project sidebar."""
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT runs.*, projects.name AS project_name
            FROM runs
            JOIN projects ON projects.id = runs.project_id
            ORDER BY runs.created_at DESC, runs.rowid DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "project_id": r["project_id"],
            "project_name": r["project_name"],
            "crop_id": r["crop_id"],
            "result": json.loads(r["result_json"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]
