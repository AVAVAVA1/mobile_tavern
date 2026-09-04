"""临时验证：导出 PNG（V2 chara chunk）→ 重新解析，世界书/正则脚本往返。"""
import base64
import json
import sys

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

from app.parser.png import inject_text_chunk  # noqa: E402
from app.parser.character_card import parse_character_card  # noqa: E402
from app.routers.sessions import _avatar_png_bytes, _build_export_data  # noqa: E402

card = {
    "spec": "chara_card_v2",
    "spec_version": "2.0",
    "data": {
        "name": "测试角色",
        "description": "描述",
        "personality": "性格",
        "scenario": "",
        "first_mes": "你好",
        "mes_example": "",
        "character_book": {
            "name": "book",
            "entries": [
                {"comment": "世界观", "content": "魔法大陆", "constant": True, "position": "system_top", "order": 1},
                {"comment": "场景", "content": "城堡", "keys": ["城堡"], "position": "at_depth", "depth": 0, "scanDepth": 5},
            ],
        },
        "extensions": {
            "regex_scripts": [
                {"name": "R", "regex": "你好", "replacement": "您好", "placement": [1, 2], "promptOnly": True},
            ]
        },
        "card_analysis": {"status_schema": {"fields": []}},
    },
}

data = _build_export_data(card)
assert "card_analysis" not in data, "card_analysis 应被移除"
assert data["extensions"]["regex_scripts"][0]["name"] == "R", "regex_scripts 应保留"

payload = json.dumps({"spec": "chara_card_v2", "spec_version": "2.0", "data": data}, ensure_ascii=False)
png = inject_text_chunk(_avatar_png_bytes(card), "chara", base64.b64encode(payload.encode("utf-8")).decode("ascii"))

parsed = parse_character_card(png)
assert parsed is not None, "重新解析失败"
pd = parsed["data"]
assert pd["name"] == "测试角色"
assert pd["description"] == "描述"
assert pd["character_book"]["entries"][0]["position"] == "system_top"
assert pd["character_book"]["entries"][1]["depth"] == 0
assert pd["extensions"]["regex_scripts"][0]["name"] == "R"
print("导出→重新解析 往返 OK")
print("name:", pd["name"], "| worldbook entries:", len(pd["character_book"]["entries"]), "| regex:", len(pd["extensions"]["regex_scripts"]))
print("RESULT: ALL PASS")
