"""OpenAI 兼容的流式/非流式 LLM 客户端（httpx）。"""
from __future__ import annotations

import json
import re
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

import httpx

from .logging import log_llm_request, log_llm_response


def _clean_key(api_key: str) -> str:
    return "".join(ch for ch in api_key if 0x20 <= ord(ch) <= 0x7E).strip()


def _url(settings: Dict[str, Any]) -> str:
    base = (settings.get("baseUrl") or "").rstrip("/")
    return f"{base}/chat/completions"


def _headers(settings: Dict[str, Any]) -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_clean_key(settings.get('apiKey', ''))}",
    }


def _messages(messages: List[dict]) -> List[dict]:
    return [{"role": m.get("role"), "content": m.get("content", "")} for m in messages]


def strip_thinking(text: str) -> str:
    """去掉 <thinking>...</thinking> 思维链（含未闭合），用于下游取正文（元数据/生图）。"""
    return re.sub(r"<thinking>[\s\S]*?(?:</thinking>|$)", "", text or "").strip()


def _apply_thinking_params(body: Dict[str, Any], settings: Dict[str, Any]) -> None:
    """开启思考模式：thinking + reasoning_effort（DeepSeek V4 格式）。"""
    if settings.get("enableThinking", True):
        body["thinking"] = {"type": "enabled"}
        body["reasoning_effort"] = settings.get("reasoningEffort") or "high"


async def stream_chat(
    settings: Dict[str, Any],
    messages: List[dict],
    check_disconnect: Optional[Callable[[], Any]] = None,
    kind: str = "chat",
) -> AsyncIterator[str]:
    """流式请求，逐段 yield 正文增量。check_disconnect 可为 async 可调用（返回真值则中断）。"""
    log_llm_request(kind, settings.get("model") or "", _url(settings), _messages(messages))
    parts: List[str] = []
    in_reasoning = False
    client = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0))
    try:
        body: Dict[str, Any] = {
            "model": settings.get("model"),
            "messages": _messages(messages),
            "stream": True,
        }
        _apply_thinking_params(body, settings)
        async with client.stream(
            "POST",
            _url(settings),
            headers=_headers(settings),
            json=body,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise RuntimeError(f"API error {resp.status_code}: {body.decode('utf-8', 'replace')[:2000]}")

            async for line in resp.aiter_lines():
                if check_disconnect is not None:
                    disconnected = check_disconnect()
                    if asyncio_iscoro(disconnected):
                        disconnected = await disconnected
                    if disconnected:
                        break
                line = line.strip()
                if not line or not line.startswith("data: "):
                    continue
                data = line[len("data: "):]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    choices = chunk.get("choices") or []
                    delta = (choices[0].get("delta") if choices else None) or {}
                    reasoning = (
                        delta.get("reasoning_content")
                        or delta.get("reasoning")
                        or delta.get("reasoning_text")
                        or delta.get("thinking")
                    )
                    content = delta.get("content")
                    # 推理模型的思考内容（reasoning_content 等）包成 <thinking>，前端据此显示思维链
                    if reasoning:
                        if not in_reasoning:
                            parts.append("<thinking>")
                            yield "<thinking>"
                            in_reasoning = True
                        parts.append(reasoning)
                        yield reasoning
                    if content:
                        if in_reasoning:
                            parts.append("</thinking>")
                            yield "</thinking>"
                            in_reasoning = False
                        parts.append(content)
                        yield content
                except (json.JSONDecodeError, TypeError, ValueError):
                    continue
            if in_reasoning:
                parts.append("</thinking>")
                yield "</thinking>"
        log_llm_response(kind, "".join(parts))
    finally:
        await client.aclose()


async def call_chat_non_streaming(
    settings: Dict[str, Any],
    messages: List[dict],
    tools: Optional[List[dict]] = None,
    tool_choice: Optional[Any] = None,
    kind: str = "llm",
) -> dict:
    body: Dict[str, Any] = {
        "model": settings.get("model"),
        "messages": _messages(messages),
        "stream": False,
    }
    _apply_thinking_params(body, settings)
    if tools:
        body["tools"] = tools
        body["tool_choice"] = tool_choice if tool_choice is not None else "auto"

    log_llm_request(kind, settings.get("model") or "", _url(settings), _messages(messages))
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
        resp = await client.post(_url(settings), headers=_headers(settings), json=body)
        if resp.status_code != 200:
            raise RuntimeError(f"API error {resp.status_code}: {resp.text[:2000]}")
        data = resp.json()
        log_llm_response(kind, json.dumps(data, ensure_ascii=False, indent=2))
        return data


def asyncio_iscoro(obj: Any) -> bool:
    import inspect
    return inspect.iscoroutine(obj)
