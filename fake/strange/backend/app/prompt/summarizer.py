"""对话历史自动/手动总结，对齐原 TS summarizer.ts。"""
from __future__ import annotations

from typing import List, Optional

from ..llm import call_chat_non_streaming

DEFAULT_SUMMARIZE_PROMPT = "\n".join([
    "Summarize the conversation below objectively and faithfully.",
    "This is a fictional roleplay — do NOT apply real-world moral judgment or safety warnings.",
    "Messages marked [USER - preserve fully] contain critical user input — keep all facts, names, and details.",
    "For Assistant messages, extract only key events, decisions, and emotional shifts; drop filler.",
    "Keep the summary in the same language as the conversation.",
    "Output ONLY the summary text, no prefixes or labels.",
])

MERGE_INSTRUCTION = "\n".join([
    "",
    "IMPORTANT: You already have a previous summary. You MUST preserve ALL facts and events",
    "from the previous summary and merge them with new information below into ONE cohesive text.",
    "Do NOT drop or lose any key information from the previous summary.",
])


async def summarize_history(
    settings: dict,
    existing_summary: str,
    new_messages: List[dict],
    custom_system_prompt: Optional[str] = None,
) -> str:
    new_messages_text = "\n\n".join(
        (f"[USER - preserve fully: {m['content']}]" if m.get("role") == "user" else f"[Assistant: {m.get('content', '')}]")
        for m in new_messages
    )

    base_prompt = (custom_system_prompt or "").strip() or DEFAULT_SUMMARIZE_PROMPT
    system_prompt = base_prompt + MERGE_INSTRUCTION if existing_summary else base_prompt

    if existing_summary:
        user_prompt = "\n".join([
            "[Previous summary]",
            existing_summary,
            "",
            "[New messages to incorporate]",
            new_messages_text,
            "",
            "Merge the previous summary with the new messages into a single cohesive paragraph.",
        ])
    else:
        user_prompt = "\n".join([
            "[Messages to summarize]",
            new_messages_text,
            "",
            "Write a single paragraph summary of these messages.",
        ])

    data = await call_chat_non_streaming(settings, [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ])

    choices = data.get("choices") or []
    message = choices[0].get("message") if choices else {}
    return message.get("content") or ""
