"""多轮对话测试：Agent 三代理 5 轮 + 总结触发 + 普通模式 5 轮。

验证上下文是否正确传递：
- Planner 每轮收到 [Current Status]（上一轮状态）与 [Story Summary]（总结后）
- Writer 每轮收到 [Writing Guide]（Planner 输出）与 [User's latest message]
- Status 每轮收到 [Previous Status] 与 [Latest Text]（Writer 输出最后 2000 字）
"""
import json
import os
import sys

import httpx

BASE = "http://127.0.0.1:8100"
CARD = r"D:\mobile_tavern\character\性爱家教.png"
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_requests.jsonl")


def clear_log():
    if os.path.exists(LOG):
        os.remove(LOG)


def read_log():
    if not os.path.exists(LOG):
        return []
    out = []
    with open(LOG, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def find(messages, needle):
    return [m["content"] for m in messages if needle in m.get("content", "")]


def stream_chat(sid, text):
    events = []
    with httpx.stream("POST", f"{BASE}/api/sessions/{sid}/chat", json={"text": text}, timeout=60) as r:
        assert r.status_code == 200, r.text[:300]
        for line in r.iter_lines():
            line = line.strip()
            if not line.startswith("data: "):
                continue
            events.append(json.loads(line[len("data: "):]))
    return events


def analyze_agent_round(rounds: int):
    """分析最近 rounds 轮的 agent 请求日志，打印每轮关键上下文。"""
    log = read_log()
    print(f"\n---- agent 请求日志（共 {len(log)} 条）----")
    for e in log:
        k = e["kind"]
        if k == "summarize":
            print(f"  #{e['id']} {k}(stream={e['stream']})")
            continue
        msgs = e["messages"]
        sys_msgs = [m["content"] for m in msgs if m["role"] == "system"]
        non_sys = [m for m in msgs if m["role"] != "system"]

        if k == "planner":
            cur_status = [c for c in sys_msgs if "[Current Status]" in c]
            story_sum = [c for c in sys_msgs if "[Story Summary]" in c]
            print(f"  #{e['id']} planner | sys={len(sys_msgs)} 对话={len(non_sys)} "
                  f"status={'有' if cur_status else '无'} summary={'有' if story_sum else '无'}")
            if cur_status:
                print(f"      [Current Status] = {cur_status[0].split(chr(10),1)[1][:60]!r}")
            if story_sum:
                print(f"      [Story Summary] = {story_sum[0].split(chr(10),1)[1][:60]!r}")
            if non_sys:
                last = non_sys[-1]
                print(f"      最后一条对话 = {last['role']}: {last['content'][:50]!r}")

        elif k == "writer":
            guide = [c for c in sys_msgs if "[Writing Guide]" in c]
            lastuser = [c for c in sys_msgs if "User's latest message" in c]
            print(f"  #{e['id']} writer | sys={len(sys_msgs)} guide={'有' if guide else '无'} lastUser={'有' if lastuser else '无'}")
            if guide:
                print(f"      [Writing Guide] = {guide[0].split('[Writing Guide]',1)[1][:70]!r}")
            if lastuser:
                print(f"      [User's latest] = {lastuser[0].split(chr(10),1)[1][:60]!r}")

        elif k == "status":
            prev = [c for c in sys_msgs if "[Previous Status]" in c]
            latest = [c for c in sys_msgs if "[Latest Text]" in c]
            print(f"  #{e['id']} status | prev={'有' if prev else '无'} latest={'有' if latest else '无'}")
            if prev:
                print(f"      [Previous Status] = {prev[0].split('[Previous Status]',1)[1][:60]!r}")
            if latest:
                print(f"      [Latest Text] = {latest[0].split('[Latest Text]',1)[1][:60]!r}")


def analyze_normal(rounds: int):
    log = read_log()
    print(f"\n---- 普通模式请求日志（共 {len(log)} 条）----")
    for e in log:
        msgs = e["messages"]
        sys_msgs = [m["content"] for m in msgs if m["role"] == "system"]
        non_sys = [m for m in msgs if m["role"] != "system"]
        head = sys_msgs[0] if sys_msgs else ""
        print(f"  #{e['id']} {e['kind']} | sys={len(sys_msgs)} 对话={len(non_sys)}")
        print(f"      system 头部: {head[:80]!r}")
        if non_sys:
            print(f"      首条对话 = {non_sys[0]['role']}: {non_sys[0]['content'][:40]!r}")
            print(f"      末条对话 = {non_sys[-1]['role']}: {non_sys[-1]['content'][:40]!r}")


def main() -> int:
    c = httpx.Client(timeout=30)

    # ============ Agent 模式，关闭自动总结，跑 5 轮 ============
    print("=" * 70)
    print("测试 A：Agent 三代理 5 轮（关闭自动总结）")
    print("=" * 70)
    clear_log()
    c.put(f"{BASE}/api/settings", json={
        "apiKey": "test", "baseUrl": "http://127.0.0.1:9000/v1", "model": "m",
        "statusBarEnabled": True, "autoSummarize": False, "summarizeThreshold": 0,
    })
    with open(CARD, "rb") as f:
        r = c.post(f"{BASE}/api/sessions/import", files={"file": (os.path.basename(CARD), f, "image/png")})
    sid = r.json()["id"]

    for i in range(1, 6):
        ev = stream_chat(sid, f"用户第{i}轮发言")
        delta = "".join(e["content"] for e in ev if e["type"] == "delta")
        status = "".join(e["content"] for e in ev if e["type"] == "status_delta")
        print(f"\n[第{i}轮] delta={delta[:30]!r} status={status[:30]!r}")

    analyze_agent_round(5)

    # ============ Agent 模式，开启自动总结(阈值2)，跑 5 轮 ============
    print("\n" + "=" * 70)
    print("测试 B：Agent 三代理 5 轮（阈值2自动总结）")
    print("=" * 70)
    clear_log()
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": True, "autoSummarize": True, "summarizeThreshold": 2})
    for i in range(1, 6):
        ev = stream_chat(sid, f"总结测试第{i}轮")
        types = [e["type"] for e in ev]
        print(f"\n[第{i}轮] types={types}")
    analyze_agent_round(5)
    s = c.get(f"{BASE}/api/sessions/{sid}").json()
    print(f"\n会话 summary 长度={len(s['summary'])} lastSummarizedIndex={s['lastSummarizedIndex']} 总消息={len(s['messages'])}")

    # ============ 普通模式，关闭自动总结，跑 5 轮 ============
    print("\n" + "=" * 70)
    print("测试 C：普通模式 5 轮（关闭自动总结）")
    print("=" * 70)
    clear_log()
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": False, "autoSummarize": False, "summarizeThreshold": 0})
    with open(CARD, "rb") as f:
        r = c.post(f"{BASE}/api/sessions/import", files={"file": (os.path.basename(CARD), f, "image/png")})
    sid2 = r.json()["id"]
    for i in range(1, 6):
        ev = stream_chat(sid2, f"普通第{i}轮")
        delta = "".join(e["content"] for e in ev if e["type"] == "delta")
        print(f"[第{i}轮] delta={delta[:30]!r}")
    analyze_normal(5)

    # 清理
    c.delete(f"{BASE}/api/sessions/{sid}")
    c.delete(f"{BASE}/api/sessions/{sid2}")
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": False, "autoSummarize": True, "summarizeThreshold": 30})
    print("\n清理完成")
    return 0


if __name__ == "__main__":
    sys.exit(main())
