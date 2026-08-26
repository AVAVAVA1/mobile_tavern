"""Pydantic 数据模型（camelCase，与前端 JSON 一一对应）。"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AppSettings(BaseModel):
    apiKey: str = ""
    model: str = "gpt-3.5-turbo"
    baseUrl: str = "https://api.openai.com/v1"
    summarizeThreshold: int = 30
    userName: str = "User"
    authorNoteText: str = ""
    authorNoteDepth: int = 4
    storyStringTemplate: str = ""
    autoSummarize: bool = True
    customSystemPrompt: str = ""
    statusBarEnabled: bool = False
    # 生图配置：source 为当前来源，sources 下每个来源一份自己的配置（可扩展）
    picGenerate: Dict[str, Any] = Field(default_factory=lambda: {
        "source": "comfyui",
        "sources": {
            "comfyui": {
                "url": "http://127.0.0.1:8188",
                "workflow": "",
                "promptPrefix": "",
                "negativePrefix": "",
            }
        },
    })


class ChatMessage(BaseModel):
    model_config = {"extra": "allow"}

    id: str
    role: str  # "system" | "user" | "assistant"
    content: str
    timestamp: int
    messageType: Optional[str] = None  # "message" | "status"
    workflowV2: Optional[Dict[str, Any]] = None


class Session(BaseModel):
    model_config = {"extra": "allow"}

    id: str
    characterCard: Dict[str, Any]
    messages: List[ChatMessage] = Field(default_factory=list)
    createdAt: int
    userName: str = "User"
    title: str = ""
    summary: str = ""
    lastSummarizedIndex: int = -1
    deletedMessageIds: List[str] = Field(default_factory=list)
    status: str = ""
    previousStatus: str = ""
