"""全局预设 / 正则脚本 / 世界书 的读写端点（RP-Hub 增强，app_data.json）。"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter

from .. import store

router = APIRouter()


@router.get("/presets")
def get_presets():
    return store.get_global_presets()


@router.put("/presets")
def put_presets(items: List[dict]):
    store.update_app_data("presets", items)
    return store.get_global_presets()


@router.get("/regex")
def get_regex():
    return store.get_global_regex_scripts()


@router.put("/regex")
def put_regex(items: List[dict]):
    store.update_app_data("regexScripts", items)
    return store.get_global_regex_scripts()


@router.get("/worldinfo")
def get_worldinfo():
    return store.get_global_world_info()


@router.put("/worldinfo")
def put_worldinfo(items: List[dict]):
    store.update_app_data("worldInfo", items)
    return store.get_global_world_info()
