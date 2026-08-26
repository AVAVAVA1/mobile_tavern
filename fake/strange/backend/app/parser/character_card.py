"""角色卡解析（V1/V2/V3），对齐原 TS 实现。"""
from __future__ import annotations

import base64
import json
from typing import Any, Optional

from .png import parse_png_chunks, read_text_chunk


def parse_character_card(png_bytes: bytes) -> Optional[dict]:
    chunks = parse_png_chunks(png_bytes)

    # 优先 V3 (ccv3)
    for c in chunks:
        if c.type not in ("tEXt", "iTXt"):
            continue
        keyword, text = read_text_chunk(c.data)
        if keyword == "ccv3":
            return parse_card_json(text, "ccv3")

    # V1/V2 (chara / character)
    for c in chunks:
        if c.type not in ("tEXt", "iTXt"):
            continue
        keyword, text = read_text_chunk(c.data)
        if keyword in ("chara", "character"):
            return parse_card_json(text, keyword)

    return None


def parse_card_json(raw: str, chunk_keyword: str = "") -> Optional[dict]:
    # 先尝试直接 JSON parse
    try:
        card = json.loads(raw)
        return normalize_card(card, chunk_keyword)
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    # 再尝试 base64 解码
    try:
        decoded = base64.b64decode(raw, validate=False).decode("utf-8")
        card = json.loads(decoded)
        return normalize_card(card, chunk_keyword)
    except Exception:
        return None


def _parse_meta(spec: str, chunk_keyword: str) -> dict:
    if spec == "chara_card_v3":
        fmt = "V3 (ccv3)"
    elif spec == "chara_card_v2":
        fmt = "V2 (chara_card_v2)"
    elif spec == "chara_card_v1":
        fmt = "V1 (TavernAI)"
    else:
        fmt = spec
    return {"spec": spec, "chunk": chunk_keyword or "", "format": fmt}


def normalize_card(raw: Any, chunk_keyword: str = "") -> Optional[dict]:
    if not isinstance(raw, dict):
        return None

    # V1：字段平铺在顶层
    if raw.get("name") and not raw.get("data"):
        card = {
            "spec": "chara_card_v1",
            "spec_version": "1.0",
            "data": _data_fields(raw),
        }
    # V2/V3：data 内嵌
    elif raw.get("data"):
        d = raw["data"]
        if not isinstance(d, dict):
            return None
        card = {
            "spec": raw.get("spec", "chara_card_v2"),
            "spec_version": raw.get("spec_version", "2.0"),
            "data": _data_fields(d),
        }
    else:
        return None

    card["parse_meta"] = _parse_meta(card["spec"], chunk_keyword)
    return card


def _data_fields(d: dict) -> dict:
    def g(key: str, default: Any = None) -> Any:
        return d.get(key, default)

    return {
        "name": g("name", ""),
        "description": g("description", ""),
        "personality": g("personality", ""),
        "scenario": g("scenario", ""),
        "first_mes": g("first_mes", ""),
        "mes_example": g("mes_example", ""),
        "creator_notes": g("creator_notes"),
        "system_prompt": g("system_prompt"),
        "post_history_instructions": g("post_history_instructions"),
        "alternate_greetings": g("alternate_greetings"),
        "character_version": g("character_version"),
        "tags": g("tags"),
        "creator": g("creator"),
        "extensions": g("extensions"),
        "character_book": g("character_book"),
        "create_date": g("create_date"),
        "avatar": g("avatar"),
        "world_description": g("world_description"),
    }
