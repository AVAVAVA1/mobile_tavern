"""假 OpenAI 兼容 LLM 服务器（带请求记录），用于多轮上下文验证。

- 把每次请求的完整 messages 记录到 backend/mock_requests.jsonl
- 根据 system prompt 内容判定请求类型（planner/writer/status/summarize/other）
- 支持 set_status_schema / update_status 两个工具调用
- 返回内容带唯一 id，便于跨请求追踪
"""
import itertools
import json
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

BASE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(BASE, "mock_requests.jsonl")

_counter = itertools.count(1)
_status_calls = itertools.count(1)

app = FastAPI()


def detect_kind(sys_text: str) -> str:
    if "Summarize the conversation" in sys_text:
        return "summarize"
    if "故事规划代理" in sys_text:
        return "planner"
    if "状态管理代理" in sys_text:
        return "status"
    if "专业的故事写作代理" in sys_text:
        return "writer"
    if "角色卡分析器" in sys_text:
        return "analyzer"
    if "ComfyUI 提示词工程师" in sys_text:
        return "prompt_engineer"
    return "other"


def _tool_call(rid, name, args):
    return {
        "id": f"call_{rid}",
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)},
    }


@app.post("/v1/chat/completions")
async def completions(request: Request):
    body = await request.json()
    rid = next(_counter)
    messages = body.get("messages", [])
    stream = bool(body.get("stream", False))
    tools = body.get("tools")

    sys_text = "\n".join(m.get("content", "") for m in messages if m.get("role") == "system")
    kind = detect_kind(sys_text)
    last_user = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")

    with open(LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "id": rid,
            "kind": kind,
            "stream": stream,
            "messages": messages,
        }, ensure_ascii=False) + "\n")

    # ---- 工具调用 ----
    if tools:
        names = [t.get("function", {}).get("name") for t in tools if isinstance(t, dict)]
        if "set_status_schema" in names:
            args = {
                "specified": True,
                "fields": [
                    {"key": "location", "label": "当前地点", "type": "string"},
                    {"key": "mood", "label": "情绪状态", "type": "string"},
                ],
            }
            return JSONResponse({"choices": [{"message": {"role": "assistant", "content": None,
                "tool_calls": [_tool_call(rid, "set_status_schema", args)]}, "finish_reason": "tool_calls"}]})
        if "update_status" in names:
            sc = next(_status_calls)
            # 奇数次只更新 mood，偶数次只更新 location —— 用来验证字段级继承
            patch = {"mood": "高兴"} if sc % 2 == 1 else {"location": "卧室"}
            return JSONResponse({"choices": [{"message": {"role": "assistant", "content": None,
                "tool_calls": [_tool_call(rid, "update_status", patch)]}, "finish_reason": "tool_calls"}]})
        if "set_reply_meta" in names:
            args = {"generateImage": True, "imageReason": "mock 触发生图"}
            return JSONResponse({"choices": [{"message": {"role": "assistant", "content": None,
                "tool_calls": [_tool_call(rid, "set_reply_meta", args)]}, "finish_reason": "tool_calls"}]})

    if not stream:
        if kind == "summarize":
            content = f"[SUMMARY#{rid}] {last_user[:120]}"
        elif kind == "planner":
            content = f"[GUIDE#{rid}] 走向基于用户发言: {last_user[:60]}"
        elif kind == "prompt_engineer":
            content = "masterpiece, best quality, highres, detailed, 1girl, solo, long hair"
        else:
            content = f"[GENERIC#{rid}]"
        return JSONResponse({
            "choices": [{"message": {"role": "assistant", "content": content}, "finish_reason": "stop"}]
        })

    # 流式（writer / status）
    if kind == "status":
        label = f"[STATUS#{rid}]"
    else:
        label = f"[TEXT#{rid}]"
    pieces = [label, "·", "流", "·", str(rid)]

    def gen():
        for p in pieces:
            chunk = json.dumps({"choices": [{"delta": {"content": p}, "finish_reason": None}]}, ensure_ascii=False)
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
