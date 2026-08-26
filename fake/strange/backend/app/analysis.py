"""角色卡意图理解（可扩展）。

导入时用 LLM 从卡中提取结构化元数据（当前：状态栏 schema），结果缓存进
`card.data.card_analysis`。新增提取器只需在 analyze_card() 里追加一次调用。
"""
from __future__ import annotations

import json
from typing import List, Optional

from .llm import call_chat_non_streaming


def default_status_schema() -> dict:
    """默认通用状态栏 schema（SFW，作者未指定时使用）。"""
    return {
        "specified": False,
        "fields": [
            {"key": "location", "label": "当前地点", "type": "string", "description": ""},
            {"key": "mood", "label": "情绪状态", "type": "string", "description": ""},
            {"key": "companions", "label": "在场角色", "type": "list", "description": ""},
            {"key": "current_action", "label": "当前行为", "type": "string", "description": ""},
            {"key": "key_facts", "label": "关键事实", "type": "list", "description": ""},
        ],
    }


def card_text(card: dict) -> str:
    """汇总卡中可能包含作者意图的文本（用于分析）。"""
    data = card.get("data") or {}
    parts: List[str] = []
    for k in ("description", "system_prompt", "post_history_instructions", "creator_notes"):
        v = data.get(k)
        if v:
            parts.append(str(v).strip())
    book = data.get("character_book") or (data.get("extensions") or {}).get("character_book")
    if isinstance(book, dict):
        for e in book.get("entries") or []:
            if e.get("constant") and e.get("enabled") is not False:
                c = e.get("content")
                if c:
                    parts.append(f"[世界书条目] {c.strip()}")
    return "\n\n".join(p for p in parts if p).strip()


def _extract_tool_args(resp: dict, name: str) -> Optional[str]:
    choices = resp.get("choices") or []
    msg = (choices[0].get("message") if choices else None) or {}
    for tc in msg.get("tool_calls") or []:
        fn = (tc or {}).get("function") or {}
        if fn.get("name") == name:
            return fn.get("arguments")
    return None


# ---------------------------------------------------------------- 状态栏 schema 提取器

_STATUS_SCHEMA_TOOL = {
    "type": "function",
    "function": {
        "name": "set_status_schema",
        "description": "判断角色卡作者是否要求维护角色状态栏，并提取要跟踪的字段。",
        "parameters": {
            "type": "object",
            "properties": {
                "specified": {
                    "type": "boolean",
                    "description": "作者是否在卡中描述了状态栏/角色状态跟踪的要求",
                },
                "fields": {
                    "type": "array",
                    "description": "要跟踪的字段列表（specified=false 时给空数组）",
                    "items": {
                        "type": "object",
                        "properties": {
                            "key": {"type": "string", "description": "稳定英文 snake_case 标识"},
                            "label": {"type": "string", "description": "作者原文的中文标签"},
                            "type": {"type": "string", "enum": ["string", "list", "enum", "number"]},
                            "description": {"type": "string"},
                        },
                        "required": ["key", "label", "type"],
                    },
                },
            },
            "required": ["specified", "fields"],
        },
    },
}


def _normalize_fields(raw) -> list:
    out = []
    if not isinstance(raw, list):
        return out
    for f in raw:
        if not isinstance(f, dict):
            continue
        key = (f.get("key") or "").strip()
        label = (f.get("label") or "").strip()
        if not key or not label:
            continue
        ftype = f.get("type") if f.get("type") in ("string", "list", "enum", "number") else "string"
        out.append({
            "key": key,
            "label": label,
            "type": ftype,
            "description": (f.get("description") or "").strip(),
        })
        if len(out) >= 8:
            break
    return out


async def extract_status_schema(card: dict, settings: dict) -> dict:
    text = card_text(card)
    if not text:
        return default_status_schema()
    msgs = [
        {"role": "system", "content": "你是角色卡分析器。只调用给出的工具，不要输出任何额外文字。"},
        {"role": "user", "content": f"分析下面的角色卡，判断是否要求维护状态栏并提取字段：\n\n{text[:6000]}"},
    ]
    try:
        resp = await call_chat_non_streaming(
            settings,
            msgs,
            tools=[_STATUS_SCHEMA_TOOL],
            tool_choice={"type": "function", "function": {"name": "set_status_schema"}},
        )
        args = _extract_tool_args(resp, "set_status_schema")
        if args:
            result = json.loads(args)
            fields = _normalize_fields(result.get("fields"))
            if result.get("specified") and fields:
                return {"specified": True, "fields": fields}
    except Exception:
        pass
    return default_status_schema()


# ---------------------------------------------------------------- 注册表（可扩展）

async def analyze_card(card: dict, settings: dict) -> dict:
    """运行所有提取器，返回 {提取器名: 结果}。

    扩展方式：新增一个 extract_xxx(card, settings) 并在下方追加
    `results["xxx"] = await extract_xxx(card, settings)`。
    """
    results: dict = {
        "status_schema": await extract_status_schema(card, settings),
    }
    # 预留：results["style"] = await extract_style(card, settings)
    return results


def effective_status_schema(session: dict) -> dict:
    """状态栏 schema 优先级：会话内用户编辑 > 卡提取(card_analysis) > 默认。"""
    s = session.get("statusSchema")
    if isinstance(s, dict) and s.get("fields"):
        return s
    data = (session.get("characterCard") or {}).get("data") or {}
    analysis = data.get("card_analysis") or {}
    s = analysis.get("status_schema")
    if isinstance(s, dict) and s.get("fields"):
        return s
    return default_status_schema()
