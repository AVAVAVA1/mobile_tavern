"""路径与运行时配置。"""
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/
PROJECT_DIR = BACKEND_DIR.parent                      # fake/strange/
DATA_DIR = BACKEND_DIR / "data"
SETTINGS_FILE = DATA_DIR / "settings.json"
SESSIONS_FILE = DATA_DIR / "sessions.json"
CONFIG_FILE = PROJECT_DIR / "config.json"             # 用户手写的启动配置
WORKFLOWS_DIR = PROJECT_DIR / "workflows"             # ComfyUI workflow JSON 存放目录
OUTPUT_DIR = PROJECT_DIR / "output"                   # 生图结果临时输出目录


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
