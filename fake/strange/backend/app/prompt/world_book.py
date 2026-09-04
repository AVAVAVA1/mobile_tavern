"""世界书 / 人物书：提取、激活、注入（对齐 RP-Hub 增强模型）。

条目位置：system_top / global_note / before_char / after_char / at_depth / user_top / assistant_top。
激活：constant 恒触发；否则按 per-entry scanDepth 扫描最近消息，关键词(忽略大小写)或正则命中触发，受概率(probability/useProbability)控制。
"""
from __future__ import annotations

import random
import re
from typing import Any, Dict, List, Optional

from .placeholders import replace_placeholders

VALID_POSITIONS = (
    "system_top",
    "global_note",
    "before_char",
    "after_char",
    "at_depth",
    "user_top",
    "assistant_top",
)

_POSITION_NAME_MAP = {
    "before_character": "before_char",
    "after_character": "after_char",
    "character_top": "before_char",
    "character_bottom": "after_char",
    "before_examples": "before_char",
    "after_examples": "after_char",
    "example_top": "before_char",
    "example_bottom": "after_char",
    "an_top": "global_note",
    "author_note": "global_note",
    "an_bottom": "global_note",
}
_POSITION_NUM_MAP = {0: "before_char", 1: "after_char", 2: "global_note", 3: "global_note", 4: "at_depth"}


def _to_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, str):
        v = value.strip().lower()
        if v == "false":
            return False
        if v == "true":
            return True
    return bool(value)


def _to_number(value: Any, default: Optional[float]) -> Optional[float]:
    if value is None or value == "":
        return default
    try:
        num = float(value)
        return num if num == num else default  # NaN guard
    except (TypeError, ValueError):
        return default


def normalize_world_info_entry(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """把任意来源的世界书条目规范化成统一字段（对齐 RP-Hub）。"""
    merged: Dict[str, Any] = dict(raw or {})
    ext = merged.get("extensions")
    if isinstance(ext, dict):
        for k, v in ext.items():
            if v is not None:
                merged[k] = v
    merged.pop("extensions", None)

    keys = merged.get("keys") or merged.get("key") or []
    if isinstance(keys, str):
        keys = [k.strip() for k in re.split(r"[,，]", keys) if k.strip()]
    elif not isinstance(keys, list):
        keys = []

    position = "at_depth"
    st_pos = merged.get("position")
    if isinstance(st_pos, str):
        lower = st_pos.lower().replace(" ", "_")
        lower = _POSITION_NAME_MAP.get(lower, lower)
        if lower in VALID_POSITIONS:
            position = lower
    elif st_pos is not None:
        try:
            num = int(st_pos)
        except (TypeError, ValueError):
            num = None
        if num in _POSITION_NUM_MAP:
            position = _POSITION_NUM_MAP[num]

    def getv(names: List[str], default: Any) -> Any:
        for n in names:
            if merged.get(n) is not None:
                return merged[n]
        return default

    enabled = _to_bool(getv(["enabled"], True), True) and not _to_bool(getv(["disable", "disabled"], False), False)
    comment = str(getv(["comment"], "") or "")

    return {
        "comment": comment,
        "content": str(getv(["content"], "") or ""),
        "enabled": enabled,
        "scope": "global" if getv(["scope"], "character") == "global" else "character",
        "keys": keys,
        "useRegex": _to_bool(getv(["use_regex", "useRegex"], False), False),
        "constant": _to_bool(getv(["constant"], False), False),
        "position": position,
        "order": int(_to_number(getv(["insertion_order", "order"], 0), 0)),
        "depth": int(_to_number(getv(["depth"], 4), 4)),
        "scanDepth": _to_number(getv(["scan_depth", "scanDepth"], None), None),
        "probability": min(100, int(_to_number(getv(["probability"], 100), 100))),
        "useProbability": _to_bool(getv(["useProbability", "use_probability"], True), True),
    }


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
        "entries": [normalize_world_info_entry(e) for e in entries] if isinstance(entries, list) else [],
    }


def build_search_text(messages: List[dict], scan_depth: int) -> str:
    return "\n".join(m.get("content", "") for m in messages[-scan_depth:])


def world_info_key_matches(entry: dict, key: Any, text: str) -> bool:
    raw_key = str(key or "").strip()
    raw_text = str(text or "")
    if not raw_key or not raw_text:
        return False
    if entry.get("useRegex"):
        try:
            return re.search(raw_key, raw_text, re.IGNORECASE) is not None
        except re.error:
            return False
    return raw_key.lower() in raw_text.lower()


def passes_probability(entry: dict) -> bool:
    probability = min(100, int(entry.get("probability") or 100))
    if entry.get("useProbability") is not False and probability < 100:
        return probability > 0 and (random.random() * 100) < probability
    return True


def get_active_entries_from_list(
    entries: List[dict],
    messages: List[dict],
    settings: Optional[dict] = None,
) -> List[dict]:
    """返回激活条目列表（constant 恒触发；其余按 scanDepth + 关键词/正则 + 概率）。"""
    settings = settings or {}
    default_scan_depth = int(settings.get("worldInfoScanDepth") or 0)
    max_depth = int(settings.get("worldInfoMaxDepth") or 0)

    active: List[dict] = []
    for entry in entries:
        if not entry["enabled"]:
            continue
        if entry["constant"]:
            active.append(entry)
            continue

        scan_depth = entry["scanDepth"] if entry["scanDepth"] is not None else default_scan_depth
        try:
            scan_depth = int(scan_depth)
        except (TypeError, ValueError):
            scan_depth = 0
        if max_depth > 0:
            scan_depth = min(scan_depth, max_depth)
        if scan_depth == 0 or not entry["keys"]:
            continue

        scan_text = build_search_text(messages, scan_depth)
        if not passes_probability(entry):
            continue
        if any(world_info_key_matches(entry, k, scan_text) for k in entry["keys"]):
            active.append(entry)

    active.sort(key=lambda e: (0 if e["constant"] else 1, -(e.get("order") or 0)))
    return active


def get_active_entries(
    book: dict,
    messages: List[dict],
    settings: Optional[dict] = None,
) -> List[dict]:
    """book 形式（兼容旧调用）→ 委托给列表版。"""
    return get_active_entries_from_list(book["entries"], messages, settings)


def group_entries_by_position(entries: List[dict]) -> Dict[str, List[dict]]:
    groups: Dict[str, List[dict]] = {p: [] for p in VALID_POSITIONS}
    for e in entries:
        pos = e.get("position") or "at_depth"
        groups.setdefault(pos, []).append(e)
    for pos in groups:
        groups[pos].sort(key=lambda e: e.get("order") or 0)
    return groups


def inject_entries(entries: List[dict], position: str, char_name: str = "", user_name: str = "") -> str:
    filtered = sorted(
        (e for e in entries if e.get("position") == position),
        key=lambda e: e.get("order") or 0,
    )
    if not filtered:
        return ""
    return "\n\n".join(
        replace_placeholders((e.get("content") or "").strip(), char_name, user_name)
        for e in filtered
        if (e.get("content") or "").strip()
    )
