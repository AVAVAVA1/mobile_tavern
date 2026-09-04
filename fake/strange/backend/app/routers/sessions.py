"""会话路由：列表 / 详情 / 导入 / 导出 / 删除 / 修改 / 从上下文移除。"""
import base64
import copy
import json
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from .. import store
from ..analysis import analyze_card
from ..parser.character_card import parse_character_card
from ..parser.png import inject_text_chunk

router = APIRouter()

# 1x1 透明 PNG（无头像时的兜底图片）
_BLANK_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def _avatar_png_bytes(card: dict) -> bytes:
    """从卡里取头像 PNG 字节；无有效头像则用空白 PNG。"""
    avatar = (card.get("data") or {}).get("avatar")
    if isinstance(avatar, str) and avatar:
        try:
            if avatar.startswith("data:image/png;base64,"):
                raw = base64.b64decode(avatar.split(",", 1)[1])
            elif avatar.startswith("data:image/"):
                return _BLANK_PNG
            else:
                raw = base64.b64decode(avatar)
            if raw.startswith(b"\x89PNG"):
                return raw
        except Exception:
            pass
    return _BLANK_PNG


def _build_export_data(card: dict) -> dict:
    """构造导出用的 data（去掉 MobileTavern 专属字段，正则脚本归一进 extensions）。"""
    data = copy.deepcopy(card.get("data") or {})
    data.pop("card_analysis", None)
    ext = dict(data.get("extensions") or {})
    if not isinstance(ext.get("regex_scripts"), list):
        for key in ("regexScripts", "regex_scripts"):
            if isinstance(data.get(key), list):
                ext["regex_scripts"] = copy.deepcopy(data[key])
                data.pop(key, None)
                break
    data["extensions"] = ext
    return data


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


@router.get("/sessions/{session_id}/export")
def export_card(session_id: str):
    """导出角色卡 PNG（V2 chara chunk，含世界书/正则脚本）。"""
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    card = session["characterCard"]
    data = _build_export_data(card)
    payload = json.dumps({"spec": "chara_card_v2", "spec_version": "2.0", "data": data}, ensure_ascii=False)
    chunk_value = base64.b64encode(payload.encode("utf-8")).decode("ascii")
    png = inject_text_chunk(_avatar_png_bytes(card), "chara", chunk_value)
    name = (data.get("name") or session_id or "character").strip() or "character"
    safe_name = "".join(c for c in name if c not in '\\/:*?"<>|')
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.png"'},
    )


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
