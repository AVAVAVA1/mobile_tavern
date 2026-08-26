"""对话 SSE 路由：单次流式生成 + 可选状态栏更新 + 自动总结。"""
from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import imagegen, store
from ..reply_meta import fill_reply_meta
from ..agent.status_manager import (
    build_status_messages,
    build_status_update_tool,
    format_status,
    parse_status_update,
)
from ..analysis import effective_status_schema
from ..llm import call_chat_non_streaming, stream_chat
from ..prompt.summarizer import DEFAULT_SUMMARIZE_PROMPT, summarize_history
from ..prompt.template import build_conversation_context

router = APIRouter()


class ChatRequest(BaseModel):
    text: str = ""


def _sse(payload: dict) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


async def _maybe_summarize(session_id: str, settings: dict, threshold: int) -> Optional[dict]:
    """满足阈值条件则触发自动总结，返回 summary 事件（或 None）。"""
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


async def _update_status(session_id: str, session: dict, card: dict, settings: dict, user_name: str) -> Optional[dict]:
    """正文生成后，按 schema 做一次结构化状态栏更新（失败不阻断）。"""
    assistant = store.get_session(session_id)["messages"]
    # 最后一条 assistant 非 status 消息即本次正文
    latest_text = ""
    for m in reversed(assistant):
        if m["role"] == "assistant" and m.get("messageType") != "status":
            latest_text = m.get("content") or ""
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
        resp = await call_chat_non_streaming(
            settings,
            status_msgs,
            tools=[build_status_update_tool(schema)],
            tool_choice={"type": "function", "function": {"name": "update_status"}},
        )
        new_data = parse_status_update(resp, prev_data)
    except Exception:
        pass

    final_status = format_status(new_data, schema)
    store.set_message(session_id, status_msg["id"], content=final_status)
    store.update_status(session_id, final_status, new_data)
    return {"type": "status_delta", "content": final_status}


@router.post("/sessions/{session_id}/chat")
async def chat(session_id: str, body: ChatRequest, request: Request):
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    settings = store.get_settings()
    if not (settings.get("apiKey") or "").strip():
        raise HTTPException(400, "API Key Required")

    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Empty message")

    async def gen():
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
            async for chunk in stream_chat(settings, context, request.is_disconnected):
                store.append_message_content(session_id, assistant_msg["id"], chunk)
                yield _sse({"type": "delta", "content": chunk})

            # 2. 可选状态栏更新（正文之后，不阻塞正文首字）
            if settings.get("statusBarEnabled"):
                status_event = await _update_status(session_id, session, card, settings, user_name)
                if status_event:
                    yield _sse(status_event)

            # 3. 填写元数据表（每次回复都填，用于触发后续动作）
            reply_content = (store.get_message(session_id, assistant_msg["id"]) or {}).get("content", "")
            meta = await fill_reply_meta(settings, reply_content, text)
            store.set_message(session_id, assistant_msg["id"], replyMeta=meta.model_dump())
            yield _sse({"type": "reply_meta", "meta": meta.model_dump()})

            # 4. 自动生图（元数据表触发）
            if meta.generateImage:
                yield _sse({"type": "image_generating"})
                result = await imagegen.generate_image(settings, reply_content)
                if result.get("ok"):
                    image_msg = {
                        "id": store.gen_id(),
                        "role": "assistant",
                        "content": "",
                        "timestamp": store.now_ms(),
                        "messageType": "image",
                        "imageUrl": result["url"],
                    }
                    store.insert_message_after(session_id, assistant_msg["id"], image_msg)
                    yield _sse({"type": "image", "image": image_msg})
        except asyncio.CancelledError:
            store.persist()
            raise
        except Exception as e:
            store.persist()
            yield _sse({"type": "error", "message": str(e)})
            yield _sse({"type": "done"})
            return

        store.persist()

        summary_event = await _maybe_summarize(session_id, settings, threshold)
        if summary_event:
            yield _sse(summary_event)

        yield _sse({"type": "done"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
