from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import ensure_indexes, get_db
from app.routes import chat, health, invitations, org_admin, super_admin
from app.services import anthropic_client


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_indexes()
    await anthropic_client.ensure_configured(get_db())
    yield


app = FastAPI(title="Homie Proxy Gateway", lifespan=lifespan)

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(super_admin.router)
app.include_router(org_admin.router)
app.include_router(invitations.router)
