"""临时验证：stream_chat 把 reasoning_content 包成 <thinking>...</thinking>。"""
import asyncio
import sys

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

from app.llm import stream_chat, strip_thinking  # noqa: E402


async def main():
    settings = {"apiKey": "test-key", "baseUrl": "http://127.0.0.1:9000/v1", "model": "mock-model"}
    parts = []
    async for chunk in stream_chat(settings, [{"role": "user", "content": "你好"}]):
        parts.append(chunk)
    full = "".join(parts)
    print("FULL:", repr(full))
    assert full.startswith("<thinking>"), "应以 <thinking> 开头"
    assert "</thinking>" in full, "应包含 </thinking>"
    assert "这是思考" in full and "过程" in full, "思考内容应在内"
    # 正文应在 </thinking> 之后
    body = full.split("</thinking>", 1)[1]
    assert "[TEXT" in body, "正文应在思维链之后"
    # strip_thinking 应只留正文
    stripped = strip_thinking(full)
    assert "这是思考" not in stripped and "<thinking>" not in stripped
    print("STRIPPED:", repr(stripped))
    print("RESULT: ALL PASS")


asyncio.run(main())
