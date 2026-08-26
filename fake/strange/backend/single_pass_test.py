"""方案 A 单次流式验证：一次流式生成 + 可选状态栏，无 workflow/planner。"""
import json
import os
import sys

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8100"
CARD = r"D:\mobile_tavern\character\已读乱回DeepFake.png"
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_requests.jsonl")

results = []


def check(name, ok, extra=""):
    results.append((name, ok, extra))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {extra}")


def clear_log():
    if os.path.exists(LOG):
        os.remove(LOG)


def read_log():
    out = []
    if os.path.exists(LOG):
        with open(LOG, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    out.append(json.loads(line))
    return out


def stream(sid, text):
    ev = []
    with httpx.stream("POST", f"{BASE}/api/sessions/{sid}/chat", json={"text": text}, timeout=60) as r:
        assert r.status_code == 200, r.text[:300]
        for line in r.iter_lines():
            line = line.strip()
            if line.startswith("data: "):
                ev.append(json.loads(line[6:]))
    return ev


def main():
    c = httpx.Client(timeout=30)

    # ---- 状态栏开启 ----
    clear_log()
    c.put(f"{BASE}/api/settings", json={
        "apiKey": "t", "baseUrl": "http://127.0.0.1:9000/v1", "model": "m",
        "statusBarEnabled": True, "autoSummarize": False, "summarizeThreshold": 0,
        "userName": "TESTUSER",
    })
    with open(CARD, "rb") as f:
        sid = c.post(f"{BASE}/api/sessions/import", files={"file": (os.path.basename(CARD), f, "image/png")}).json()["id"]

    ev = stream(sid, "第一轮")
    types = [e["type"] for e in ev]
    delta = "".join(e["content"] for e in ev if e["type"] == "delta")
    status = "".join(e["content"] for e in ev if e["type"] == "status_delta")
    check("第1轮只有 delta+status_delta+done（无 workflow）", "workflow" not in types and "delta" in types and "done" in types, str(types))
    check("第1轮有状态栏输出", bool(status), status[:40])
    s = c.get(f"{BASE}/api/sessions/{sid}").json()
    check("第1轮 statusData 已写入", bool(s.get("statusData")), json.dumps(s.get("statusData"), ensure_ascii=False))

    clear_log()
    ev = stream(sid, "第二轮")
    types = [e["type"] for e in ev]
    # 检查第2轮的流式生成调用里注入了 [Current Status]
    log = read_log()
    stream_calls = [e for e in log if e.get("stream") and e.get("kind") == "other"]
    has_status_in_context = False
    if stream_calls:
        sys_text = "\n".join(m.get("content", "") for m in stream_calls[0]["messages"] if m.get("role") == "system")
        has_status_in_context = "[Current Status]" in sys_text
    check("第2轮上下文注入了 [Current Status]", has_status_in_context, "")
    s = c.get(f"{BASE}/api/sessions/{sid}").json()
    sd = s.get("statusData") or {}
    check("第2轮 mood 继承 + location 更新", sd.get("mood") == "高兴" and sd.get("location") == "卧室", json.dumps(sd, ensure_ascii=False))

    # ---- 状态栏关闭 ----
    clear_log()
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": False})
    ev = stream(sid, "第三轮")
    types = [e["type"] for e in ev]
    check("关闭后无 status_delta", "status_delta" not in types, str(types))
    s = c.get(f"{BASE}/api/sessions/{sid}").json()
    # 关闭后 status 不应被注入（但旧的 statusData 仍保留）
    check("关闭后 statusData 不变", bool(s.get("statusData")), json.dumps(s.get("statusData"), ensure_ascii=False))

    c.delete(f"{BASE}/api/sessions/{sid}")
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": False})

    print("-" * 40)
    ok = all(r[1] for r in results)
    print(f"总计 {sum(1 for r in results if r[1])}/{len(results)} 通过")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
