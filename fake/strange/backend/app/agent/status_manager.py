"""Status Manager（状态管理代理）— schema 驱动 + function calling 结构化输出 + 字段级继承。"""
from __future__ import annotations

import json
from typing import List, Optional

from ..prompt.world_book import extract_character_book, get_active_entries, inject_entries


def build_status_update_tool(schema: dict) -> dict:
    """由 schema 生成 update_status 工具的 JSON Schema（字段全部可选 = 只提交变化项）。"""
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
    field_list = "\n".join(f"- {f['label']}（key={f['key']}）" for f in schema.get("fields") or [])
    prev_json = json.dumps(prev_data, ensure_ascii=False) if prev_data else "(无 — 这是故事开始)"

    parts: List[str] = [f"[Character: {char_name}]"]

    # 世界书（constant + keyword 命中，与主上下文一致）
    book = extract_character_book(card)
    if book:
        active = get_active_entries(book, latest_text)
        before = inject_entries(active, "before_char", char_name, user_name)
        after = inject_entries(active, "after_char", char_name, user_name)
        if before:
            parts.append(before)
    else:
        after = ""

    parts.append(f"""你是状态管理代理。需要维护以下字段：
{field_list}

规则：
- 根据 [Latest Text] 判断哪些字段发生变化或新增，调用 update_status 只填写这些字段；
- 未变化的字段不要填，会自动继承上一次的值；
- 忠于正文，不编造正文未提及的内容。""")

    if book and after:
        parts.append(after)

    context: List[dict] = [{"role": "system", "content": "\n\n".join(parts).strip()}]
    context.append({"role": "system", "content": f"[Previous Status JSON]\n{prev_json}"})
    context.append({"role": "system", "content": f"[Latest Text]\n{latest_text}"})
    return context


def parse_status_update(resp: dict, prev_data: dict) -> dict:
    """从 tool_call 提取变更字段，合并到上一次状态（未提交字段自动继承）。"""
    merged = dict(prev_data or {})
    choices = resp.get("choices") or []
    msg = (choices[0].get("message") if choices else None) or {}
    for tc in msg.get("tool_calls") or []:
        fn = (tc or {}).get("function") or {}
        if fn.get("name") != "update_status":
            continue
        try:
            patch = json.loads(fn.get("arguments") or "{}")
        except (json.JSONDecodeError, TypeError):
            break
        if isinstance(patch, dict):
            for k, v in patch.items():
                if v is not None and v != "" and v != []:
                    merged[k] = v
        break
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
