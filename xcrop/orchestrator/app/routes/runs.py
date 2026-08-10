from fastapi import APIRouter

from app import db

router = APIRouter(tags=["runs"])


@router.get("/runs")
async def list_all_runs_route(limit: int = 200) -> list[dict]:
    """Cross-project run history for the desktop app's Dashboard view - see
    routes/projects.py's /projects/{id}/runs for the per-project equivalent the map
    view's own sidebar uses instead."""
    return db.list_all_runs(limit=limit)
