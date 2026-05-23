@echo off
chcp 65001 >nul
echo Checking Python...
C:\Users\13249\miniconda3\python.exe --version
echo.
echo Starting ShopShot backend...
cd /d D:\FILE\ShopShot\backend
C:\Users\13249\miniconda3\python.exe run_server.py
echo.
echo Backend stopped.
pause
