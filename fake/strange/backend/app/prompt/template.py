"""Context 组装（普通模式）：世界书(增强位置) + 预设 + 故事字符串 + 历史。

世界书位置：system_top / global_note / before_char / after_char / at_depth / user_top / assistant_top。
"""
from __future__ import annotations

from typing import List, Optional

from .authors_note import inject_author_note
from .mes_example import parse_mes_example
from .placeholders import replace_placeholders
from .presets import build_system_preset_text, split_presets
from .story_string import render_story_string
from .world_book import (
    extract_character_book,
    get_active_entries_from_list,
    group_entries_by_position,
    inject_entries,
    normalize_world_info_entry,
)


def _join_entries(entries: List[dict]) -> str:
    """RP-Hub joinContent：每条 `[comment]\\ncontent`，空内容跳过。"""
    parts = []
    for e in entries:
        content = (e.get("content") or "").strip()
        if not content:
            continue
        parts.append(f"[{e.get('comment') or 'Entry'}]\n{content}")
    return "\n\n".join(parts)


def _find_depth_index(messages: List[dict], depth: int, safe_target_limit: int = 0) -> int:
    """at_depth 插入点：从末尾倒数只计 user/assistant，超过 depth 即返回插入位置。"""
    countdown = int(depth or 0)
    target = safe_target_limit
    n = len(messages)
    for i in range(n - 1, -1, -1):
        if messages[i].get("role") in ("user", "assistant"):
            countdown -= 1
        if countdown < 0:
            target = i
            break
    return max(target, safe_target_limit)


def _inject_message_level(messages: List[dict], groups: dict, safe_target_limit: int = 0) -> List[dict]:
    """at_depth / user_top / assistant_top 消息级注入。"""
    final = list(messages)

    at_depth = sorted(groups["at_depth"], key=lambda e: e.get("order") or 0)
    for entry in at_depth:
        depth = entry.get("depth") if entry.get("depth") is not None else 4
        content = f"[{entry.get('comment') or 'Entry'}]\n{entry.get('content') or ''}".strip()
        target = _find_depth_index(final, depth, safe_target_limit)
        final.insert(target, {"role": "user", "content": content})

    if groups["user_top"]:
        content = _join_entries(groups["user_top"])
        last_user_idx = next((i for i in range(len(final) - 1, -1, -1) if final[i].get("role") == "user"), -1)
        if last_user_idx >= 0:
            prev = final[last_user_idx].get("content", "")
            final[last_user_idx] = {**final[last_user_idx], "content": f"{content}\n\n{prev}"}

    if groups["assistant_top"]:
        content = _join_entries(groups["assistant_top"])
        final.append({"role": "system", "content": f"[Instructions for next message]\n{content}"})

    return final


def build_conversation_context(
    card: dict,
    history: List[dict],
    user_name: str,
    summary: Optional[str] = None,
    last_summarized_index: Optional[int] = None,
    settings: Optional[dict] = None,
    deleted_message_ids: Optional[List[str]] = None,
    status: Optional[str] = None,
    presets: Optional[List[dict]] = None,
    global_world_info: Optional[List[dict]] = None,
) -> List[dict]:
    d = card.get("data") or {}
    char_name = d.get("name") or "Character"
    settings = settings or {}
    context: List[dict] = []

    # 1. 世界书：字符 + 全局 → 激活 → 按位置分组
    book = extract_character_book(card)
    global_entries = [normalize_world_info_entry(e) for e in (global_world_info or [])]
    char_entries = book["entries"] if book else []
    active = get_active_entries_from_list(global_entries + char_entries, history, settings)
    groups = group_entries_by_position(active)

    before_char_text = inject_entries(groups["before_char"], "before_char", char_name, user_name)
    after_char_text = inject_entries(groups["after_char"], "after_char", char_name, user_name)

    # 2. 预设
    system_presets, message_presets = split_presets(presets)
    system_preset_text = build_system_preset_text(system_presets)

    # 3. system prompt：预设 → system_top → global_note → 自定义 → story string
    params = {
        "char": char_name,
        "user": user_name,
        "description": d.get("description", ""),
        "personality": d.get("personality", ""),
        "scenario": d.get("scenario", ""),
        "system": d.get("system_prompt", ""),
        "mes_example_raw": d.get("mes_example", ""),
        "post_history": d.get("post_history_instructions", ""),
        "wi_before": before_char_text,
        "wi_after": after_char_text,
    }
    template = settings.get("storyStringTemplate", "")
    custom_sys = (settings.get("customSystemPrompt") or "").strip()
    raw_content = render_story_string(template, params) or "You are a helpful assistant."

    system_parts: List[str] = []
    if system_preset_text:
        system_parts.append(system_preset_text)
    if groups["system_top"]:
        system_parts.append(_join_entries(groups["system_top"]))
    if groups["global_note"]:
        system_parts.append(_join_entries(groups["global_note"]))
    if custom_sys:
        system_parts.append(custom_sys)
    system_parts.append(raw_content)
    context.append({"role": "system", "content": "\n\n".join(system_parts)})

    # 4. 消息预设（user/assistant role）
    for p in message_presets:
        context.append({"role": p["role"], "content": p["content"]})

    # 5. Few-shot (mes_example)
    if d.get("mes_example"):
        context.extend(parse_mes_example(d["mes_example"], char_name, user_name))

    # 6. first_mes 作为 assistant 首条消息
    first_mes_text = ""
    if d.get("first_mes"):
        first_mes_text = replace_placeholders(d["first_mes"], char_name, user_name)
        context.append({"role": "assistant", "content": first_mes_text})

    # 7. 历史总结
    if summary:
        context.append({"role": "system", "content": f"[Previous conversation summary]\n{summary}"})

    # 8. 当前状态栏（可选）
    if status:
        context.append({"role": "system", "content": f"[Current Status]\n{status}"})

    # 9. 真实历史
    start_idx = last_summarized_index if (last_summarized_index is not None and last_summarized_index >= 0) else 0
    deleted_set = set(deleted_message_ids or [])
    unsummarized: List[dict] = []
    for msg in history[start_idx:]:
        if first_mes_text and msg.get("role") == "assistant" and msg.get("content") == first_mes_text:
            continue
        if msg.get("id") in deleted_set:
            continue
        unsummarized.append(msg)

    # 10. Author's Note
    author_note = settings.get("authorNoteText", "")
    if author_note:
        depth = settings.get("authorNoteDepth", 4)
        history_with_an = inject_author_note(unsummarized, author_note, depth)
    else:
        history_with_an = unsummarized

    # 11. at_depth / user_top / assistant_top
    context.extend(_inject_message_level(history_with_an, groups))

    return context
