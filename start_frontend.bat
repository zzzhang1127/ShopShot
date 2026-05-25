@echo off
echo Releasing frontend port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  echo Stopping old frontend process %%a
  taskkill /PID %%a /F >nul 2>nul
)
echo.
cd /d D:\FILE\ShopShot\frontend
npm run dev
pause
