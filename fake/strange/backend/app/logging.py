"""统一日志：把"发给 LLM 的原始提示词 / LLM 的原始回复 / 生图提示词"写到控制台 + 文件。

目标（对应需求）：调试时不读源码，也能从日志看到每一次 AI 调用到底发了什么、回了什么。

- 控制台：uvicorn 的标准输出（后端终端）。
- 文件：`backend/logs/app.log`（滚动，最多保留 3 份，单份 2MB）。

安全：日志只记录 message 内容与 model/url，**不记录 API Key**（Key 在 header 里，从不打印）。
"""
from __future__ import annotations

import json
import logging
from logging.handlers import RotatingFileHandler
from typing import Any, Dict, List, Optional

from . import config

_LOGGER_NAME = "mobiletavern"
_LOG_DIR = config.BACKEND_DIR / "logs"
_LOG_FILE = _LOG_DIR / "app.log"

_logger: Optional[logging.Logger] = None


def _build_logger() -> logging.Logger:
    global _logger
    if _logger is not None:
        return _logger

    _LOG_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(_LOGGER_NAME)
    logger.setLevel(logging.INFO)
    # 不向 uvicorn/root logger 冒泡，避免重复打印
    logger.propagate = False

    if not logger.handlers:
        fmt = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s", "%Y-%m-%d %H:%M:%S"
        )
        console = logging.StreamHandler()
        console.setFormatter(fmt)
        logger.addHandler(console)

        file_handler = RotatingFileHandler(
            _LOG_FILE, maxBytes=2_000_000, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(fmt)
        logger.addHandler(file_handler)

    _logger = logger
    return logger


def get_logger() -> logging.Logger:
    return _build_logger()


def _j(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, indent=2)
    except Exception:  # noqa: BLE001
        return str(obj)


def log_llm_request(
    kind: str,
    model: str,
    base_url: str,
    messages: List[dict],
    extra: Optional[dict] = None,
) -> None:
    """记录一次发给 LLM 的完整请求体（原始提示词）。"""
    lines = [
        "=" * 70,
        f"[LLM REQUEST] kind={kind} | model={model} | url={base_url}",
        _j(messages),
    ]
    if extra:
        lines.append(f"[extra] {_j(extra)}")
    get_logger().info("\n".join(lines))


def log_llm_response(kind: str, text: str, extra: Optional[dict] = None) -> None:
    """记录一次 LLM 的原始回复（流式=累计正文，非流式=完整响应 JSON）。"""
    lines = [
        f"[LLM RESPONSE] kind={kind}",
        text,
    ]
    if extra:
        lines.append(f"[extra] {_j(extra)}")
    get_logger().info("\n".join(lines))


def log_image_prompt(
    source_text: str,
    tags: str,
    positive: str,
    negative: str,
    workflow: str,
    url: str = "",
) -> None:
    """记录生图链路里生成的提示词（源文本 → 转写 tags → 最终正/负提示词）。"""
    lines = [
        "=" * 70,
        f"[IMAGE PROMPT] workflow={workflow} | url={url}",
        "[source text]",
        source_text,
        "[converted tags]",
        tags,
        "[positive prompt]",
        positive,
        "[negative prompt]",
        negative,
    ]
    get_logger().info("\n".join(lines))
