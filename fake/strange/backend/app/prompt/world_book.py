"""世界书 / 人物书提取、激活、注入，对齐原 TS 实现。"""
from __future__ import annotations

from typing import Any, List, Optional

from .placeholders import replace_placeholders


def extract_character_book(card: dict) -> Optional[dict]:
    data = card.get("data") or {}
    extensions = data.get("extensions") or {}
    raw = data.get("character_book") or extensions.get("character_book")
    if not raw:
        return None
    try:
        return normalize_book(raw)
    except Exception:
        return None


def normalize_book(raw: dict) -> dict:
    entries = raw.get("entries")
    return {
        "name": raw.get("name", ""),
        "description": raw.get("description", ""),
        "scan_depth": raw.get("scan_depth", 50),
        "token_budget": raw.get("token_budget", 500),
        "recursive_scanning": raw.get("recursive_scanning", False),
        "case_sensitive": raw.get("case_sensitive", False),
        "entries": [normalize_entry(e) for e in entries] if isinstance(entries, list) else [],
    }


def normalize_entry(raw: dict) -> dict:
    return {
        "keys": raw.get("keys") if isinstance(raw.get("keys"), list) else [],
        "content": raw.get("content", ""),
        "comment": raw.get("comment"),
        "constant": raw.get("constant", False),
        "enabled": raw.get("enabled", True),
        "position": "after_char" if raw.get("position") == "after_char" else "before_char",
        "insertion_order": raw.get("insertion_order", 100),
        "case_sensitive": raw.get("case_sensitive", False),
        "selective": raw.get("selective", False),
        "secondary_keys": raw.get("secondary_keys") if isinstance(raw.get("secondary_keys"), list) else [],
    }


def get_active_entries(book: dict, recent_text: str) -> List[dict]:
    text_to_search = recent_text if book["case_sensitive"] else recent_text.lower()
    active: List[dict] = []

    for entry in book["entries"]:
        if not entry["enabled"]:
            continue
        if entry["constant"]:
            active.append(entry)
            continue

        all_keys = entry["keys"] + entry["secondary_keys"]
        if not all_keys:
            continue

        if any(_key_matches(k, text_to_search, book["case_sensitive"]) for k in all_keys):
            active.append(entry)

    return active


def _key_matches(key: Any, text: str, case_sensitive: bool) -> bool:
    if not key:
        return False
    k = str(key)
    if not case_sensitive:
        k = k.lower()
    return k in text


def inject_entries(entries: List[dict], position: str, char_name: str = "", user_name: str = "") -> str:
    filtered = sorted(
        (e for e in entries if e["position"] == position),
        key=lambda e: e["insertion_order"],
    )
    if not filtered:
        return ""
    return "\n\n".join(
        replace_placeholders((e.get("content") or "").strip(), char_name, user_name)
        for e in filtered
        if (e.get("content") or "").strip()
    )


def build_search_text(messages: List[dict], scan_depth: int) -> str:
    return "\n".join(m.get("content", "") for m in messages[-scan_depth:])
