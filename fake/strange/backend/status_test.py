"""状态栏 schema 端到端测试：导入提取 → schema 驱动输出 → 字段级继承 → 用户覆盖。"""
import json
import os
import sys

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8100"
CARD = r"D:\mobile_tavern\character\已读乱回DeepFake.png"  # 有 description/personality/scenario

results = []


def check(name, ok, extra=""):
    results.append((name, ok, extra))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {extra}")


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

    c.put(f"{BASE}/api/settings", json={
        "apiKey": "t", "baseUrl": "http://127.0.0.1:9000/v1", "model": "m",
        "statusBarEnabled": True, "autoSummarize": False, "summarizeThreshold": 0,
        "userName": "TESTUSER",
    })

    # 导入（触发卡分析）
    with open(CARD, "rb") as f:
        r = c.post(f"{BASE}/api/sessions/import", files={"file": (os.path.basename(CARD), f, "image/png")})
    session = r.json()
    sid = session["id"]

    card_analysis = (session["characterCard"]["data"] or {}).get("card_analysis") or {}
    schema = card_analysis.get("status_schema")
    check("导入后 card_analysis 存在", bool(card_analysis), "")
    check("提取 status_schema.specified=True", bool(schema and schema.get("specified")),
          json.dumps(schema, ensure_ascii=False)[:140])
    fields = (schema or {}).get("fields") or []
    check("schema 字段非空", len(fields) > 0, [f["key"] for f in fields])

    # 第 1 轮（mock 只返回 mood）
    stream(sid, "第一轮")
    s = c.get(f"{BASE}/api/sessions/{sid}").json()
    check("第1轮 statusData.mood=高兴", (s.get("statusData") or {}).get("mood") == "高兴",
          json.dumps(s.get("statusData"), ensure_ascii=False))
    check("第1轮 status 文本含情绪", "情绪状态" in (s.get("status") or ""), (s.get("status") or "")[:80])

    # 第 2 轮（mock 只返回 location，mood 应继承保留）
    stream(sid, "第二轮")
    s = c.get(f"{BASE}/api/sessions/{sid}").json()
    sd = s.get("statusData") or {}
    check("第2轮 mood 继承保留", sd.get("mood") == "高兴", json.dumps(sd, ensure_ascii=False))
    check("第2轮 location 更新为卧室", sd.get("location") == "卧室", json.dumps(sd, ensure_ascii=False))
    check("第2轮 status 文本含地点+情绪",
          "当前地点" in (s.get("status") or "") and "情绪状态" in (s.get("status") or ""),
          (s.get("status") or "")[:120])

    # 用户覆盖 statusSchema
    override = {"specified": True, "fields": [{"key": "outfit", "label": "衣着", "type": "string"}]}
    r = c.patch(f"{BASE}/api/sessions/{sid}", json={"statusSchema": override})
    saved = (r.json().get("statusSchema") or {}).get("fields") or []
    check("PATCH statusSchema 用户覆盖已保存", bool(saved) and saved[0]["key"] == "outfit", "")

    c.delete(f"{BASE}/api/sessions/{sid}")
    c.put(f"{BASE}/api/settings", json={"statusBarEnabled": False})

    print("-" * 40)
    ok = all(r[1] for r in results)
    print(f"总计 {sum(1 for r in results if r[1])}/{len(results)} 通过")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
