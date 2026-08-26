"""生图：文本 → 提示词转换 → 替换占位符 → 提交 ComfyUI 生成并保存。"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path
from typing import Any, Dict

import httpx

from . import config
from .llm import call_chat_non_streaming

PROMPT_ENGINEER_SYSTEM = """## 角色设定
你是一名专业的 ComfyUI 提示词工程师。你的任务是将用户提供的中文场景描述，直接转换为用于 Stable Diffusion 的英文正向提示词（Positive Prompt）。

## 转换规则
1. 必须使用英文，以逗号分隔的标签形式，不要写成完整句子。
2. 严格按以下顺序排列标签：
   [质量词] → [主体/角色] → [外貌/服装] → [动作/姿势] → [表情/眼神] → [背景/环境] → [光影/氛围] → [风格词]
3. 质量词必须包含：masterpiece, best quality, highres, detailed（如有需要可加 absurdres）。
4. 将原文中的叙事、心理描写转换为纯视觉可描述的元素（如"害羞" → blushing, "揉胸" → pressing breasts）。
5. 忽略所有无法视觉化的内心独白或因果逻辑。
6. 对于关键特征，可使用 (关键词:权重) 加重，例如 (huge breasts:1.2)。
7. 输出内容仅为提示词本身，不要加任何标题、解释或额外说明。

## 输出格式
直接输出你生成的英文正向提示词，无需任何前缀或后缀。

## 示例
用户输入：一个少女在雨夜里撑着伞，站在路灯下，表情忧郁，风吹起她的长发。
你的输出：
masterpiece, best quality, highres, detailed, 1girl, solo, long hair, flowing hair, wind, holding umbrella, rain, night, street lamp, standing, looking sad, melancholic, wet ground, reflections, gloomy atmosphere, dramatic lighting"""


def _apply_placeholders(node, positive: str, negative: str):
    if isinstance(node, str):
        return node.replace("%PositivePrompt%", positive).replace("%NegativePrompt%", negative)
    if isinstance(node, list):
        return [_apply_placeholders(x, positive, negative) for x in node]
    if isinstance(node, dict):
        return {k: _apply_placeholders(v, positive, negative) for k, v in node.items()}
    return node


def _join(*parts) -> str:
    return ", ".join(p.strip() for p in parts if p and p.strip())


async def convert_to_tags(settings: dict, source_text: str) -> str:
    resp = await call_chat_non_streaming(settings, [
        {"role": "system", "content": PROMPT_ENGINEER_SYSTEM},
        {"role": "user", "content": source_text},
    ])
    msg = (resp.get("choices") or [{}])[0].get("message") or {}
    return (msg.get("content") or "").strip()


async def generate_image(settings: dict, source_text: str) -> Dict[str, Any]:
    """把文本转提示词 → 替换占位符 → 提交 ComfyUI → 下载保存。

    返回 {ok, url, filename, message}。
    """
    pic = settings.get("picGenerate") or {}
    cfg = (pic.get("sources") or {}).get("comfyui") or {}
    url = (cfg.get("url") or "").strip().rstrip("/")
    workflow_name = cfg.get("workflow") or ""
    prompt_prefix = cfg.get("promptPrefix") or ""
    negative = cfg.get("negativePrefix") or ""

    if not url:
        return {"ok": False, "message": "ComfyUI URL 未配置"}
    if not workflow_name:
        return {"ok": False, "message": "未选择 workflow"}

    try:
        tags = await convert_to_tags(settings, source_text)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "message": f"提示词转换失败：{e}"}

    positive = _join(prompt_prefix, tags)

    wf_path = config.WORKFLOWS_DIR / workflow_name
    if not wf_path.exists():
        return {"ok": False, "message": f"workflow 文件不存在：{workflow_name}"}
    try:
        workflow = json.loads(wf_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return {"ok": False, "message": f"workflow 不是合法 JSON：{e}"}

    workflow = _apply_placeholders(workflow, positive, negative)
    return await _submit_and_fetch(workflow, url)


async def _submit_and_fetch(workflow: dict, url: str) -> Dict[str, Any]:
    """提交 ComfyUI → 轮询 → 下载 → 保存到 output/。"""
    client_id = str(uuid.uuid4())
    out_dir = config.OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as client:
        try:
            resp = await client.post(f"{url}/prompt", json={"prompt": workflow, "client_id": client_id})
        except httpx.ConnectError:
            return {"ok": False, "message": "无法连接到 ComfyUI"}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "message": f"提交失败：{e}"}

        if resp.status_code != 200:
            return {"ok": False, "message": f"ComfyUI 返回 HTTP {resp.status_code}：{resp.text[:200]}"}
        prompt_id = resp.json().get("prompt_id")
        if not prompt_id:
            return {"ok": False, "message": "ComfyUI 未返回 prompt_id"}

        img = await _wait_for_first_image(client, url, prompt_id, 300.0)
        if not img:
            return {"ok": False, "message": "等待生成结果超时或出错"}

        filename, subfolder, img_type = img
        try:
            view = await client.get(
                f"{url}/view",
                params={"filename": filename, "subfolder": subfolder, "type": img_type},
            )
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "message": f"下载图片失败：{e}"}
        if view.status_code != 200:
            return {"ok": False, "message": f"下载图片失败（HTTP {view.status_code}）"}

        ext = Path(filename).suffix or ".png"
        save_name = f"{prompt_id}{ext}"
        (out_dir / save_name).write_bytes(view.content)

    return {
        "ok": True,
        "message": f"生成完成，prompt_id = {prompt_id}",
        "filename": save_name,
        "url": f"/api/pic/outputs/{save_name}",
    }


async def _wait_for_first_image(client: httpx.AsyncClient, url: str, prompt_id: str, timeout: float):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = await client.get(f"{url}/history/{prompt_id}")
            if r.status_code == 200:
                data = r.json()
                entry = data.get(prompt_id) or {}
                status = entry.get("status") or {}
                if status.get("status_str") == "error":
                    return None
                for node_out in (entry.get("outputs") or {}).values():
                    images = node_out.get("images") or []
                    if images:
                        img = images[0]
                        return (img.get("filename"), img.get("subfolder") or "", img.get("type") or "output")
        except Exception:
            pass
        await asyncio.sleep(2)
    return None
