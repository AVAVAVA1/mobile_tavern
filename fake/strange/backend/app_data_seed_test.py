"""临时验证：首次启动 seed 默认预设/世界书（用临时 app_data 文件，不触碰真实数据）。"""
import sys
from pathlib import Path

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

import app.config as config  # noqa: E402

TMP = Path(r"D:\mobile_tavern\fake\strange\backend\_test_app_data.json")
if TMP.exists():
    TMP.unlink()
config.APP_DATA_FILE = TMP

from app import store  # noqa: E402

store.init()
data = store.get_app_data()
print("presets:", [p["name"] for p in data["presets"]])
print("worldInfo:", [(w["comment"], w["useRegex"]) for w in data["worldInfo"]])
assert [p["name"] for p in data["presets"]] == ["防抢话", "防神化", "防重复", "第二人称", "第三人称"]
assert len(data["worldInfo"]) == 2

# 第二次 init：不应重复 seed（_seeded 已写入文件）
store.init()
data2 = store.get_app_data()
assert len(data2["presets"]) == 5, "不应重复 seed"
print("重复 init 不重复 seed OK")

# 用户清空后：不应自动补回（_seeded=true）
store.update_app_data("presets", [])
store.init()
data3 = store.get_app_data()
assert data3["presets"] == [], "清空后不应自动补回"
print("清空后不补回 OK")

TMP.unlink()
print("RESULT: ALL PASS")
