"""内存态 + JSON 持久化（对齐原 AsyncStorage 键值语义）。

单用户本地应用：启动时载入，任何写操作写穿到磁盘。
会话以 dict 形式保存在内存（id -> dict），与前端 JSON 形状一致。
"""
from __future__ import annotations

import json
import random
import string
import threading
import time
from typing import Any, Dict, List, Optional

from . import config
from .models import AppSettings

_lock = threading.RLock()

_settings: Dict[str, Any] = {}
_sessions: Dict[str, dict] = {}

# config.json（用户手写启动配置）展示名 -> AppSettings 字段名
_CONFIG_KEY_MAP = {
    "User Name": "userName",
    "Agent Beta": "statusBarEnabled",
    "Status Bar": "statusBarEnabled",
    "API Key": "apiKey",
    "Model": "model",
    "Base URL": "baseUrl",
    "Summarize Threshold": "summarizeThreshold",
    "Auto Summarize": "autoSummarize",
    "Custom System Prompt": "customSystemPrompt",
    "Author's Note": "authorNoteText",
    "Author's Note Depth": "authorNoteDepth",
    "Story String Template": "storyStringTemplate",
}
_INT_FIELDS = ("summarizeThreshold", "authorNoteDepth")
_BOOL_FIELDS = ("statusBarEnabled", "autoSummarize")

# 字段名 -> config.json 展示名（用于把设置写回 config.json）
_CONFIG_REVERSE_MAP = {
    "userName": "User Name",
    "statusBarEnabled": "Status Bar",
    "apiKey": "API Key",
    "model": "Model",
    "baseUrl": "Base URL",
    "summarizeThreshold": "Summarize Threshold",
    "autoSummarize": "Auto Summarize",
    "customSystemPrompt": "Custom System Prompt",
    "authorNoteText": "Author's Note",
    "authorNoteDepth": "Author's Note Depth",
    "storyStringTemplate": "Story String Template",
}
# 没有展示名、直接用 camelCase 写进 config.json 的字段
_CAMELCASE_CONFIG_FIELDS = ("picGenerate",)


def now_ms() -> int:
    return int(time.time() * 1000)


def gen_id() -> str:
    rnd = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"{now_ms():x}{rnd}"


def _read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return default


def _write_json(path, data) -> None:
    config.ensure_data_dir()
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


# ---------------------------------------------------------------- init

def _apply_config_file() -> None:
    """启动时加载 fake/strange/config.json 覆盖设置（未写的字段保持默认/已持久化值）。"""
    if not config.CONFIG_FILE.exists():
        return
    try:
        with open(config.CONFIG_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError):
        return
    if not isinstance(raw, dict):
        return
    for display, field in _CONFIG_KEY_MAP.items():
        if display in raw:
            _settings[field] = raw[display]
    # 直接用 camelCase 写进 config.json 的字段（picGenerate 等复杂结构）
    for field in _CAMELCASE_CONFIG_FIELDS:
        if field in raw:
            _settings[field] = raw[field]
    # 类型规范化
    for k in _INT_FIELDS:
        try:
            _settings[k] = int(_settings[k])
        except (TypeError, ValueError):
            _settings[k] = 30 if k == "summarizeThreshold" else 4
    for k in _BOOL_FIELDS:
        v = _settings.get(k)
        if isinstance(v, str):
            _settings[k] = v.strip().lower() in ("true", "1", "yes", "on")
        elif not isinstance(v, bool):
            _settings[k] = bool(v)


def _write_config_file() -> None:
    """把当前设置写回 config.json（展示名 + camelCase 混合），保证重启后一致。"""
    data: Dict[str, Any] = {}
    for field, display in _CONFIG_REVERSE_MAP.items():
        if field in _settings:
            data[display] = _settings[field]
    for field in _CAMELCASE_CONFIG_FIELDS:
        if field in _settings:
            data[field] = _settings[field]
    _write_json(config.CONFIG_FILE, data)


def init() -> None:
    global _settings, _sessions
    config.ensure_data_dir()
    _settings = AppSettings().model_dump()
    loaded = _read_json(config.SETTINGS_FILE, None)
    if isinstance(loaded, dict):
        _settings.update({k: v for k, v in loaded.items() if k in _settings})
    # config.json（启动配置）最后加载，覆盖已持久化设置中它写到的字段
    _apply_config_file()
    for s in _read_json(config.SESSIONS_FILE, []):
        if isinstance(s, dict) and s.get("id"):
            _sessions[s["id"]] = s


def persist() -> None:
    with _lock:
        _write_json(config.SETTINGS_FILE, _settings)
        _write_json(config.SESSIONS_FILE, list(_sessions.values()))


# ---------------------------------------------------------------- settings

def get_settings() -> Dict[str, Any]:
    return dict(_settings)


def update_settings(partial: Dict[str, Any]) -> Dict[str, Any]:
    with _lock:
        for k, v in partial.items():
            if k in AppSettings.model_fields:
                _settings[k] = v
        # 数值字段强转，避免前端传字符串导致比较/取模出错
        for int_key, default in (("summarizeThreshold", 30), ("authorNoteDepth", 4)):
            try:
                _settings[int_key] = int(_settings[int_key])
            except (TypeError, ValueError):
                _settings[int_key] = default
        _write_json(config.SETTINGS_FILE, _settings)
        _write_config_file()
        return dict(_settings)


# ---------------------------------------------------------------- sessions

def list_sessions() -> List[dict]:
    with _lock:
        sessions = list(_sessions.values())

    def last_active(s: dict) -> int:
        msgs = s.get("messages") or []
        return msgs[-1]["timestamp"] if msgs else s.get("createdAt", 0)

    return sorted(sessions, key=last_active, reverse=True)


def get_session(session_id: str) -> Optional[dict]:
    return _sessions.get(session_id)


def create_session(card: dict, userName: str = "User") -> dict:
    with _lock:
        data = card.get("data") or {}
        char_name = data.get("name") or "Character"
        from .prompt.placeholders import replace_placeholders

        messages: List[dict] = []
        if data.get("first_mes"):
            messages.append({
                "id": gen_id(),
                "role": "assistant",
                "content": replace_placeholders(data["first_mes"], char_name, userName),
                "timestamp": now_ms(),
            })

        session = {
            "id": gen_id(),
            "characterCard": card,
            "messages": messages,
            "createdAt": now_ms(),
            "userName": userName,
            "title": "",
            "summary": "",
            "lastSummarizedIndex": 0 if messages else -1,
            "deletedMessageIds": [],
            "status": "",
            "previousStatus": "",
            "statusData": {},
            "statusSchema": None,
        }
        _sessions[session["id"]] = session
        _write_json(config.SESSIONS_FILE, list(_sessions.values()))
        return session


def update_session(session_id: str, **fields) -> Optional[dict]:
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return None
        s.update(fields)
        _write_json(config.SESSIONS_FILE, list(_sessions.values()))
        return s


def delete_session(session_id: str) -> bool:
    with _lock:
        if session_id not in _sessions:
            return False
        del _sessions[session_id]
        _write_json(config.SESSIONS_FILE, list(_sessions.values()))
        return True


def add_message(session_id: str, msg: dict) -> None:
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        s["messages"] = [*s["messages"], msg]


def insert_message_after(session_id: str, after_id: str, msg: dict) -> None:
    """把消息插入到指定消息的后面（找不到则追加到末尾）。"""
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        msgs = s["messages"]
        idx = next((i for i, m in enumerate(msgs) if m["id"] == after_id), -1)
        if idx < 0:
            s["messages"] = [*msgs, msg]
        else:
            s["messages"] = [*msgs[: idx + 1], msg, *msgs[idx + 1 :]]


def append_message_content(session_id: str, message_id: str, text: str) -> None:
    """流式追加正文（仅内存，不落盘；由调用方在检查点 persist）。"""
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        for m in s["messages"]:
            if m["id"] == message_id:
                m["content"] = m.get("content", "") + text
                break


def set_message(session_id: str, message_id: str, **fields) -> None:
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        for m in s["messages"]:
            if m["id"] == message_id:
                m.update(fields)
                break


def get_message(session_id: str, message_id: str) -> Optional[dict]:
    s = _sessions.get(session_id)
    if not s:
        return None
    for m in s["messages"]:
        if m["id"] == message_id:
            return m
    return None


def update_summary(session_id: str, summary: str, last_index: int) -> None:
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        s["summary"] = summary
        s["lastSummarizedIndex"] = last_index
        _write_json(config.SESSIONS_FILE, list(_sessions.values()))


def update_status(session_id: str, new_status: str, status_data: Optional[dict] = None) -> None:
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        s["previousStatus"] = s.get("status", "")
        s["status"] = new_status
        if status_data is not None:
            s["statusData"] = status_data
        _write_json(config.SESSIONS_FILE, list(_sessions.values()))


def remove_from_context(session_id: str, message_id: str) -> None:
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        ids = s.get("deletedMessageIds") or []
        if message_id not in ids:
            s["deletedMessageIds"] = [*ids, message_id]
            _write_json(config.SESSIONS_FILE, list(_sessions.values()))
