"""会话路由：列表 / 详情 / 导入 / 删除 / 修改 / 从上下文移除。"""
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from .. import store
from ..analysis import analyze_card
from ..parser.character_card import parse_character_card

router = APIRouter()


class PatchSession(BaseModel):
    title: Optional[str] = None
    characterBook: Optional[dict] = None
    agentBook: Optional[dict] = None
    statusSchema: Optional[dict] = None


@router.get("/sessions")
def list_sessions():
    return store.list_sessions()


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    s = store.get_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.post("/sessions/import")
async def import_card(file: UploadFile = File(...)):
    data = await file.read()
    card = parse_character_card(data)
    if not card:
        raise HTTPException(
            400,
            "Could not parse character data from this PNG. "
            "Make sure it's a valid character card from 类脑 or SillyTavern.",
        )
    settings = store.get_settings()
    # 导入时做一次卡意图分析（提取状态栏 schema 等），失败不阻断导入
    if (settings.get("apiKey") or "").strip():
        try:
            card["data"]["card_analysis"] = await analyze_card(card, settings)
        except Exception:
            pass
    session = store.create_session(card, settings.get("userName") or "User")
    return session


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    if not store.delete_session(session_id):
        raise HTTPException(404, "Session not found")
    return {"ok": True}


@router.patch("/sessions/{session_id}")
def patch_session(session_id: str, body: PatchSession):
    s = store.get_session(session_id)
    if not s:
        raise HTTPException(404, "Session not found")

    if body.title is not None:
        s["title"] = body.title
    if body.characterBook is not None:
        s["characterCard"]["data"]["character_book"] = body.characterBook
    if body.agentBook is not None:
        s["characterCard"]["data"]["agent_book"] = body.agentBook
    if body.statusSchema is not None:
        s["statusSchema"] = body.statusSchema

    store.persist()
    return s


@router.delete("/sessions/{session_id}/context/{message_id}")
def remove_from_context(session_id: str, message_id: str):
    if not store.get_session(session_id):
        raise HTTPException(404, "Session not found")
    store.remove_from_context(session_id, message_id)
    return store.get_session(session_id)
