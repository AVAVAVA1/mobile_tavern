"""验证占位符替换逻辑 + 后端导入。"""
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, r"D:\mobile_tavern\fake\strange\backend")

from app.routers.pic import _apply_prompt_placeholders  # noqa: E402


def main():
    wf = json.loads(open(r"D:\mobile_tavern\fake\strange\workflows\default.json", encoding="utf-8").read())
    out = _apply_prompt_placeholders(wf, "一个女孩", "低质量")
    print("positive:", out["6"]["inputs"]["text"])
    print("negative:", out["7"]["inputs"]["text"])

    # 含引号/换行的提示词，验证 JSON 转义正确
    wf2 = {"t": "%PositivePrompt%"}
    out2 = _apply_prompt_placeholders(wf2, '带"引号"和\n换行', "")
    print("escaping:", json.dumps(out2, ensure_ascii=False))

    import importlib
    for m in ["app.routers.pic", "app.main"]:
        importlib.import_module(m)
        print("OK", m)


if __name__ == "__main__":
    sys.exit(main())
