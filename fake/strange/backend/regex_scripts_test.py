"""临时验证正则引擎与 RP-Hub processRegex 行为一致。"""
import sys

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

from app.prompt.regex_scripts import (  # noqa: E402
    normalize_regex_script,
    process_regex,
    apply_regex_to_messages,
)


def eq(actual, expected, label):
    status = "OK" if actual == expected else "FAIL"
    print(f"[{status}] {label}: {actual!r}" + ("" if actual == expected else f" (expected {expected!r})"))
    return actual == expected


all_ok = True

# 1. 简单替换：assistant 消息，默认 (markdownOnly=false,promptOnly=false) => 仅显示侧
s = normalize_regex_script({"name": "T", "regex": "你好", "replacement": "您好", "placement": [2]})
all_ok &= eq(process_regex("你好世界", [s], is_display=True, role="assistant"), "您好世界", "display 替换")
all_ok &= eq(process_regex("你好世界", [s], is_prompt=True, role="assistant"), "你好世界", "prompt 侧默认不替换(仅显示)")

# 2. promptOnly=true => 仅 prompt 侧
s2 = normalize_regex_script({"name": "P", "regex": "\\bfoo\\b", "replacement": "bar", "placement": [2], "promptOnly": True})
all_ok &= eq(process_regex("foo", [s2], is_prompt=True, role="assistant"), "bar", "promptOnly 在 prompt 侧生效")
all_ok &= eq(process_regex("foo", [s2], is_display=True, role="assistant"), "foo", "promptOnly 在 display 侧不生效")

# 3. placement 按 role 过滤
s3 = normalize_regex_script({"name": "U", "regex": "a", "replacement": "X", "placement": [1], "promptOnly": True})
all_ok &= eq(process_regex("aaa", [s3], is_prompt=True, role="user"), "XXX", "placement[1] 作用于 user")
all_ok &= eq(process_regex("aaa", [s3], is_prompt=True, role="assistant"), "aaa", "placement[1] 不作用于 assistant")

# 4. system 消息不处理
all_ok &= eq(process_regex("abc", [s3], is_prompt=True, role="system"), "abc", "system 不处理")

# 5. $1 / $& 替换
s4 = normalize_regex_script({"name": "R", "regex": "([a-z]+)", "replacement": "<$1>", "placement": [2], "promptOnly": True})
all_ok &= eq(process_regex("hello", [s4], is_prompt=True, role="assistant"), "<hello>", "$1 捕获组")

# 6. /pattern/flags 形式 + (?i) 内联
s5 = normalize_regex_script({"name": "F", "regex": "/abc/gi", "replacement": "Z", "placement": [2], "promptOnly": True})
all_ok &= eq(process_regex("ABC abc", [s5], is_prompt=True, role="assistant"), "Z Z", "/pattern/flags + i")

# 7. 代码块保护：普通正则不进入 ``` 块
s6 = normalize_regex_script({"name": "C", "regex": "world", "replacement": "地球", "placement": [2], "promptOnly": True})
all_ok &= eq(process_regex("hello world ```code world```", [s6], is_prompt=True, role="assistant"), "hello 地球 ```code world```", "代码块保护")

# 8. minDepth/maxDepth
s7 = normalize_regex_script({"name": "D", "regex": "x", "replacement": "Y", "placement": [2], "promptOnly": True, "minDepth": 1})
all_ok &= eq(process_regex("xxx", [s7], is_prompt=True, role="assistant", depth=0), "xxx", "minDepth 挡掉 depth=0")
all_ok &= eq(process_regex("xxx", [s7], is_prompt=True, role="assistant", depth=1), "YYY", "minDepth 放行 depth=1")

# 9. apply_regex_to_messages depth 计算
msgs = [
    {"role": "user", "content": "a"},
    {"role": "assistant", "content": "a"},
]
s8 = normalize_regex_script({"name": "M", "regex": "a", "replacement": "B", "placement": [2], "promptOnly": True, "maxDepth": 0})
out = apply_regex_to_messages(msgs, [s8], is_prompt=True)
all_ok &= eq(out[0]["content"], "a", "depth=1 被 maxDepth=0 挡")
all_ok &= eq(out[1]["content"], "B", "depth=0 放行")

print("\nRESULT:", "ALL PASS" if all_ok else "SOME FAILED")
sys.exit(0 if all_ok else 1)
