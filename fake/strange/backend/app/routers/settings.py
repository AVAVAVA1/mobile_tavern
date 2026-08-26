"""设置路由。"""
from fastapi import APIRouter

from .. import store

router = APIRouter()


@router.get("/settings")
def get_settings():
    return store.get_settings()


@router.put("/settings")
def put_settings(body: dict):
    return store.update_settings(body)
