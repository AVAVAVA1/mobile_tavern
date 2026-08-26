"""mes_example → few-shot 消息对解析，对齐原 TS 实现。"""
from __future__ import annotations

import re
from typing import List

from .placeholders import replace_placeholders

_USER_RE = re.compile(r"^(\{\{user\}\}|<user>)\s*:\s*", re.IGNORECASE)
_CHAR_RE = re.compile(r"^(\{\{char\}\}|<char>)\s*:\s*", re.IGNORECASE)


def parse_mes_example(raw: str, char_name: str, user_name: str) -> List[dict]:
    if not raw.strip():
        return []

    blocks = re.split(r"<START>", raw, flags=re.IGNORECASE)
    messages: List[dict] = []

    for block in blocks:
        trimmed = block.strip()
        if not trimmed:
            continue
        messages.extend(parse_block(trimmed, char_name, user_name))

    return messages


def parse_block(block: str, char_name: str, user_name: str) -> List[dict]:
    messages: List[dict] = []
    current_speaker: str | None = None
    current_content: List[str] = []

    def flush() -> None:
        nonlocal current_content
        if current_speaker and current_content:
            text = "\n".join(current_content).strip()
            if text:
                messages.append({
                    "role": "user" if current_speaker == "user" else "assistant",
                    "content": text,
                })
        current_content = []

    for raw_line in block.split("\n"):
        line = raw_line.strip()
        if not line:
            if current_speaker:
                current_content.append("")
            continue

        user_match = _USER_RE.match(line)
        char_match = _CHAR_RE.match(line)

        if user_match or char_match:
            flush()
            if user_match:
                current_speaker = "user"
                current_content.append(line[user_match.end():])
            else:
                current_speaker = "char"
                current_content.append(line[char_match.end():])
        elif current_speaker:
            current_content.append(raw_line)

    flush()

    return [
        {"role": m["role"], "content": replace_placeholders(m["content"], char_name, user_name)}
        for m in messages
    ]
