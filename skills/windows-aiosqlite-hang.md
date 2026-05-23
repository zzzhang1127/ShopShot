---
name: windows-aiosqlite-hang
description: On Windows 11, aiosqlite + async SQLAlchemy hangs indefinitely even on basic connect(). Complete backend refactor to sync SQLAlchemy is required.
metadata:
  type: feedback
---

**Rule:** On Windows, never use aiosqlite or async SQLAlchemy with SQLite. Use sync SQLAlchemy exclusively.

**Why:** In this project (ShopShot, May 2026), `aiosqlite.connect()` hung indefinitely on Windows 11 Home 10.0.26200. Even the most basic `await aiosqlite.connect("test.db")` never returned. Attempted fixes including `asyncio.WindowsSelectorEventLoopPolicy()` and explicit `new_event_loop()` both failed. This appears to be a fundamental incompatibility between aiosqlite and the Windows ProactorEventLoop or the bash shell environment.

**How to apply:**
- Use `sqlmodel.create_engine()` + `Session` (not `AsyncSession`)
- Rewrite all `async def` route handlers to sync `def`
- Replace `await db.execute()` with `db.execute()`
- Replace `await db.commit()` with `db.commit()`
- Replace `await db.refresh()` with `db.refresh()`
- Ensure `get_db()` yields a sync `Session`
- Remove all `AsyncSession` imports
- Uvicorn lifespan can still be async, but call `init_db()` (sync) without `await`

**Reference:** Full refactor required touching ~15 files including database.py, all services, all agents, all API routes, and main.py.
