"""对话 SSE 端到端测试：普通模式 + Agent 模式 + 总结触发。"""
import json
import os
import sys

import httpx

BASE = "http://127.0.0.1:8100"
CARD = r"D:\mobile_tavern\character\性爱家教.png"


def stream_chat(sid: str, text: str):
    events = []
    with httpx.stream("POST", f"{BASE}/api/sessions/{sid}/chat", json={"text": text}, timeout=60) as r:
        print("  status:", r.status_code)
        if r.status_code != 200:
            print("  body:", r.text[:300])
            return []
        for line in r.iter_lines():
            line = line.strip()
            if not line.startswith("data: "):
                continue
            payload = json.loads(line[len("data: "):])
            events.append(payload)
    return events


def main() -> int:
    c = httpx.Client(timeout=30)

    # 指向 mock LLM
    c.put(f"{BASE}/api/settings", json={
        "apiKey": "test-key",
        "baseUrl": "http://127.0.0.1:9000/v1",
        "model": "mock-model",
        "summarizeThreshold": 2,
        "autoSummarize": True,
        "userName": "测试用户",
    })

    # 导入
    with open(CARD, "rb") as f:
        r = c.post(f"{BASE}/api/sessions/import", files={"file": (os.path.basename(CARD), f, "image/png")})
    sid = r.json()["id"]
    print("session:", sid)

    print("\n=== 普通模式 chat ===")
    ev = stream_chat(sid, "你好呀")
    deltas = "".join(e["content"] for e in ev if e["type"] == "delta")
    types = [e["type"] for e in ev]
    print("  types:", types)
    print("  delta concat:", deltas)

    print("\n=== 开启 agent 模式 ===")
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": True})
    ev = stream_chat(sid, "我们继续")
    types = [e["type"] for e in ev]
    deltas = "".join(e["content"] for e in ev if e["type"] == "delta")
    status = "".join(e["content"] for e in ev if e["type"] == "status_delta")
    workflow = [e for e in ev if e["type"] == "workflow"]
    print("  types:", types)
    print("  delta:", deltas)
    print("  status:", status)
    if workflow:
        wf = workflow[-1]["workflowV2"]
        print("  workflow loreCounts:", wf["loreCounts"], "guide len:", len(wf["writingGuide"]), "statusBar len:", len(wf["statusBar"]))

    print("\n=== 会话最终状态 ===")
    s = c.get(f"{BASE}/api/sessions/{sid}").json()
    print("  messages:", [(m["role"], m.get("messageType"), (m["content"] or "")[:20]) for m in s["messages"]])
    print("  summary:", (s["summary"] or "")[:60])
    print("  lastSummarizedIndex:", s["lastSummarizedIndex"])
    print("  status len:", len(s.get("status") or ""))

    # 清理
    c.delete(f"{BASE}/api/sessions/{sid}")
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": False, "summarizeThreshold": 30})
    print("\ncleaned")
    return 0


if __name__ == "__main__":
    sys.exit(main())
