"""开发服务器入口：python run.py

host 用 0.0.0.0，便于局域网内其它设备（手机等）访问；仅本机使用时改成 127.0.0.1 更安全。
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8100, reload=False)
