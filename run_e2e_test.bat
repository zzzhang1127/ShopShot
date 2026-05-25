@echo off
chcp 65001 >nul
cd /d D:\FILE\ShopShot
start "ShopShot Backend" cmd /c start_backend.bat
echo 等待后端启动...
timeout /t 5 /nobreak >nul
call test_e2e.bat
pause
