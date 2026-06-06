"""后台利用 Seed LLM 持续扩充带货模板目录。"""

from __future__ import annotations

import asyncio
import logging
import random

from app.config import get_settings
from app.services.template_catalog_service import (
    CATEGORY_DEFS,
    add_templates,
    get_stats,
    mark_expanded,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是 TikTok Shop 电商短视频模板策划专家。
输出 JSON 对象，格式：
{
  "templates": [
    {
      "title": "唯一中文标题，不得与已有重复",
      "category": "类目英文id，必须从给定列表选择",
      "category_label": "中文类目",
      "prompt": "完整创作提示词，含四镜AIDA与口播风格",
      "hook": "开场钩子文案",
      "selling_points": ["卖点1","卖点2","卖点3"],
      "shot_plan": ["镜1...","镜2...","镜3...","镜4..."],
      "cta": "结尾转化话术",
      "duration": 15或20,
      "tags": ["标签1","标签2"]
    }
  ]
}
要求：每条模板必须可独立用于一键成片；标题与 prompt 不得重复套路；覆盖不同人群与价格带。"""


def _pick_categories(batch_size: int) -> list[str]:
    keys = list(CATEGORY_DEFS.keys())
    random.shuffle(keys)
    return keys[: max(batch_size, 1)]


def expand_once_via_seed(batch_size: int | None = None) -> int:
    settings = get_settings()
    batch_size = batch_size or settings.template_expand_batch_size
    stats = get_stats()
    if stats["total"] >= settings.template_expand_target:
        return 0
    if not settings.volc_api_key or not settings.doubao_seed_ep:
        logger.warning("Template expand skipped: VOLC_API_KEY or DOUBAO_SEED_EP not configured")
        return 0

    from app.utils.seed_client import get_seed_client

    cats = _pick_categories(min(batch_size, 8))
    cat_hint = ", ".join(f"{c}({CATEGORY_DEFS[c][1]})" for c in cats)
    user_prompt = (
        f"请生成 {batch_size} 条互不重复的电商带货视频模板。"
        f"优先类目：{cat_hint}。"
        f"当前库内已有 {stats['total']} 条，目标 {settings.template_expand_target} 条。"
        "每条 duration 15 或 20，ratio 9:16。"
    )

    try:
        client = get_seed_client()
        data = client.generate_json(SYSTEM_PROMPT, user_prompt, temperature=0.85)
        items = data.get("templates") if isinstance(data, dict) else []
        if not isinstance(items, list):
            return 0
        for item in items:
            if isinstance(item, dict):
                item["source"] = "seed_llm"
                item["is_new"] = True
        added = add_templates([i for i in items if isinstance(i, dict)])
        if added:
            mark_expanded()
            logger.info("Template catalog expanded by %s (total now %s)", added, get_stats()["total"])
        return added
    except Exception as exc:
        logger.exception("Template expand failed: %s", exc)
        return 0


async def expander_loop(stop: asyncio.Event) -> None:
    settings = get_settings()
    if not settings.template_expand_enabled:
        return
    logger.info(
        "Template expander started (target=%s, interval=%ss)",
        settings.template_expand_target,
        settings.template_expand_interval_seconds,
    )
    while not stop.is_set():
        try:
            stats = get_stats()
            if stats["total"] < settings.template_expand_target:
                await asyncio.to_thread(expand_once_via_seed)
        except Exception:
            logger.exception("Expander loop error")
        try:
            await asyncio.wait_for(stop.wait(), timeout=settings.template_expand_interval_seconds)
            break
        except asyncio.TimeoutError:
            continue
    logger.info("Template expander stopped")
