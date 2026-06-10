import asyncio
import os
import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.main import app

if __name__ == '__main__':
    import hypercorn.asyncio
    import hypercorn.config

    # 魔搭创空间通过 PORT 环境变量注入端口（默认 7860）；本地开发沿用 8000
    port = int(os.environ.get("PORT", 8000))

    config = hypercorn.config.Config()
    config.bind = [f"0.0.0.0:{port}"]
    config.accesslog = "-"
    config.errorlog = "-"

    asyncio.run(hypercorn.asyncio.serve(app, config))
