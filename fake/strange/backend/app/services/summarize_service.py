"""自动总结服务：满足阈值条件则触发自动总结。"""
from __future__ import annotations

from typing import Optional

from .. import store
from ..prompt.summarizer import DEFAULT_SUMMARIZE_PROMPT, summarize_history


async def maybe_summarize(session_id: str, settings: dict, threshold: int) -> Optional[dict]:
    """满足阈值条件则触发自动总结，返回 summary 事件 dict（或 None）。"""
    session = store.get_session(session_id)
    if not session:
        return None

    card_data = (session["characterCard"].get("data") or {})
    has_first_mes = bool(card_data.get("first_mes"))
    updated = session["messages"]
    real = [m for m in updated if m.get("messageType") not in ("status", "image")]
    chat_only = real[1:] if has_first_mes else real
    count = len(chat_only)

    if not (threshold > 0 and settings.get("autoSummarize") is not False and count > 0 and count % threshold == 0):
        return None

    last_idx = session.get("lastSummarizedIndex", -1)
    new_msgs = [
        {"role": m["role"], "content": m["content"]}
        for i, m in enumerate(updated)
        if i > last_idx and m.get("messageType") not in ("status", "image")
    ]
    if not new_msgs:
        return None

    new_summary = await summarize_history(
        settings, session.get("summary") or "", new_msgs, DEFAULT_SUMMARIZE_PROMPT
    )
    if not new_summary:
        return None

    store.update_summary(session_id, new_summary, len(updated) - 1)
    return {"type": "summary", "summary": new_summary, "lastSummarizedIndex": len(updated) - 1}
