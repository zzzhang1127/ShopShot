@echo off
chcp 65001 >nul
echo Checking Python...
C:\Users\13249\miniconda3\python.exe --version
echo.
echo Releasing backend port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
  echo Stopping old backend process %%a
  taskkill /PID %%a /F >nul 2>nul
)
echo.
echo Starting ShopShot backend...
cd /d D:\FILE\ShopShot\backend
C:\Users\13249\miniconda3\python.exe run_server.py
echo.
echo Backend stopped.
pause
