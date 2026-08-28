"""对话 SSE 路由：只做 HTTP 校验与 SSE 序列化；业务编排在 services/chat_service.py。"""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import store
from ..services.chat_service import run_chat_turn

router = APIRouter()


class ChatRequest(BaseModel):
    text: str = ""


def _sse(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


@router.post("/sessions/{session_id}/chat")
async def chat(session_id: str, body: ChatRequest, request: Request):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    settings = store.get_settings()
    if not (settings.get("apiKey") or "").strip():
        raise HTTPException(400, "API Key Required")

    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Empty message")

    async def gen():
        async for event in run_chat_turn(session_id, text, request.is_disconnected):
            yield _sse(event)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
