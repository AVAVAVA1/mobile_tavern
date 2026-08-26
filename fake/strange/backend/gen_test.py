"""生图端到端测试：配置 → 生成 → 验证占位符替换 → 下载本地图片。"""
import json
import sys

import httpx

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

B = "http://127.0.0.1:8100/api"


def main():
    c = httpx.Client(timeout=120)

    c.put(B + "/settings", json={"picGenerate": {
        "source": "comfyui",
        "sources": {"comfyui": {
            "url": "http://127.0.0.1:8188",
            "workflow": "default.json",
            "promptPrefix": "一个女孩, 大师级作品",
            "negativePrefix": "低质量, 模糊",
        }},
    }})

    r = c.post(B + "/pic/comfyui/generate")
    print("generate:", r.status_code)
    out = r.json()
    print("result:", out)

    # 验证 mock 收到的 prompt 里占位符被替换
    prompt = json.load(open(r"D:\mobile_tavern\fake\strange\backend\mock_prompt.json", encoding="utf-8"))
    print("positive 已替换:", prompt["6"]["inputs"]["text"])
    print("negative 已替换:", prompt["7"]["inputs"]["text"])

    # 下载输出图片
    if out.get("url"):
        rr = c.get("http://127.0.0.1:8100" + out["url"])
        print("image:", rr.status_code, rr.headers.get("content-type"), len(rr.content), "bytes")


if __name__ == "__main__":
    sys.exit(main())
