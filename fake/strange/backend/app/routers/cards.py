"""角色卡生成端点：LLM 生成 + 创建会话。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import cardgen, store

router = APIRouter()


class GenerateRequest(BaseModel):
    prompt: str = ""


class CreateCardRequest(BaseModel):
    card: dict


@router.post("/cards/generate")
async def generate(body: GenerateRequest):
    settings = store.get_settings()
    if not (settings.get("apiKey") or "").strip():
        raise HTTPException(400, "API Key Required")
    prompt = (body.prompt or "").strip()
    if not prompt:
        raise HTTPException(400, "Empty prompt")
    try:
        return await cardgen.generate_card(settings, prompt)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, str(e))


@router.post("/cards/create")
def create_card(body: CreateCardRequest):
    card = body.card
    if not isinstance(card, dict) or not isinstance(card.get("data"), dict):
        raise HTTPException(400, "Invalid card")
    if not (card["data"].get("name") or "").strip():
        raise HTTPException(400, "Card name required")
    settings = store.get_settings()
    return store.create_session(card, settings.get("userName") or "User")
