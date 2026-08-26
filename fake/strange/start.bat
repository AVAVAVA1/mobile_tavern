@echo off
title MobileTavern ������
cd /d "%~dp0"

echo ============================================
echo   MobileTavern PC ǰ�������
echo ============================================
echo.

echo [1/2] ������� FastAPI  (http://127.0.0.1:8100) ...
start "MobileTavern Backend" /D "%~dp0backend" cmd /k "..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8100"

echo [2/2] ����ǰ�� Vite     (http://127.0.0.1:5173) ...
start "MobileTavern Frontend" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo ���������У��Ժ���������Զ��� http://127.0.0.1:5173
echo ��δ�Զ��򿪣����ֶ����ʸõ�ַ��
echo.
echo ֹͣ�����ڶ�Ӧ�� Backend / Frontend ���ڰ� Ctrl+C����ֱ�ӹرոô��ڡ�
echo �رձ����������ڲ�Ӱ���������ķ���
echo.

timeout /t 4 /nobreak >nul
start "" http://localhost:5173/

echo �Ѵ����������������رձ����������ڣ����񱣳����У�...
pause >nul