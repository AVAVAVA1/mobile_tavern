"""假 ComfyUI 服务器，用于验证生图链路（/prompt、/history、/view、/system_stats）。"""
import base64
import json

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

app = FastAPI()

# 1x1 透明 PNG
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


@app.get("/system_stats")
def system_stats():
    return {"system": {"comfyui_version": "mock"}}


@app.post("/prompt")
async def prompt(request: Request):
    body = await request.json()
    with open("mock_prompt.json", "w", encoding="utf-8") as f:
        json.dump(body.get("prompt"), f, ensure_ascii=False)
    return JSONResponse({"prompt_id": "test-123"})


@app.get("/history/{prompt_id}")
def history(prompt_id: str):
    return {
        prompt_id: {
            "outputs": {
                "9": {"images": [{"filename": "out.png", "subfolder": "", "type": "output"}]}
            }
        }
    }


@app.get("/view")
def view():
    return Response(content=PNG, media_type="image/png")
