"""自动生图服务：元数据表触发时，用回复文本生成图片并插入消息流。"""
from __future__ import annotations

from typing import Optional

from .. import imagegen, store


async def maybe_generate_image(
    settings: dict,
    reply_content: str,
    session_id: str,
    after_id: str,
) -> Optional[dict]:
    """生成图片并插入到 after_id 消息下方；返回 image 事件 dict，或 None（未生成/失败）。"""
    result = await imagegen.generate_image(settings, reply_content)
    if not result.get("ok"):
        return None

    image_msg = {
        "id": store.gen_id(),
        "role": "assistant",
        "content": "",
        "timestamp": store.now_ms(),
        "messageType": "image",
        "imageUrl": result["url"],
    }
    store.insert_message_after(session_id, after_id, image_msg)
    return {"type": "image", "image": image_msg}
