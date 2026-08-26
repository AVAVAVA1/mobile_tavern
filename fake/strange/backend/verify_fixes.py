"""验证 4 处上下文传递修复：first_mes / 角色核心字段 / 总结后最新发言 / 世界书占位符。"""
import json
import os
import sys

import httpx

BASE = "http://127.0.0.1:8100"
CARD_BOOK = r"D:\mobile_tavern\character\性爱家教.png"      # 有世界书(含 {{user}})
CARD_CORE = r"D:\mobile_tavern\character\已读乱回DeepFake.png"  # 有 description/personality/scenario，无世界书
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_requests.jsonl")

results = []


def clear():
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
    with httpx.stream("POST", f"{BASE}/api/sessions/{sid}/chat", json={"text": text}, timeout=60) as r:
        assert r.status_code == 200, r.text[:300]
        for _ in r.iter_lines():
            pass


def check(name, ok, extra=""):
    results.append((name, ok, extra))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {extra}")


def sys_text(msgs):
    return "\n".join(m.get("content", "") for m in msgs if m.get("role") == "system")


def main():
    c = httpx.Client(timeout=30)

    # ---- Fix 4：世界书占位符替换 ----
    clear()
    c.put(f"{BASE}/api/settings", json={
        "apiKey": "t", "baseUrl": "http://127.0.0.1:9000/v1", "model": "m",
        "statusBarEnabled": False, "autoSummarize": False, "summarizeThreshold": 0,
        "userName": "TESTUSER",
    })
    with open(CARD_BOOK, "rb") as f:
        sid = c.post(f"{BASE}/api/sessions/import", files={"file": (os.path.basename(CARD_BOOK), f, "image/png")}).json()["id"]
    stream(sid, "hi")
    s = "\n".join(m.get("content", "") for m in read_log()[0]["messages"] if m.get("role") == "system")
    check("fix4 世界书 {{user}} 已替换", ("{{user}}" not in s and "<user>" not in s), "")
    check("fix4 世界书包含 TESTUSER", "TESTUSER" in s, "")
    c.delete(f"{BASE}/api/sessions/{sid}")

    # ---- Fix 1 + 2：Agent 模式 first_mes 与角色核心字段 ----
    clear()
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": True, "autoSummarize": False, "summarizeThreshold": 0, "userName": "TESTUSER"})
    with open(CARD_CORE, "rb") as f:
        sid = c.post(f"{BASE}/api/sessions/import", files={"file": (os.path.basename(CARD_CORE), f, "image/png")}).json()["id"]
    sess = c.get(f"{BASE}/api/sessions/{sid}").json()
    data = sess["characterCard"]["data"]
    first_replaced = sess["messages"][0]["content"] if sess["messages"] else ""
    stream(sid, "第一轮")
    log = read_log()
    planner = next(e for e in log if e["kind"] == "planner")
    writer = next(e for e in log if e["kind"] == "writer")

    pm_has_first = any(m.get("role") == "assistant" and m.get("content") == first_replaced for m in planner["messages"])
    wm_has_first = any(m.get("role") == "assistant" and m.get("content") == first_replaced for m in writer["messages"])
    check("fix1 planner 收到 first_mes", pm_has_first, "")
    check("fix1 writer 收到 first_mes", wm_has_first, "")

    pm_sys = sys_text(planner["messages"])
    wm_sys = sys_text(writer["messages"])
    desc = (data.get("description") or "").strip()
    pers = (data.get("personality") or "").strip()
    check("fix2 planner 收到 description", bool(desc) and desc[:20] in pm_sys, f"desc={len(desc)}")
    check("fix2 writer 收到 description", bool(desc) and desc[:20] in wm_sys, "")
    check("fix2 planner 收到 [Personality]", bool(pers) and ("[Personality]" in pm_sys and pers[:20] in pm_sys), f"pers={len(pers)}")
    check("fix2 writer 收到 [Personality]", bool(pers) and ("[Personality]" in wm_sys and pers[:20] in wm_sys), "")

    # ---- Fix 3：总结后 planner 仍看到最新用户发言 ----
    clear()
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": True, "autoSummarize": True, "summarizeThreshold": 2})
    stream(sid, "FIRST_MSG")
    stream(sid, "SECOND_MSG")
    stream(sid, "THIRD_MSG")
    log = read_log()
    planners = [e for e in log if e["kind"] == "planner"]
    last = planners[-1]
    has_third = any(m.get("role") == "user" and m.get("content") == "THIRD_MSG" for m in last["messages"])
    check("fix3 总结后 planner 仍收到最新用户发言", has_third, f"last planner non_sys={len([m for m in last['messages'] if m['role']!='system'])}")

    c.delete(f"{BASE}/api/sessions/{sid}")
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": False, "autoSummarize": True, "summarizeThreshold": 30})

    print("\n" + "-" * 40)
    ok = all(r[1] for r in results)
    print(f"总计 {sum(1 for r in results if r[1])}/{len(results)} 通过")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
