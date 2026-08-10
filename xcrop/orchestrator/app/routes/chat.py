from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db
from app.chat_ai import build_chat_system_prompt
from app.config import get_settings
from app.homie_client import HomieApiError, HomieClient

router = APIRouter(tags=["chat"])


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatTurn]
    # Grounds the assistant in one run's actual data (see chat_ai.py) - the orchestrator
    # keeps no server-side conversation state (mirrors Anthropic's own Messages API: the
    # client resends the full transcript every turn), so this is re-resolved on every call
    # rather than pinned to whatever run was active when the chat started.
    run_id: str | None = None


@router.post("/chat")
async def chat_route(body: ChatRequest) -> dict:
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")

    context = None
    if body.run_id:
        run = db.get_run(body.run_id)
        if run:
            context = {
                "crop": run["result"].get("crop_name", run["crop_id"]),
                "summary": run["result"]["summary"],
                "points": run["result"]["points"],
            }

    system = build_chat_system_prompt(context)

    try:
        client = HomieClient(get_settings())
        response = await client.chat(
            messages=[{"role": m.role, "content": m.content} for m in body.messages],
            system=system,
            max_tokens=1500,
        )
    except HomieApiError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    text = "".join(
        block.get("text", "") for block in response["message"].get("content", []) if block.get("type") == "text"
    )

    return {
        "reply": text,
        "deducted_credits": response.get("deducted_credits"),
        "remaining_credits": response.get("remaining_credits"),
    }
