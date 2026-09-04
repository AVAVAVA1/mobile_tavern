"""正则脚本引擎（忠实移植自 RP-Hub 的 processRegex / normalizeRegexScript）。

- placement: [1, 2]；1 作用于 user 角色消息，2 作用于 assistant 角色消息。
- markdownOnly / promptOnly 决定「显示侧(user 可见) vs 发送侧(AI 可见)」：
    - promptOnly=true        → 只在发送侧(is_prompt)生效
    - markdownOnly=true      → 只在显示侧(is_display)生效
    - 两者都未勾             → 按 markdownOnly 处理（仅显示侧）
- 发送侧在后端执行（提示词组装后、发给 LLM 前）；显示侧在前端执行。
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# HTML/代码块/cot 保护：这些片段不参与普通正则替换（除非正文本就要匹配它们）。
_PROTECTION_ALTERNATION = (
    r"<!DOCTYPE html>[\s\S]*?</html>"
    r"|<html\b[^>]*>[\s\S]*?</html>"
    r"|<script\b[^>]*>[\s\S]*?</script>"
    r"|<style\b[^>]*>[\s\S]*?</style>"
    r"|<(?:cot|think)>[\s\S]*?(?:</(?:cot|think)>|<(?:cot|think)>|$)"
    r"|```[\s\S]*?```"
    r"|`[^`]+`"
    r"|</?[a-zA-Z][\w:-]*[^>]*>"
)
_PROTECTION_SPLIT_RE = re.compile("(" + _PROTECTION_ALTERNATION + ")", re.IGNORECASE)


def normalize_regex_script(
    script: Optional[Dict[str, Any]],
    fallback_scope: str = "character",
    system_names: frozenset = frozenset(),
) -> Dict[str, Any]:
    """把各种来源的正则脚本规范化成统一字段（对齐 RP-Hub）。"""
    s = dict(script or {})
    if "disabled" in s:
        s["enabled"] = not bool(s["disabled"])
    elif "enabled" not in s:
        s["enabled"] = True
    if not s.get("name") and s.get("scriptName"):
        s["name"] = s["scriptName"]
    if not s.get("regex") and s.get("findRegex"):
        s["regex"] = s["findRegex"]
    if not s.get("replacement") and s.get("replaceString"):
        s["replacement"] = s["replaceString"]
    if not s.get("flags") and s.get("regexFlags"):
        s["flags"] = s["regexFlags"]
    if not s.get("flags"):
        s["flags"] = "g"
    if not isinstance(s.get("placement"), list):
        s["placement"] = [1, 2]
    if "markdownOnly" not in s:
        s["markdownOnly"] = False
    if "promptOnly" not in s:
        s["promptOnly"] = False
    if s["markdownOnly"] and s["promptOnly"]:
        s["promptOnly"] = False
    if "runOnEdit" not in s:
        s["runOnEdit"] = False
    if "minDepth" not in s:
        s["minDepth"] = None
    if "maxDepth" not in s:
        s["maxDepth"] = None
    name = s.get("name") or s.get("scriptName")
    s["scope"] = "global" if (s.get("scope") == "global" or fallback_scope == "global" or name in system_names) else "character"
    s.pop("disabled", None)
    return s


def _parse_pattern_flags(pattern: str, flags: str) -> tuple[str, str]:
    """解析 /pattern/flags 形式 + 兼容内联修饰符 (?s)(?i)(?m)。"""
    pattern = str(pattern)
    flags = str(flags)
    if pattern.startswith("/") and pattern.rfind("/") > 0:
        last_slash = pattern.rfind("/")
        potential_flags = pattern[last_slash + 1:]
        if re.fullmatch(r"[gimsuy]*", potential_flags):
            flags = potential_flags
            pattern = pattern[1:last_slash]
    if "(?s)" in pattern:
        pattern = pattern.replace("(?s)", "")
        if "s" not in flags:
            flags += "s"
    if "(?i)" in pattern:
        pattern = pattern.replace("(?i)", "")
        if "i" not in flags:
            flags += "i"
    if "(?m)" in pattern:
        pattern = pattern.replace("(?m)", "")
        if "m" not in flags:
            flags += "m"
    return pattern, flags


def _js_flags_to_python(flags: str) -> int:
    out = 0
    if "i" in flags:
        out |= re.IGNORECASE
    if "m" in flags:
        out |= re.MULTILINE
    if "s" in flags:
        out |= re.DOTALL
    # 'g' = 全量替换（re.sub 默认全量）；'u' = unicode（Python 默认）；'y' sticky 不支持，忽略
    return out


def _js_replacement_to_python(repl: str) -> str:
    """把 JS 风格替换串（$1 / $& / $$）转成 Python re.sub 风格。"""
    repl = str(repl)
    repl = repl.replace("$$", "\x00")  # 临时保护转义美元符
    repl = repl.replace("$&", "\\g<0>")
    repl = re.sub(r"\$(?P<n>\d+)", lambda m: "\\" + m.group("n"), repl)
    repl = repl.replace("\x00", "$")
    return repl


def _apply_one_script(text: str, script: Dict[str, Any]) -> str:
    pattern = script.get("regex") or script.get("findRegex")
    if not pattern:
        return text
    flags = script.get("flags") or script.get("regexFlags") or "g"
    replacement = script["replacement"] if "replacement" in script else (script.get("replaceString") or "")

    pattern, flags = _parse_pattern_flags(pattern, flags)
    try:
        re_obj = re.compile(pattern, _js_flags_to_python(flags))
    except re.error:
        return text
    py_replacement = _js_replacement_to_python(replacement)

    name = script.get("name") or script.get("scriptName") or ""
    if "<" not in pattern and ">" not in pattern and "```" not in pattern and name != "Auto Replace {{user}}":
        # 保护 HTML 文档 / script / style / 代码块 / 行内代码 / 标签 / cot-think 块
        parts = _PROTECTION_SPLIT_RE.split(text)
        out: List[str] = []
        for i, part in enumerate(parts):
            if part is None:
                out.append("")
            elif i % 2 == 1:  # 受保护片段
                out.append(part)
            else:
                out.append(re_obj.sub(py_replacement, part))
        return "".join(out)
    return re_obj.sub(py_replacement, text)


def process_regex(
    text: str,
    scripts: List[Dict[str, Any]],
    is_display: bool = False,
    is_prompt: bool = False,
    role: Optional[str] = None,
    depth: int = 0,
) -> str:
    """对一段文本应用正则脚本（对齐 RP-Hub processRegex）。"""
    if not text:
        return ""
    if role == "system":
        return text

    result = text
    # NAI画图正则 排最后
    ordered = sorted(
        scripts,
        key=lambda s: 1 if (s.get("name") or s.get("scriptName")) == "NAI画图正则" else -1,
    )

    for script in ordered:
        if script.get("enabled") is False:
            continue

        placement = script.get("placement") or [1, 2]
        if role == "user" and 1 not in placement:
            continue
        if role == "assistant" and 2 not in placement:
            continue

        markdown_only = bool(script.get("markdownOnly"))
        prompt_only = bool(script.get("promptOnly"))
        user_only = markdown_only or (not markdown_only and not prompt_only)
        if is_display and prompt_only:
            continue
        if is_prompt and user_only:
            continue

        min_depth = script.get("minDepth")
        max_depth = script.get("maxDepth")
        if min_depth is not None and depth < min_depth:
            continue
        if max_depth is not None and depth > max_depth:
            continue

        try:
            result = _apply_one_script(result, script)
        except Exception:
            continue

    return result


def apply_regex_to_messages(
    messages: List[Dict[str, Any]],
    scripts: List[Dict[str, Any]],
    is_display: bool = False,
    is_prompt: bool = True,
) -> List[Dict[str, Any]]:
    """对消息数组逐条应用正则（depth = 距末尾的距离，0=最后一条）。"""
    n = len(messages)
    out: List[Dict[str, Any]] = []
    for i, m in enumerate(messages):
        depth = n - 1 - i
        content = process_regex(
            m.get("content", ""),
            scripts,
            is_display=is_display,
            is_prompt=is_prompt,
            role=m.get("role"),
            depth=depth,
        )
        out.append({**m, "content": content})
    return out


def extract_character_regex_scripts(card: Dict[str, Any]) -> List[Dict[str, Any]]:
    """从角色卡提取正则脚本（extensions.regex_scripts 优先，其次 data.regex_scripts / regexScripts）。"""
    data = card.get("data") or {}
    ext = data.get("extensions") or {}
    raw = None
    if isinstance(ext, dict) and isinstance(ext.get("regex_scripts"), list):
        raw = ext.get("regex_scripts")
    elif isinstance(data.get("regex_scripts"), list):
        raw = data.get("regex_scripts")
    elif isinstance(data.get("regexScripts"), list):
        raw = data.get("regexScripts")
    if not raw:
        return []
    return [normalize_regex_script(s, "character") for s in raw]
