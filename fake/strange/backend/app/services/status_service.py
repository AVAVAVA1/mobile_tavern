"""状态栏更新服务：正文生成后按 schema 做一次结构化状态栏更新（失败不阻断）。"""
from __future__ import annotations

from typing import Optional

from .. import store
from ..agent.status_manager import (
    build_status_messages,
    format_status,
    parse_status_update,
)
from ..analysis import effective_status_schema
from ..llm import call_chat_non_streaming, strip_thinking


async def update_status(
    session_id: str,
    session: dict,
    card: dict,
    settings: dict,
    user_name: str,
) -> Optional[dict]:
    """返回 `{"type":"status_delta","content":...}` 事件 dict，或 None。"""
    assistant = store.get_session(session_id)["messages"]
    # 最后一条 assistant 非 status 消息即本次正文（去掉思维链，只按正文更新状态）
    latest_text = ""
    for m in reversed(assistant):
        if m["role"] == "assistant" and m.get("messageType") != "status":
            latest_text = strip_thinking(m.get("content") or "")
            break

    schema = effective_status_schema(session)
    prev_data = session.get("statusData") or {}
    status_msgs = build_status_messages(card, prev_data, latest_text[-2000:], schema, user_name)

    status_msg = {
        "id": store.gen_id(),
        "role": "system",
        "content": "",
        "timestamp": store.now_ms(),
        "messageType": "status",
    }
    store.add_message(session_id, status_msg)

    new_data = dict(prev_data or {})
    try:
        resp = await call_chat_non_streaming(settings, status_msgs, kind="status")
        new_data = parse_status_update(resp, prev_data)
    except Exception:
        pass

    final_status = format_status(new_data, schema)
    store.set_message(session_id, status_msg["id"], content=final_status)
    store.update_status(session_id, final_status, new_data)
    return {"type": "status_delta", "content": final_status}
