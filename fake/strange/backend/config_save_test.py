"""验证 Save 会写回 config.json（展示名 + picGenerate）。"""
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

from app import config, store  # noqa: E402


def main():
    # 备份原 config.json
    backup = None
    if config.CONFIG_FILE.exists():
        backup = config.CONFIG_FILE.read_text(encoding="utf-8")

    store.init()
    store.update_settings({
        "model": "test-model-123",
        "statusBarEnabled": True,
        "picGenerate": {"source": "comfyui", "sources": {"comfyui": {"url": "http://x", "workflow": "w.json"}}},
    })

    raw = json.loads(config.CONFIG_FILE.read_text(encoding="utf-8"))
    print("config.json keys:", sorted(raw.keys()))
    print("Model =", raw.get("Model"))
    print("Status Bar =", raw.get("Status Bar"))
    print("picGenerate =", raw.get("picGenerate"))

    # 还原
    if backup is not None:
        config.CONFIG_FILE.write_text(backup, encoding="utf-8")
        print("已还原原 config.json")


if __name__ == "__main__":
    sys.exit(main())
