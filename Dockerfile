# ShopShot 一键部署：多阶段构建前端 + 后端（含 FFmpeg），单容器对外 8000

# --- 前端构建 ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# 生产构建走同源 /api/v1，无需 VITE_API_BASE
RUN npm run build

# --- 运行时 ---
FROM python:3.12-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

RUN mkdir -p /data/outputs

ENV PYTHONUNBUFFERED=1 \
    DATABASE_URL=sqlite:////data/shopshot.db \
    STORAGE_LOCAL_PATH=/data/outputs \
    MOCK_MODE=false \
    PORT=7860

# 魔搭创空间要求监听 7860；本地 Docker 可通过 -e PORT=8000 覆盖
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','7860')+'/health', timeout=5)"

CMD ["python", "run_server.py"]
