"""AI 回复元数据表：每次回复附带，用于触发后续动作（生图等）。

表用 Pydantic 定义，通过 function calling 让 LLM 填写；字段可扩展。
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .llm import call_chat_non_streaming


class ReplyMeta(BaseModel):
    """每次 AI 回复附带的元数据表（不计入历史）。"""

    generateImage: bool = Field(
        default=False,
        description="当前场景是否精彩/重要/特别，值得生成一张图片",
    )
    imageReason: str = Field(default="", description="为什么值得生图（简要，调试用）")


SET_REPLY_META_TOOL: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "set_reply_meta",
        "description": "填写这条 AI 回复的元数据表（是否生图等）。",
        "parameters": {
            "type": "object",
            "properties": {
                "generateImage": {
                    "type": "boolean",
                    "description": "当前场景是否精彩/重要/特别，值得生成一张图片",
                },
                "imageReason": {
                    "type": "string",
                    "description": "为什么值得生图（简要，调试用）",
                },
            },
            "required": ["generateImage"],
        },
    },
}


def parse_reply_meta(resp: dict) -> ReplyMeta:
    choices = resp.get("choices") or []
    msg = (choices[0].get("message") if choices else None) or {}
    for tc in msg.get("tool_calls") or []:
        fn = (tc or {}).get("function") or {}
        if fn.get("name") != "set_reply_meta":
            continue
        try:
            args = json.loads(fn.get("arguments") or "{}")
            return ReplyMeta(**args)
        except (json.JSONDecodeError, TypeError, ValueError):
            break
    return ReplyMeta()


async def fill_reply_meta(
    settings: dict,
    reply_text: str,
    user_last_text: str,
    history_hint: Optional[List[dict]] = None,
) -> ReplyMeta:
    """用 LLM 判断这条回复是否值得生图，返回元数据表。"""
    system = (
        "你是场景评估器。根据用户的最新发言和 AI 的回复，判断这个场景是否值得生成一张图片。\n"
        "值得生图：精彩、重要、特别（关键转折 / 重要角色登场 / 强烈情感 / 独特画面）。\n"
        "不值得生图：普通寒暄、日常闲聊、信息性回复。\n"
        "调用 set_reply_meta 填写。"
    )
    user = f"用户最新发言：{user_last_text}\n\nAI 回复：{reply_text}\n\n请判断是否生图。"

    try:
        resp = await call_chat_non_streaming(
            settings,
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            tools=[SET_REPLY_META_TOOL],
            tool_choice={"type": "function", "function": {"name": "set_reply_meta"}},
        )
        return parse_reply_meta(resp)
    except Exception:
        return ReplyMeta()
