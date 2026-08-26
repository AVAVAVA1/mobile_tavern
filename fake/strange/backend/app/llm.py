"""OpenAI 兼容的流式/非流式 LLM 客户端（httpx）。"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

import httpx


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


async def stream_chat(
    settings: Dict[str, Any],
    messages: List[dict],
    check_disconnect: Optional[Callable[[], Any]] = None,
) -> AsyncIterator[str]:
    """流式请求，逐段 yield 正文增量。check_disconnect 可为 async 可调用（返回真值则中断）。"""
    client = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0))
    try:
        async with client.stream(
            "POST",
            _url(settings),
            headers=_headers(settings),
            json={
                "model": settings.get("model"),
                "messages": _messages(messages),
                "stream": True,
            },
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
                    content = delta.get("content")
                    if content:
                        yield content
                except (json.JSONDecodeError, TypeError, ValueError):
                    continue
    finally:
        await client.aclose()


async def call_chat_non_streaming(
    settings: Dict[str, Any],
    messages: List[dict],
    tools: Optional[List[dict]] = None,
    tool_choice: Optional[Any] = None,
) -> dict:
    body: Dict[str, Any] = {
        "model": settings.get("model"),
        "messages": _messages(messages),
        "stream": False,
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = tool_choice if tool_choice is not None else "auto"

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
        resp = await client.post(_url(settings), headers=_headers(settings), json=body)
        if resp.status_code != 200:
            raise RuntimeError(f"API error {resp.status_code}: {resp.text[:2000]}")
        return resp.json()


def asyncio_iscoro(obj: Any) -> bool:
    import inspect
    return inspect.iscoroutine(obj)
