from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db

router = APIRouter(prefix="/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str
    aoi_geojson: dict


@router.get("")
async def list_projects_route() -> list[dict]:
    return db.list_projects()


@router.post("")
async def create_project_route(body: CreateProjectRequest) -> dict:
    return db.create_project(body.name, body.aoi_geojson)


@router.get("/{project_id}")
async def get_project_route(project_id: str) -> dict:
    project = db.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/runs")
async def list_runs_route(project_id: str) -> list[dict]:
    if not db.get_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return db.list_runs(project_id)
