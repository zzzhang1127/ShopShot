@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".env" (
  echo [ShopShot] 未找到根目录 .env，正在从 .env.example 复制...
  copy /Y .env.example .env >nul
  echo 请编辑 .env 填入 VOLC_API_KEY、DOUBAO_SEED_EP、DOUBAO_SEEDANCE_EP 后重新运行本脚本。
  notepad .env
  pause
  exit /b 1
)

echo [ShopShot] 构建并启动 Docker（端口 %SHOPSHOT_PORT%，默认 8000）...
docker compose up -d --build
if errorlevel 1 (
  echo 启动失败。请确认已安装 Docker Desktop 且 docker compose 可用。
  pause
  exit /b 1
)

echo.
echo ShopShot 已启动: http://localhost:8000
echo 健康检查:       http://localhost:8000/health
echo 查看日志:       docker compose logs -f shopshot
echo 停止:           docker compose down
echo.
pause
