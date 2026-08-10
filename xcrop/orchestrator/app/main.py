from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routes import analyze, chat, params, projects, runs, settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="xcrop orchestrator", lifespan=lifespan)

# This is a localhost-only sidecar the Electron app spawns for itself (see
# desktop/electron/main.ts) - CORS is wide open here because the only caller is the
# desktop shell's own renderer process on the same machine, not a public API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router)
app.include_router(projects.router)
app.include_router(analyze.router)
app.include_router(params.router)
app.include_router(chat.router)
app.include_router(runs.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
