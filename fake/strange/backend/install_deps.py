"""手动下载 wheel 并解包到虚拟环境 site-packages（绕过 pip 临时目录清理问题）。

用法： .venv/Scripts/python.exe backend/install_deps.py
"""
import json
import os
import sys
import urllib.request
import zipfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # fake/strange
SITE = os.path.join(BASE, ".venv", "Lib", "site-packages")
CACHE = os.path.join(BASE, ".wheels")

# 后端所需包的完整闭包（含传递依赖）
PACKAGES = [
    "fastapi",
    "starlette",
    "pydantic",
    "pydantic-core",
    "annotated-types",
    "typing-extensions",
    "anyio",
    "idna",
    "sniffio",
    "click",
    "h11",
    "httpx",
    "httpcore",
    "certifi",
    "python-multipart",
    "uvicorn",
]


def get_json(pkg: str) -> dict:
    url = f"https://pypi.org/pypi/{pkg}/json"
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def pick_wheel(files: list) -> dict:
    wheels = [f for f in files if f["filename"].endswith(".whl")]
    if not wheels:
        raise RuntimeError(f"no wheel available (files={len(files)})")
    # 优先纯 Python wheel
    for f in wheels:
        if "py3-none-any" in f["filename"]:
            return f
    # 其次 cp312 + win_amd64（pydantic-core 等原生包）
    for f in wheels:
        if "cp312" in f["filename"] and "win_amd64" in f["filename"]:
            return f
    # 兜底：任意 win_amd64
    for f in wheels:
        if "win_amd64" in f["filename"]:
            return f
    raise RuntimeError(f"no suitable wheel: {[f['filename'] for f in wheels]}")


def install(pkg: str) -> None:
    data = get_json(pkg)
    f = pick_wheel(data["urls"])
    filename = f["filename"]
    local = os.path.join(CACHE, filename)

    if not os.path.exists(local):
        print(f"  download {filename}")
        with urllib.request.urlopen(f["url"], timeout=120) as r:
            content = r.read()
        with open(local, "wb") as fh:
            fh.write(content)
    else:
        print(f"  cached  {filename}")

    with zipfile.ZipFile(local) as z:
        z.extractall(SITE)

    print(f"  installed {pkg}")


def main() -> None:
    os.makedirs(CACHE, exist_ok=True)
    for pkg in PACKAGES:
        print(f"[{pkg}]")
        install(pkg)

    print("\n验证导入：")
    for mod in ["fastapi", "uvicorn", "httpx", "pydantic", "multipart", "starlette", "anyio", "h11", "httpcore"]:
        try:
            __import__(mod)
            print(f"  OK  {mod}")
        except Exception as e:
            print(f"  FAIL {mod}: {e}")


if __name__ == "__main__":
    sys.exit(main())
