"""Pic Generate 设置端点测试。"""
import json
import sys

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

B = "http://127.0.0.1:8100/api"


def main():
    c = httpx.Client(timeout=30)

    r = c.get(B + "/pic/workflows")
    print("1 workflows:", r.status_code, r.json())

    r = c.get(B + "/pic/workflows/default.json")
    print("2 get default.json:", r.status_code, (r.json() or {}).get("content", "")[:50])

    r = c.put(B + "/pic/workflows/default.json", json={"content": json.dumps({"ok": True})})
    print("3 save valid:", r.status_code, r.json())

    r = c.put(B + "/pic/workflows/default.json", json={"content": "not json"})
    print("4 save invalid:", r.status_code, r.json())

    r = c.post(B + "/pic/comfyui/test", json={"url": "http://127.0.0.1:9999"})
    print("5 connect(fail):", r.status_code, r.json())

    r = c.get(B + "/pic/workflows/..%2F..%2Fconfig.json")
    print("6 traversal:", r.status_code)

    # 还原占位文件
    c.put(B + "/pic/workflows/default.json", json={"content": json.dumps(
        {"说明": "这是占位 workflow，请替换为你的 ComfyUI workflow JSON（API 格式）。"},
        ensure_ascii=False,
    )})
    print("restored")

    # 设置 picGenerate 往返
    r = c.put(B + "/settings", json={"picGenerate": {
        "source": "comfyui",
        "sources": {"comfyui": {"url": "http://127.0.0.1:8188", "workflow": "default.json", "promptPrefix": "p", "negativePrefix": "n"}},
    }})
    s = r.json()
    print("7 picGenerate save:", r.status_code, "source =", s.get("picGenerate", {}).get("source"))


if __name__ == "__main__":
    sys.exit(main())
