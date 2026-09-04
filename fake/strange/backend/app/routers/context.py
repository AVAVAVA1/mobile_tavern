"""历史管理 / 上下文查看 / 手动总结。"""
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import store
from ..prompt.summarizer import summarize_history
from ..prompt.template import build_conversation_context

router = APIRouter()


class SummarizeRequest(BaseModel):
    messageIds: List[str] = []
    prompt: str = ""


class ApplySummaryRequest(BaseModel):
    summary: str
    messageIds: List[str] = []


def _chat_history(session: dict) -> List[dict]:
    return [
        {"role": m["role"], "content": m["content"], "id": m["id"]}
        for m in session["messages"]
        if m.get("messageType") != "status"
    ]


@router.get("/sessions/{session_id}/context")
def get_context(session_id: str):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    settings = store.get_settings()
    card = session["characterCard"]
    user_name = session.get("userName") or "User"
    chat_history = _chat_history(session)

    status = session.get("status") if settings.get("statusBarEnabled") else ""
    ctx = build_conversation_context(
        card, chat_history, user_name,
        session.get("summary") or None,
        session.get("lastSummarizedIndex"),
        settings,
        session.get("deletedMessageIds"),
        status=status,
        presets=store.get_global_presets(),
        global_world_info=store.get_global_world_info(),
    )
    return {
        "mode": "normal",
        "chatMessages": [m for m in ctx if m["role"] in ("user", "assistant")],
        "systemMessages": [m for m in ctx if m["role"] == "system"],
        "plannerSystem": [],
        "writerSystem": [],
        "statusSystem": [],
        "injectedEntries": {"planner": [], "writer": [], "status": []},
    }


@router.post("/sessions/{session_id}/summarize")
async def summarize(session_id: str, body: SummarizeRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    settings = store.get_settings()
    chat_history = _chat_history(session)

    if body.messageIds:
        id_set = set(body.messageIds)
        msgs = [{"role": m["role"], "content": m["content"]} for m in chat_history if m.get("id") in id_set]
    else:
        msgs = [{"role": m["role"], "content": m["content"]} for m in chat_history]

    if not msgs:
        return {"summary": ""}

    prompt = body.prompt.strip() or None
    result = await summarize_history(settings, "", msgs, prompt)
    return {"summary": result}


@router.post("/sessions/{session_id}/summary/apply")
def apply_summary(session_id: str, body: ApplySummaryRequest):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    if body.messageIds:
        indices = []
        for mid in body.messageIds:
            for i, m in enumerate(session["messages"]):
                if m["id"] == mid:
                    indices.append(i)
        last_idx = max(indices) if indices else -1
    else:
        last_idx = len(session["messages"]) - 1

    if last_idx < 0:
        last_idx = len(session["messages"]) - 1

    store.update_summary(session_id, body.summary, last_idx)
    return store.get_session(session_id)
