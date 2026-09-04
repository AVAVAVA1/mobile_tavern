"""Status Manager（状态管理代理）— schema 驱动 + JSON 文本输出 + 字段级继承。

说明：早期用 function calling（update_status 工具），但思考模型（deepseek-v4 等）可能
不返回 OpenAI 式 tool_calls；现改为让模型直接输出 JSON，兼容性更好，并保留 tool_calls 解析兜底。
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from ..prompt.world_book import extract_character_book, get_active_entries, inject_entries


def build_status_update_tool(schema: dict) -> dict:
    """由 schema 生成 update_status 工具的 JSON Schema（保留，供需要 function calling 的场景）。"""
    properties = {}
    for f in schema.get("fields") or []:
        key = f["key"]
        desc = f["label"]
        if f.get("description"):
            desc = f"{f['label']}。{f['description']}"
        if f.get("type") == "list":
            properties[key] = {"type": "array", "items": {"type": "string"}, "description": desc}
        elif f.get("type") == "number":
            properties[key] = {"type": "number", "description": desc}
        else:
            properties[key] = {"type": "string", "description": desc}
    return {
        "type": "function",
        "function": {
            "name": "update_status",
            "description": "更新角色状态：只填写 Latest_Text 中发生变化或新增的字段，未变化的字段不要填。",
            "parameters": {"type": "object", "properties": properties},
        },
    }


def build_status_messages(
    card: dict,
    prev_data: dict,
    latest_text: str,
    schema: dict,
    user_name: str = "",
) -> List[dict]:
    d = card.get("data") or {}
    char_name = d.get("name") or "Character"
    field_list = "\n".join(
        f"- {f['label']}（key={f['key']}，type={f.get('type', 'string')}）"
        for f in schema.get("fields") or []
    )
    prev_json = json.dumps(prev_data, ensure_ascii=False) if prev_data else "(无 — 这是故事开始)"

    parts: List[str] = [f"[Character: {char_name}]"]

    # 世界书（constant + keyword 命中，与主上下文一致）
    book = extract_character_book(card)
    after = ""
    if book:
        active = get_active_entries(book, [{"role": "assistant", "content": latest_text}])
        before = inject_entries(active, "before_char", char_name, user_name)
        after = inject_entries(active, "after_char", char_name, user_name)
        if before:
            parts.append(before)

    parts.append(f"""你是状态管理代理。需要维护以下字段：
{field_list}

规则：
- 根据 [Latest Text] 判断哪些字段发生变化或新增，输出一个 JSON 对象，只包含这些字段（key 用上面的 key，value 用中文）。
- 未变化的字段不要输出，会自动继承上一次的值。
- 忠于正文，不编造正文未提及的内容。
- 只输出 JSON 本身，不要输出任何解释、标题或代码块标记。""")

    if book and after:
        parts.append(after)

    context: List[dict] = [{"role": "system", "content": "\n\n".join(parts).strip()}]
    context.append({"role": "system", "content": f"[Previous Status JSON]\n{prev_json}"})
    context.append({"role": "user", "content": f"[Latest Text]\n{latest_text}"})
    return context


def _merge_patch(merged: Dict[str, Any], patch: Dict[str, Any]) -> None:
    for k, v in patch.items():
        if v is not None and v != "" and v != []:
            merged[k] = v


def _extract_json(text: Optional[str]) -> Optional[dict]:
    """从文本里提取 JSON 对象（容忍代码块围栏/前后杂文）。"""
    if not text:
        return None
    t = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t, re.IGNORECASE)
    if fence:
        t = fence.group(1).strip()
    try:
        obj = json.loads(t)
        if isinstance(obj, dict):
            return obj
    except (json.JSONDecodeError, TypeError):
        pass
    m = re.search(r"\{[\s\S]*\}", t)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict):
                return obj
        except (json.JSONDecodeError, TypeError):
            pass
    return None


def parse_status_update(resp: dict, prev_data: dict) -> dict:
    """从响应提取变更字段，合并到上一次状态（未提交字段自动继承）。"""
    merged = dict(prev_data or {})
    choices = resp.get("choices") or []
    msg = (choices[0].get("message") if choices else None) or {}

    # 1. function calling 兜底（若模型返回 tool_calls）
    for tc in msg.get("tool_calls") or []:
        fn = (tc or {}).get("function") or {}
        if fn.get("name") != "update_status":
            continue
        try:
            patch = json.loads(fn.get("arguments") or "{}")
        except (json.JSONDecodeError, TypeError):
            break
        if isinstance(patch, dict):
            _merge_patch(merged, patch)
        break

    # 2. 文本 JSON（主要路径：模型直接输出 JSON）
    if merged == dict(prev_data or {}):
        patch = _extract_json(msg.get("content") or "")
        if isinstance(patch, dict):
            _merge_patch(merged, patch)

    return merged


def format_status(data: dict, schema: dict) -> str:
    """把状态 JSON 渲染成可读的 markdown（用于 UI 显示）。"""
    lines = []
    for f in schema.get("fields") or []:
        v = data.get(f["key"])
        if v is None or v == "" or v == []:
            continue
        if isinstance(v, list):
            v = "、".join(str(x) for x in v)
        lines.append(f"- **{f['label']}**：{v}")
    return "\n".join(lines) if lines else "(暂无状态)"
