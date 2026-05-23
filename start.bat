@echo off
cd /d D:\FILE\ShopShot

echo Starting ShopShot backend...
start "ShopShot Backend" start_backend.bat

timeout /t 2 /nobreak >nul

echo Starting ShopShot frontend...
start "ShopShot Frontend" start_frontend.bat

echo.
echo ShopShot windows opened.
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo.
pause
