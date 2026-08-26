"""占位符替换，同时支持 {{user}}/{{char}} 与 <user>/<char>。"""
import re

_PATTERNS = [
    (re.compile(r"\{\{char\}\}", re.IGNORECASE), "char"),
    (re.compile(r"\{\{user\}\}", re.IGNORECASE), "user"),
    (re.compile(r"<char>", re.IGNORECASE), "char"),
    (re.compile(r"<user>", re.IGNORECASE), "user"),
]


def replace_placeholders(text: str, char_name: str, user_name: str) -> str:
    result = text
    for pattern, kind in _PATTERNS:
        replacement = char_name if kind == "char" else user_name
        result = pattern.sub(lambda _m: replacement, result)
    return result
