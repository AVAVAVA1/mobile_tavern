"""临时验证：cardgen.generate_card 对 mock LLM 端到端。"""
import asyncio
import sys

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

from app.cardgen import generate_card  # noqa: E402


async def main():
    settings = {"apiKey": "test-key", "baseUrl": "http://127.0.0.1:9000/v1", "model": "mock-model"}
    card = await generate_card(settings, "一个温柔吸血鬼少女")
    data = card["data"]
    assert data["name"] == "雨夜吸血鬼", data["name"]
    assert data["first_mes"]
    assert data["character_book"]["entries"][0]["position"] == "system_top"
    assert data["extensions"]["regex_scripts"][0]["name"] == "对话加粗"
    print("name:", data["name"])
    print("first_mes:", data["first_mes"])
    print("world_info:", len(data["character_book"]["entries"]), "| regex:", len(data["extensions"]["regex_scripts"]))
    print("RESULT: ALL PASS")


asyncio.run(main())
