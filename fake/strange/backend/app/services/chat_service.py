"""对话编排服务：一次对话的完整流程（正文 → 状态栏 → 元数据 → 自动生图 → 自动总结）。

产出 SSE 事件 dict（由路由层序列化成 `data: <json>` 行）。行为与原 chat.py 内联实现一致。
"""
from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator, Optional

from .. import store
from ..llm import stream_chat
from ..prompt.template import build_conversation_context
from ..reply_meta import fill_reply_meta
from .image_service import maybe_generate_image
from .status_service import update_status
from .summarize_service import maybe_summarize


async def run_chat_turn(
    session_id: str,
    text: str,
    check_disconnect: Optional[Any] = None,
) -> AsyncIterator[dict]:
    """执行一次对话，逐条产出事件 dict（type 见 SPEC 的 SSE 事件）。"""
    session = store.get_session(session_id)
    settings = store.get_settings()
    card = session["characterCard"]
    user_name = session.get("userName") or "User"
    threshold = settings.get("summarizeThreshold") or 30

    user_msg = {"id": store.gen_id(), "role": "user", "content": text, "timestamp": store.now_ms()}
    assistant_msg = {"id": store.gen_id(), "role": "assistant", "content": "", "timestamp": store.now_ms()}
    store.add_message(session_id, user_msg)
    store.add_message(session_id, assistant_msg)

    try:
        full = store.get_session(session_id)["messages"]
        history = [
            {"role": m["role"], "content": m["content"], "id": m["id"]}
            for m in full
            if m["id"] != assistant_msg["id"] and m.get("messageType") not in ("status", "image")
        ]

        # 状态栏作为上下文注入（可选）
        status = session.get("status") if settings.get("statusBarEnabled") else ""

        context = build_conversation_context(
            card, history, user_name,
            session.get("summary") or None,
            session.get("lastSummarizedIndex"),
            settings,
            session.get("deletedMessageIds"),
            status=status,
        )

        # 1. 单次流式生成正文
        async for chunk in stream_chat(settings, context, check_disconnect):
            store.append_message_content(session_id, assistant_msg["id"], chunk)
            yield {"type": "delta", "content": chunk}

        # 2. 可选状态栏更新（正文之后，不阻塞正文首字）
        if settings.get("statusBarEnabled"):
            status_event = await update_status(session_id, session, card, settings, user_name)
            if status_event:
                yield status_event

        # 3. 填写元数据表（每次回复都填，用于触发后续动作）
        reply_content = (store.get_message(session_id, assistant_msg["id"]) or {}).get("content", "")
        meta = await fill_reply_meta(settings, reply_content, text)
        store.set_message(session_id, assistant_msg["id"], replyMeta=meta.model_dump())
        yield {"type": "reply_meta", "meta": meta.model_dump()}

        # 4. 自动生图（元数据表触发）
        if meta.generateImage:
            yield {"type": "image_generating"}
            image_event = await maybe_generate_image(settings, reply_content, session_id, assistant_msg["id"])
            if image_event:
                yield image_event
    except asyncio.CancelledError:
        store.persist()
        raise
    except Exception as e:
        store.persist()
        yield {"type": "error", "message": str(e)}
        yield {"type": "done"}
        return

    store.persist()

    summary_event = await maybe_summarize(session_id, settings, threshold)
    if summary_event:
        yield summary_event

    yield {"type": "done"}
