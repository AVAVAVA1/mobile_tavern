"""预设（带 role）引擎：system / user / assistant 三类预设 + 注入。"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

VALID_PRESET_ROLES = ("system", "user", "assistant")

# 内置预设库（参考 RP-Hub 的内置预设类别，用自己的中性写法；不含 NSFW/破限内容）
DEFAULT_PRESETS: List[dict] = [
    {
        "name": "防抢话",
        "role": "system",
        "enabled": True,
        "content": (
            "用户角色是「{{user}}」。任何时候都不得替 {{user}} 输出言行、想法或决定：\n"
            "- 不重复、不补充、不转述 {{user}} 的最新发言。\n"
            "- 只描写 {{char}} 的行为与心理，把 {{user}} 的回应留给 {{user}} 控制。\n"
            "- 禁止时间跳跃与无铺垫的剧情快速推进。"
        ),
    },
    {
        "name": "防神化",
        "role": "system",
        "enabled": True,
        "content": (
            "维持叙事真实感：\n"
            "- 信息限制：{{char}} 只知道其身份、经历与当前场景中合理获得的信息；可以猜测、误会、试探，不做全知结论。\n"
            "- 能力限制：体力、情绪、环境都会限制行动；允许失手、迟疑、说错话。\n"
            "- 关系限制：亲近与信任需要过程与铺垫，不因一句话就立刻倾心或坦白一切。"
        ),
    },
    {
        "name": "防重复",
        "role": "system",
        "enabled": True,
        "content": (
            "- 避免重复句式、相同形容词与相同动作描写。\n"
            "- 不复述前文已写过的内容。\n"
            "- 每轮加入新的细节、动作或心理变化，推动剧情。"
        ),
    },
    {
        "name": "第二人称",
        "role": "system",
        "enabled": False,
        "content": "叙事人称：使用第二人称，以「你」称呼 {{user}}，从 {{user}} 的视角展开剧情。",
    },
    {
        "name": "第三人称",
        "role": "system",
        "enabled": True,
        "content": "叙事人称：使用第三人称旁白，统一以角色名或「他/她」指代 {{char}} 与 {{user}}，不使用「你/我」称呼 {{user}}。",
    },
]


def normalize_preset(preset: Any) -> Dict[str, Any]:
    p = dict(preset or {})
    role = p.get("role") or p.get("presetRole") or p.get("type") or "system"
    if role not in VALID_PRESET_ROLES:
        role = "system"
    return {
        "name": p.get("name") or "New Preset",
        "content": str(p.get("content") or ""),
        "enabled": p.get("enabled") is not False,
        "role": role,
    }


def split_presets(presets: List[Any]) -> Tuple[List[dict], List[dict]]:
    """拆成 (system 预设, 消息预设[user/assistant])，只保留启用且内容非空。"""
    normalized = [normalize_preset(p) for p in (presets or [])]
    enabled = [p for p in normalized if p["enabled"] and p["content"].strip()]
    system = [p for p in enabled if p["role"] == "system"]
    message = [p for p in enabled if p["role"] in ("user", "assistant")]
    return system, message


def build_system_preset_text(presets: List[dict]) -> str:
    """system 预设内容拼接（注入 system prompt）。"""
    return "\n\n".join(p["content"].strip() for p in presets if p["content"].strip())
