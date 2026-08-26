"""Context 组装（普通模式），对齐原 TS template.ts。"""
from __future__ import annotations

from typing import List, Optional

from .authors_note import inject_author_note
from .mes_example import parse_mes_example
from .placeholders import replace_placeholders
from .story_string import render_story_string
from .world_book import (
    build_search_text,
    extract_character_book,
    get_active_entries,
    inject_entries,
)


def build_conversation_context(
    card: dict,
    history: List[dict],
    user_name: str,
    summary: Optional[str] = None,
    last_summarized_index: Optional[int] = None,
    settings: Optional[dict] = None,
    deleted_message_ids: Optional[List[str]] = None,
    status: Optional[str] = None,
) -> List[dict]:
    d = card.get("data") or {}
    char_name = d.get("name") or "Character"
    context: List[dict] = []

    # 1. 世界书 before_char / after_char
    book = extract_character_book(card)
    before_char_text = ""
    after_char_text = ""
    if book:
        search_text = build_search_text(history, book["scan_depth"])
        active = get_active_entries(book, search_text)
        before_char_text = inject_entries(active, "before_char", char_name, user_name)
        after_char_text = inject_entries(active, "after_char", char_name, user_name)

    # 2. Story String 模板 / system prompt
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
    template = (settings or {}).get("storyStringTemplate", "") if settings else ""
    custom_sys = ((settings or {}).get("customSystemPrompt") or "").strip() if settings else ""
    raw_content = render_story_string(template, params) or "You are a helpful assistant."
    system_content = f"{custom_sys}\n\n{raw_content}" if custom_sys else raw_content
    context.append({"role": "system", "content": system_content})

    # 3. Few-shot (mes_example)
    if d.get("mes_example"):
        context.extend(parse_mes_example(d["mes_example"], char_name, user_name))

    # 4. first_mes 作为 assistant 首条消息
    first_mes_text = ""
    if d.get("first_mes"):
        first_mes_text = replace_placeholders(d["first_mes"], char_name, user_name)
        context.append({"role": "assistant", "content": first_mes_text})

    # 5. 历史总结
    if summary:
        context.append({
            "role": "system",
            "content": f"[Previous conversation summary]\n{summary}",
        })

    # 5.5 当前状态栏（可选，statusBarEnabled 时注入）
    if status:
        context.append({
            "role": "system",
            "content": f"[Current Status]\n{status}",
        })

    # 6. 真实历史
    start_idx = last_summarized_index if (last_summarized_index is not None and last_summarized_index >= 0) else 0
    deleted_set = set(deleted_message_ids or [])
    unsummarized: List[dict] = []
    for msg in history[start_idx:]:
        if first_mes_text and msg.get("role") == "assistant" and msg.get("content") == first_mes_text:
            continue
        if msg.get("id") in deleted_set:
            continue
        unsummarized.append(msg)

    # 7. Author's Note
    author_note = (settings or {}).get("authorNoteText", "") if settings else ""
    if author_note:
        depth = (settings or {}).get("authorNoteDepth", 4)
        context.extend(inject_author_note(unsummarized, author_note, depth))
    else:
        context.extend(unsummarized)

    return context
