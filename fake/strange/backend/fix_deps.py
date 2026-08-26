"""补齐缺失/不匹配的依赖：annotated-doc、typing-inspection、colorama，并把 pydantic-core 降到 2.46.4。"""
import json
import os
import shutil
import sys
import urllib.request
import zipfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # fake/strange
SITE = os.path.join(BASE, ".venv", "Lib", "site-packages")
CACHE = os.path.join(BASE, ".wheels")

# (PyPI 包名, 需要的版本或 None=最新)
TARGETS = [
    ("annotated-doc", None),
    ("typing-inspection", None),
    ("colorama", None),
    ("pydantic-core", "2.46.4"),
]


def get_json(pkg: str) -> dict:
    with urllib.request.urlopen(f"https://pypi.org/pypi/{pkg}/json", timeout=60) as r:
        return json.load(r)


def pick(files: list) -> dict:
    wheels = [f for f in files if f["filename"].endswith(".whl")]
    for f in wheels:
        if "py3-none-any" in f["filename"]:
            return f
    for f in wheels:
        if "cp312" in f["filename"] and "win_amd64" in f["filename"]:
            return f
    for f in wheels:
        if "win_amd64" in f["filename"]:
            return f
    raise RuntimeError(f"no wheel: {[f['filename'] for f in wheels]}")


def install(pkg: str, version: str | None) -> None:
    data = get_json(pkg)
    if version is not None:
        rel = data["releases"].get(version)
        if not rel:
            raise RuntimeError(f"{pkg}=={version} not found")
        f = pick(rel)
    else:
        f = pick(data["urls"])

    filename = f["filename"]
    local = os.path.join(CACHE, filename)
    if not os.path.exists(local):
        print(f"  download {filename}")
        with urllib.request.urlopen(f["url"], timeout=120) as r:
            content = r.read()
        with open(local, "wb") as fh:
            fh.write(content)
    with zipfile.ZipFile(local) as z:
        z.extractall(SITE)
    print(f"  installed {pkg} ({filename})")


def main() -> None:
    os.makedirs(CACHE, exist_ok=True)

    # 先删除旧的 pydantic-core dist-info，避免版本冲突
    for name in os.listdir(SITE):
        if name.startswith("pydantic_core-") and name.endswith(".dist-info"):
            full = os.path.join(SITE, name)
            shutil.rmtree(full, ignore_errors=True)
            print(f"  removed {name}")

    for pkg, version in TARGETS:
        print(f"[{pkg}{('==' + version) if version else ''}]")
        install(pkg, version)

    print("\n验证：")
    for mod in ["fastapi", "pydantic", "pydantic_core", "typing_inspection", "annotated_doc", "colorama"]:
        try:
            m = __import__(mod)
            v = getattr(m, "__version__", "")
            print(f"  OK  {mod} {v}")
        except Exception as e:
            print(f"  FAIL {mod}: {e}")


if __name__ == "__main__":
    sys.exit(main())
