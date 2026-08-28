# 生图

## 定位
把文本转成英文提示词 → 替换 workflow 占位符 → 提交 ComfyUI → 轮询 → 下载 → 保存本地并回传 URL。生图业务的**唯一出口**在 `imagegen.py`。

## 文件
- `backend/app/imagegen.py` — 业务核心（转换 + 提交 + 下载）
- `backend/app/routers/pic.py` — HTTP 端点（连接测试 / workflow 管理 / 生图触发）
- `backend/app/services/image_service.py` — 对话内自动生图 `maybe_generate_image`

## 输入

```python
async def generate_image(settings, source_text) -> Dict
async def convert_to_tags(settings, source_text) -> str
async def submit_and_fetch(workflow, url) -> Dict
apply_placeholders(node, positive, negative) -> Any
```

- `settings.picGenerate`：
  ```json
  { "source": "comfyui",
    "sources": { "comfyui": { "url", "workflow", "promptPrefix", "negativePrefix" } } }
  ```
- `source_text`：要转成图片的文本（对话正文 / 某条消息）。

## 输出
- `generate_image` / `submit_and_fetch` 返回 `{"ok": true, "url", "filename", "message"}` 或 `{"ok": false, "message"}`。
- `url` 形如 `/api/pic/outputs/{filename}`；图片落在项目根 `output/`。
- 过程日志：`log_image_prompt` 记录源文本 → 转写 tags → 最终正/负提示词。

## 流程
1. `convert_to_tags`：LLM（kind=`image_prompt`）把中文场景转成 SD 英文 tags。
2. `positive = promptPrefix + tags`（`_join` 逗号连接）；`negative = negativePrefix`。
3. 读取 `workflows/{workflow}` JSON，`apply_placeholders` 递归替换 `%PositivePrompt%` / `%NegativePrompt%`。
4. `submit_and_fetch`：POST `{url}/prompt` → 轮询 `{url}/history/{prompt_id}`（每 2s，最长 300s）→ GET `{url}/view` → 存 `output/{prompt_id}.png`。

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/pic/comfyui/test` | `{"url":""}` → 连接测试 `{ok,message}` |
| GET | `/pic/workflows` | workflow 文件名列表 |
| GET/PUT | `/pic/workflows/{name}` | 读/写 workflow JSON |
| POST | `/pic/comfyui/generate` | 测试生图（用 promptPrefix 直接出图，不经过 LLM 转写） |
| GET | `/pic/outputs/{filename}` | 回传本地图片 |
| POST | `/sessions/{id}/messages/{mid}/image` | 手动生图：按消息文本生成并插入到该消息下方 |

## 依赖 / 被谁调用
- 依赖 `llm`、`config`、`logging`。
- 被 `services/image_service.py`（对话内自动生图）、`routers/pic.py`（手动/测试生图）调用。

## 扩展点 / 注意
- 新增生图来源（如 SD WebUI）：前端 `PicGenerateModal.PIC_SOURCES` 加来源项，后端加对应 `sources[来源]` 的读取与提交逻辑（当前只有 comfyui 分支）。
- `pic.py` 已复用 `imagegen.apply_placeholders` / `submit_and_fetch`，不再各自复制逻辑。
- `_safe_name` 防路径穿越；workflow 名只允许纯文件名。
