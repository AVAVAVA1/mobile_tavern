"""对话生图端到端测试：表格填写 + 自动生图 + 图片插入 + 手动生图。"""
import json
import sys

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

B = "http://127.0.0.1:8100/api"
CARD = r"D:\mobile_tavern\character\已读乱回DeepFake.png"


def main():
    c = httpx.Client(timeout=120)
    c.put(B + "/settings", json={
        "apiKey": "t", "baseUrl": "http://127.0.0.1:9000/v1", "model": "m",
        "statusBarEnabled": False, "autoSummarize": False, "summarizeThreshold": 0,
        "picGenerate": {"source": "comfyui", "sources": {"comfyui": {
            "url": "http://127.0.0.1:8189", "workflow": "default.json",
            "promptPrefix": "best quality", "negativePrefix": "low quality",
        }}},
        "userName": "TESTUSER",
    })

    with open(CARD, "rb") as f:
        sid = c.post(B + "/sessions/import", files={"file": ("c.png", f, "image/png")}).json()["id"]

    ev = []
    with httpx.stream("POST", B + f"/sessions/{sid}/chat", json={"text": "一个少女在雨夜里撑着伞"}, timeout=120) as r:
        for line in r.iter_lines():
            line = line.strip()
            if line.startswith("data: "):
                ev.append(json.loads(line[6:]))

    print("事件类型:", [e["type"] for e in ev])
    meta_ev = next((e for e in ev if e["type"] == "reply_meta"), None)
    img_ev = next((e for e in ev if e["type"] == "image"), None)
    print("元数据表:", meta_ev["meta"] if meta_ev else None)
    print("图片:", img_ev["message"]["imageUrl"] if img_ev else None)

    s = c.get(B + f"/sessions/{sid}").json()
    print("--- 会话消息顺序 ---")
    for m in s["messages"]:
        print(" ", m["role"], m.get("messageType"), (m.get("content") or m.get("imageUrl") or "")[:44])

    prompt = json.load(open(r"D:\mobile_tavern\fake\strange\backend\mock_prompt.json", encoding="utf-8"))
    print("positive:", prompt["6"]["inputs"]["text"])
    print("negative:", prompt["7"]["inputs"]["text"])

    # 手动生图
    aid = next(m["id"] for m in s["messages"] if m["role"] == "assistant" and m.get("messageType") not in ("status", "image"))
    r = c.post(B + f"/sessions/{sid}/messages/{aid}/image")
    print("手动生图:", r.status_code, r.json().get("imageUrl") if r.status_code == 200 else r.json())

    c.delete(B + f"/sessions/{sid}")


if __name__ == "__main__":
    sys.exit(main())
