"""FastAPI 入口。"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import store
from .routers import appdata, cards, chat, context, pic, sessions, settings

store.init()

app = FastAPI(title="MobileTavern PC Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(context.router, prefix="/api")
app.include_router(pic.router, prefix="/api")
app.include_router(appdata.router, prefix="/api")
app.include_router(cards.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
