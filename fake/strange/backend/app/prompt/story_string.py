"""Story String 模板渲染，对齐原 TS 实现。"""
import re

DEFAULT_TEMPLATE = "\n\n".join([
    "{{wi_before}}",
    "[Character: {{char}}]",
    "{{system}}",
    "{{description}}",
    "[Personality]",
    "{{personality}}",
    "[Scenario]",
    "{{scenario}}",
    "[Example dialogue format - use this style]",
    "{{mes_example_raw}}",
    "{{wi_after}}",
    "{{post_history}}",
])

_MACROS = [
    ("{{char}}", "char"),
    ("{{user}}", "user"),
    ("{{description}}", "description"),
    ("{{personality}}", "personality"),
    ("{{scenario}}", "scenario"),
    ("{{system}}", "system"),
    ("{{mes_example_raw}}", "mes_example_raw"),
    ("{{post_history}}", "post_history"),
    ("{{wi_before}}", "wi_before"),
    ("{{wi_after}}", "wi_after"),
]


def render_story_string(template: str, params: dict) -> str:
    effective = template or DEFAULT_TEMPLATE
    result = effective
    for macro, key in _MACROS:
        value = params.get(key, "")
        result = re.sub(re.escape(macro), lambda _m: value, result, flags=re.IGNORECASE)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()
