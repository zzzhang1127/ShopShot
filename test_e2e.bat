@echo off
chcp 65001 >nul
cd /d D:\FILE\ShopShot

echo [1/2] 检查后端 http://127.0.0.1:8000/health ...
curl -s http://127.0.0.1:8000/health >nul 2>&1
if errorlevel 1 (
  echo 后端未启动，请先运行 start_backend.bat，再执行本脚本。
  exit /b 1
)

echo [2/2] 运行首页 API 链路测试...
C:\Users\13249\miniconda3\python.exe scripts\e2e_home_api_test.py
exit /b %ERRORLEVEL%
