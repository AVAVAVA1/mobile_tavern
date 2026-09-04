"""临时验证：状态栏 JSON 文本路径（不触碰 store，安全）。"""
import asyncio
import sys

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

from app.agent.status_manager import (  # noqa: E402
    build_status_messages,
    parse_status_update,
    format_status,
)
from app.analysis import default_status_schema  # noqa: E402
from app.llm import call_chat_non_streaming  # noqa: E402

# 1. 纯函数：JSON 文本解析
resp = {"choices": [{"message": {"role": "assistant", "content": '{"mood": "高兴"}'}}]}
d = parse_status_update(resp, {})
assert d == {"mood": "高兴"}, d
s = format_status(d, default_status_schema())
assert "高兴" in s and "暂无状态" not in s, s
print("1. JSON 文本解析 OK:", s)

# 2. 代码块围栏解析
resp2 = {"choices": [{"message": {"content": '```json\n{"location": "卧室"}\n```'}}]}
d2 = parse_status_update(resp2, {})
assert d2 == {"location": "卧室"}, d2
print("2. 代码块围栏解析 OK:", d2)


async def e2e():
    settings = {"apiKey": "test-key", "baseUrl": "http://127.0.0.1:9000/v1", "model": "mock-model", "enableThinking": True}
    card = {"spec": "chara_card_v2", "spec_version": "2.0", "data": {"name": "测试角色", "first_mes": "你好"}}
    schema = default_status_schema()
    msgs = build_status_messages(card, {}, "我今天很高兴", schema, "User")
    resp = await call_chat_non_streaming(settings, msgs, kind="status")
    new = parse_status_update(resp, {})
    final = format_status(new, schema)
    print("3. e2e 状态文本:", repr(final))
    assert "高兴" in final and "暂无状态" not in final, final
    print("3. e2e OK")


asyncio.run(e2e())
print("RESULT: ALL PASS")
