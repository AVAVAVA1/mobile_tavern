"""临时验证：世界书增强位置 + 预设 + 正则 prompt-side 的上下文组装。"""
import sys

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

from app.prompt.template import build_conversation_context  # noqa: E402
from app.prompt.regex_scripts import apply_regex_to_messages, normalize_regex_script  # noqa: E402


def roles(ctx):
    return [(m["role"], (m["content"] or "")[:40]) for m in ctx]


def has(ctx, needle):
    return any(needle in (m.get("content") or "") for m in ctx)


card = {
    "spec": "chara_card_v2",
    "spec_version": "2.0",
    "data": {
        "name": "艾莉",
        "description": "测试角色",
        "personality": "温柔",
        "scenario": "",
        "first_mes": "你好，我是艾莉。",
        "character_book": {
            "name": "book",
            "entries": [
                {"comment": "世界观", "content": "世界是魔法大陆", "constant": True, "position": "system_top", "order": 1},
                {"comment": "全局备注", "content": "故事发生在冬天", "keys": ["冬天"], "position": "global_note", "scanDepth": 5},
                {"comment": "角色外貌", "content": "艾莉有银发", "constant": True, "position": "before_char", "order": 2},
                {"comment": "场景深度", "content": "当前在城堡", "constant": True, "position": "at_depth", "depth": 0, "order": 3},
                {"comment": "用户顶部", "content": "记住用户是勇者", "constant": True, "position": "user_top"},
                {"comment": "助手指令", "content": "下一句要深情", "constant": True, "position": "assistant_top"},
            ],
        },
    },
}

history = [
    {"role": "user", "content": "你好", "id": "u1"},
    {"role": "assistant", "content": "你好，勇者", "id": "a1"},
    {"role": "user", "content": "今天冬天好冷", "id": "u2"},
]

presets = [
    {"name": "系统预设", "content": "[系统预设] 保持中文", "role": "system", "enabled": True},
    {"name": "引导", "content": "[引导] 这是一段角色扮演", "role": "user", "enabled": True},
]

global_world_info = [
    {"comment": "全局设定", "content": "全局：这是中世纪", "constant": True, "position": "system_top", "order": 0},
]

settings = {"storyStringTemplate": "", "customSystemPrompt": "", "authorNoteText": "", "authorNoteDepth": 4}

ctx = build_conversation_context(
    card, history, "勇者", settings=settings, presets=presets, global_world_info=global_world_info
)

print("=== ROLES ===")
for r in roles(ctx):
    print(r)

checks = []
checks.append(("system 含系统预设", has(ctx, "[系统预设] 保持中文")))
checks.append(("system 含全局 world info", has(ctx, "全局：这是中世纪")))
checks.append(("system 含 system_top", has(ctx, "世界是魔法大陆")))
checks.append(("system 含 global_note", has(ctx, "故事发生在冬天")))
checks.append(("system 含 before_char(银发)", has(ctx, "艾莉有银发")))
checks.append(("消息预设 user 存在", any(m["role"] == "user" and "[引导]" in m["content"] for m in ctx)))
checks.append(("at_depth 城堡存在", has(ctx, "当前在城堡")))
checks.append(("user_top 注入到最后 user 消息", any(m["role"] == "user" and "记住用户是勇者" in m["content"] and "今天冬天好冷" in m["content"] for m in ctx)))
checks.append(("assistant_top 注入", has(ctx, "下一句要深情")))

for label, ok in checks:
    print(("[OK] " if ok else "[FAIL] ") + label)

# 正则 prompt-side 测试
scripts = [
    normalize_regex_script({"name": "R", "regex": "勇者", "replacement": "冒险者", "placement": [1, 2], "promptOnly": True}),
]
applied = apply_regex_to_messages(ctx, scripts, is_prompt=True)
print("\n[regex] 勇者→冒险者 生效:", has(applied, "冒险者") and not has(applied, "勇者"))

all_ok = all(c[1] for c in checks) and has(applied, "冒险者") and not has(applied, "勇者")
print("\nRESULT:", "ALL PASS" if all_ok else "SOME FAILED")
sys.exit(0 if all_ok else 1)
