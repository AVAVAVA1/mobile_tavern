"""后端冒烟测试（无需真实 LLM key）：导入、上下文、设置、chat 无 key 报错。"""
import json
import os
import sys

import httpx

BASE = "http://127.0.0.1:8100"
CARDS = [
    r"D:\mobile_tavern\character\性爱家教.png",
    r"D:\mobile_tavern\character\双子女仆.png",
]


def main() -> int:
    c = httpx.Client(timeout=30)

    # 1. health
    print("health:", c.get(f"{BASE}/api/health").json())

    # 2. import first card
    path = CARDS[0]
    print("\n== import", os.path.basename(path), "==")
    with open(path, "rb") as f:
        r = c.post(f"{BASE}/api/sessions/import", files={"file": (os.path.basename(path), f, "image/png")})
    print("status:", r.status_code)
    if r.status_code != 200:
        print("detail:", r.text[:500])
        return 1
    session = r.json()
    data = session["characterCard"]["data"]
    print("session id:", session["id"])
    print("name:", data.get("name"))
    print("desc len:", len(data.get("description", "")))
    print("first_mes:", (data.get("first_mes") or "")[:120])
    print("mes_example:", bool(data.get("mes_example")))
    book = data.get("character_book")
    print("character_book:", bool(book), "entries:", len((book or {}).get("entries") or []))
    print("agent_book:", bool(data.get("agent_book")))
    print("messages:", len(session["messages"]), "lastSummarizedIndex:", session["lastSummarizedIndex"])

    sid = session["id"]

    # 3. context (normal mode)
    print("\n== context (normal) ==")
    r = c.get(f"{BASE}/api/sessions/{sid}/context")
    ctx = r.json()
    print("mode:", ctx["mode"], "system:", len(ctx["systemMessages"]), "chat:", len(ctx["chatMessages"]))
    if ctx["systemMessages"]:
        print("system head:", ctx["systemMessages"][0]["content"][:200].replace("\n", " | "))

    # 4. chat without api key -> 400
    print("\n== chat without key ==")
    r = c.post(f"{BASE}/api/sessions/{sid}/chat", json={"text": "你好"})
    print("status:", r.status_code, "detail:", r.text[:200])

    # 5. enable agent mode
    print("\n== enable statusBarEnabled ==")
    r = c.put(f"{BASE}/api/settings", json={"statusBarEnabled": True})
    print("statusBarEnabled:", r.json()["statusBarEnabled"])

    r = c.get(f"{BASE}/api/sessions/{sid}/context")
    ctx = r.json()
    print("agent context mode:", ctx["mode"])
    print("planner sys:", len(ctx["plannerSystem"]), "writer sys:", len(ctx["writerSystem"]), "status sys:", len(ctx["statusSystem"]))
    print("injected:", ctx["injectedEntries"])

    # 6. patch title + book roundtrip
    print("\n== patch title ==")
    r = c.patch(f"{BASE}/api/sessions/{sid}", json={"title": "测试标题"})
    print("title:", r.json()["title"])

    # 7. list
    print("\n== list ==")
    r = c.get(f"{BASE}/api/sessions")
    print("sessions:", [(s["id"][:8], s["title"] or s["characterCard"]["data"]["name"]) for s in r.json()])

    # 8. delete
    print("\n== delete ==")
    r = c.delete(f"{BASE}/api/sessions/{sid}")
    print("delete:", r.status_code)
    r = c.get(f"{BASE}/api/sessions")
    print("remaining:", len(r.json()))

    # restore statusBarEnabled off
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": False})
    return 0


if __name__ == "__main__":
    sys.exit(main())
