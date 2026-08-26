"""生图路由：来源连接测试 + workflow 文件管理 + 生图（提交/轮询/下载/本地保存）。"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import config, imagegen, store

router = APIRouter()


class ComfyUITestRequest(BaseModel):
    url: str = ""


class WorkflowSaveRequest(BaseModel):
    content: str = ""


def _workflows_dir() -> Path:
    d = config.WORKFLOWS_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def _outputs_dir() -> Path:
    d = config.OUTPUT_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def _safe_name(name: str) -> str:
    """防止路径穿越，只允许纯文件名。"""
    if Path(name).name != name or name in ("", ".", "..") or "/" in name or "\\" in name:
        raise HTTPException(400, "Invalid workflow name")
    return name


def _apply_prompt_placeholders(node, positive: str, negative: str):
    """递归替换 workflow 里的 %PositivePrompt% / %NegativePrompt%（保持 JSON 转义正确）。"""
    if isinstance(node, str):
        return node.replace("%PositivePrompt%", positive).replace("%NegativePrompt%", negative)
    if isinstance(node, list):
        return [_apply_prompt_placeholders(x, positive, negative) for x in node]
    if isinstance(node, dict):
        return {k: _apply_prompt_placeholders(v, positive, negative) for k, v in node.items()}
    return node


@router.post("/pic/comfyui/test")
async def test_comfyui(body: ComfyUITestRequest):
    """检查 ComfyUI 是否可达（访问 /system_stats）。"""
    url = (body.url or "").strip().rstrip("/")
    if not url:
        return {"ok": False, "message": "URL 为空"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=5.0)) as client:
            resp = await client.get(f"{url}/system_stats")
        if resp.status_code == 200:
            return {"ok": True, "message": f"连接成功（HTTP {resp.status_code}）"}
        return {"ok": False, "message": f"连接失败（HTTP {resp.status_code}）"}
    except httpx.TimeoutException:
        return {"ok": False, "message": "连接超时"}
    except httpx.ConnectError:
        return {"ok": False, "message": "无法连接到该地址"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "message": f"连接失败：{e}"}


@router.get("/pic/workflows")
def list_workflows():
    return sorted(p.name for p in _workflows_dir().glob("*.json"))


@router.get("/pic/workflows/{name}")
def get_workflow(name: str):
    _safe_name(name)
    p = _workflows_dir() / name
    if not p.exists():
        raise HTTPException(404, "Workflow not found")
    return {"name": name, "content": p.read_text(encoding="utf-8")}


@router.put("/pic/workflows/{name}")
def save_workflow(name: str, body: WorkflowSaveRequest):
    _safe_name(name)
    try:
        json.loads(body.content)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"不是合法 JSON：{e}")
    (_workflows_dir() / name).write_text(body.content, encoding="utf-8")
    return {"ok": True}


async def _wait_for_first_image(client: httpx.AsyncClient, url: str, prompt_id: str, timeout: float):
    """轮询 /history/{prompt_id}，返回第一张图 (filename, subfolder, type) 或 None。"""
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
                outputs = entry.get("outputs") or {}
                for node_out in outputs.values():
                    images = node_out.get("images") or []
                    if images:
                        img = images[0]
                        return (img.get("filename"), img.get("subfolder") or "", img.get("type") or "output")
        except Exception:
            pass
        await asyncio.sleep(2)
    return None


@router.post("/pic/comfyui/generate")
async def generate_comfyui():
    """测试生图：读设置 → 替换占位符 → 提交 ComfyUI → 轮询 → 下载并保存到本地 output/。"""
    pic = store.get_settings().get("picGenerate") or {}
    cfg = (pic.get("sources") or {}).get("comfyui") or {}
    url = (cfg.get("url") or "").strip().rstrip("/")
    workflow_name = cfg.get("workflow") or ""
    positive = cfg.get("promptPrefix") or ""
    negative = cfg.get("negativePrefix") or ""

    if not url:
        return {"ok": False, "message": "ComfyUI URL 未配置"}
    if not workflow_name:
        return {"ok": False, "message": "未选择 workflow"}

    wf_path = _workflows_dir() / workflow_name
    if not wf_path.exists():
        return {"ok": False, "message": f"workflow 文件不存在：{workflow_name}"}

    try:
        workflow = json.loads(wf_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return {"ok": False, "message": f"workflow 不是合法 JSON：{e}"}

    workflow = _apply_prompt_placeholders(workflow, positive, negative)

    client_id = str(uuid.uuid4())
    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as client:
        # 1. 提交
        try:
            resp = await client.post(f"{url}/prompt", json={"prompt": workflow, "client_id": client_id})
        except httpx.ConnectError:
            return {"ok": False, "message": "无法连接到 ComfyUI"}
        except httpx.TimeoutException:
            return {"ok": False, "message": "提交超时"}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "message": f"提交失败：{e}"}

        if resp.status_code != 200:
            return {"ok": False, "message": f"ComfyUI 返回 HTTP {resp.status_code}：{resp.text[:200]}"}
        prompt_id = resp.json().get("prompt_id")
        if not prompt_id:
            return {"ok": False, "message": "ComfyUI 未返回 prompt_id"}

        # 2. 轮询等待出图
        img = await _wait_for_first_image(client, url, prompt_id, timeout=300.0)
        if not img:
            return {"ok": False, "message": "等待生成结果超时或出错"}

        filename, subfolder, img_type = img

        # 3. 下载图片
        try:
            view = await client.get(f"{url}/view", params={"filename": filename, "subfolder": subfolder, "type": img_type})
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "message": f"下载图片失败：{e}"}
        if view.status_code != 200:
            return {"ok": False, "message": f"下载图片失败（HTTP {view.status_code}）"}

        # 4. 保存到本地 output/ 临时目录
        ext = Path(filename).suffix or ".png"
        save_name = f"{prompt_id}{ext}"
        (_outputs_dir() / save_name).write_bytes(view.content)

    return {
        "ok": True,
        "message": f"生成完成，prompt_id = {prompt_id}",
        "filename": save_name,
        "url": f"/api/pic/outputs/{save_name}",
    }


@router.get("/pic/outputs/{filename}")
def get_output(filename: str):
    """回传本地已生成的图片（方便前端展示）。"""
    _safe_name(filename)
    p = _outputs_dir() / filename
    if not p.exists():
        raise HTTPException(404, "图片不存在")
    return FileResponse(p)


@router.post("/sessions/{session_id}/messages/{message_id}/image")
async def generate_image_for_message(session_id: str, message_id: str):
    """手动生图：用某条消息文本生成图片，插入到该消息下方（不计入历史）。"""
    session = store.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    msg = next((m for m in session["messages"] if m["id"] == message_id), None)
    if not msg:
        raise HTTPException(404, "Message not found")

    settings = store.get_settings()
    result = await imagegen.generate_image(settings, msg.get("content") or "")
    if not result.get("ok"):
        return result

    image_msg = {
        "id": store.gen_id(),
        "role": "assistant",
        "content": "",
        "timestamp": store.now_ms(),
        "messageType": "image",
        "imageUrl": result["url"],
    }
    store.insert_message_after(session_id, message_id, image_msg)
    store.persist()
    return image_msg
