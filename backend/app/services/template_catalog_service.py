"""带货模板目录：本地 JSON 持久化 + 矩阵 bootstrap + 去重。"""

from __future__ import annotations

import hashlib
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.config import get_settings

_lock = threading.Lock()

# category -> (media_key, 中文类目名)
CATEGORY_DEFS: dict[str, tuple[str, str]] = {
    "fashion": ("clothes", "服饰鞋包"),
    "beauty": ("cosmetics", "美妆护肤"),
    "skincare": ("cosmetics", "护肤保养"),
    "makeup": ("cosmetics", "彩妆造型"),
    "3c": ("electronics", "数码3C"),
    "electronics": ("electronics", "智能电子"),
    "food": ("food", "美食餐饮"),
    "snack": ("food", "休闲零食"),
    "home": ("home", "家居生活"),
    "furniture": ("home", "家具软装"),
    "kitchen": ("home", "厨房好物"),
    "sports": ("sports", "运动户外"),
    "fitness": ("sports", "健身装备"),
    "jewelry": ("jewelry", "珠宝首饰"),
    "accessories": ("jewelry", "时尚配饰"),
    "baby": ("home", "母婴用品"),
    "pet": ("food", "宠物用品"),
    "automotive": ("electronics", "车载用品"),
    "office": ("electronics", "办公效率"),
    "health": ("cosmetics", "健康保健"),
    "outdoor": ("sports", "露营户外"),
    "travel": ("home", "旅行收纳"),
    "books": ("home", "图书文创"),
    "virtual": ("electronics", "虚拟课程"),
}

STYLE_DEFS: list[tuple[str, str, str]] = [
    ("host", "口播爆款", "真人出镜口播，开场3秒强钩子，强调卖点与信任感"),
    ("scene", "场景种草", "生活场景自然植入，展示真实使用体验"),
    ("unbox", "开箱测评", "第一视角开箱，突出参数与做工细节"),
    ("compare", "对比种草", "使用前后对比，痛点—解决方案结构"),
    ("promo", "限时促销", "价格锚点+限时优惠，结尾强CTA转化"),
]

PRODUCT_SAMPLES: dict[str, list[str]] = {
    "fashion": ["高跟鞋", "连衣裙", "运动卫衣", "真皮手提包", "防晒冰袖"],
    "beauty": ["修护精华", "口红套盒", "气垫粉底", "香氛礼盒", "卸妆油"],
    "skincare": ["玻尿酸面膜", "维C精华", "防晒霜", "身体乳", "眼霜"],
    "makeup": ["眼影盘", "定妆喷雾", "眉笔", "腮红", "假睫毛"],
    "3c": ["无线耳机", "机械键盘", "平板支架", "充电宝", "智能手表"],
    "electronics": ["投影仪", "扫地机器人", "空气炸锅", "加湿器", "蓝牙音箱"],
    "food": ["即食螺蛳粉", "精品咖啡", "有机燕麦", "坚果礼盒", "低糖饼干"],
    "snack": ["辣片", "冻干水果", "肉脯", "海苔卷", "巧克力"],
    "home": ["收纳箱", "懒人沙发", "香薰机", "四件套", "地毯"],
    "furniture": ["人体工学椅", "升降桌", "落地灯", "鞋柜", "穿衣镜"],
    "kitchen": ["不粘锅", "破壁机", "保温杯", "切菜神器", "密封罐"],
    "sports": ["跑鞋", "瑜伽垫", "跳绳", "运动水壶", "护膝"],
    "fitness": ["哑铃", "筋膜枪", "阻力带", "运动手环", "蛋白粉"],
    "jewelry": ["珍珠项链", "银饰手镯", "对戒", "耳钉", "胸针"],
    "accessories": ["太阳镜", "皮带", "围巾", "帽子", "手表"],
    "baby": ["婴儿湿巾", "辅食机", "爬行垫", "奶瓶", "睡袋"],
    "pet": ["猫粮", "宠物零食", "猫砂", "牵引绳", "宠物玩具"],
    "automotive": ["车载香薰", "手机支架", "行车记录仪", "脚垫", "吸尘器"],
    "office": ["笔记本支架", "静音鼠标", "文件收纳", "白板笔", "台灯"],
    "health": ["蛋白棒", "褪黑素", "护颈枕", "艾灸贴", "足浴包"],
    "outdoor": ["帐篷", "睡袋", "露营灯", "折叠椅", "登山杖"],
    "travel": ["行李箱", "洗漱包", "颈枕", "转换插头", "收纳袋"],
    "books": ["畅销小说", "考研资料", "儿童绘本", "手账", "日历"],
    "virtual": ["剪辑课程", "电商运营课", "AI工具课", "设计模板包", "会员订阅"],
}


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def catalog_path() -> Path:
    settings = get_settings()
    p = Path(settings.template_catalog_path)
    if not p.is_absolute():
        p = _project_root() / p
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _media_urls(media_key: str) -> tuple[str, str]:
    return f"/templates/{media_key}.mp4", f"/templates/{media_key}.jpg"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slug(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:10]


def _load_raw() -> dict:
    path = catalog_path()
    if not path.is_file():
        return {"version": 1, "updated_at": _now_iso(), "templates": []}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _save_raw(data: dict) -> None:
    data["updated_at"] = _now_iso()
    path = catalog_path()
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


def _build_entry(
    *,
    category: str,
    product: str,
    style_key: str,
    style_name: str,
    style_desc: str,
    source: str = "bootstrap",
) -> dict:
    media_key, cat_label = CATEGORY_DEFS[category]
    preview, cover = _media_urls(media_key)
    title = f"{product}{style_name}"
    hook = f"还在纠结选哪款{product}？这条视频告诉你答案！"
    selling = [
        f"核心卖点：{product}差异化优势",
        "真实使用场景演示",
        "适合短视频口播带货",
    ]
    shot_plan = [
        f"镜1 钩子：{hook}",
        f"镜2 展示：{product}特写与材质/功能亮点",
        f"镜3 体验：{style_desc}，解决用户痛点",
        f"镜4 CTA：限时优惠引导下单",
    ]
    prompt = (
        f"电商带货短视频模板（{cat_label}/{style_name}）。"
        f"商品：{product}。{style_desc}。"
        f"四镜AIDA结构，9:16竖屏，口播清晰，适合TikTok Shop。"
    )
    tid = f"tpl-{_slug(f'{category}-{product}-{style_key}')}"
    return {
        "id": tid,
        "title": title,
        "category": category,
        "category_label": cat_label,
        "prompt": prompt,
        "hook": hook,
        "selling_points": selling,
        "shot_plan": shot_plan,
        "cta": "点击下方链接，限时优惠马上抢！",
        "duration": 20 if style_key != "promo" else 15,
        "ratio": "9:16",
        "video_mode": category,
        "preview_video": preview,
        "cover_image": cover,
        "tags": [cat_label, style_name, product],
        "source": source,
        "is_new": False,
        "created_at": _now_iso(),
    }


def bootstrap_catalog(min_count: int = 100) -> int:
    """矩阵生成不重复模板，保证至少 min_count 条。"""
    with _lock:
        data = _load_raw()
        existing_titles = {t["title"] for t in data.get("templates", [])}
        added = 0
        templates: list[dict] = list(data.get("templates", []))

        for cat in CATEGORY_DEFS:
            products = PRODUCT_SAMPLES.get(cat, ["爆款商品"])
            for style_key, style_name, style_desc in STYLE_DEFS:
                for product in products:
                    entry = _build_entry(
                        category=cat,
                        product=product,
                        style_key=style_key,
                        style_name=style_name,
                        style_desc=style_desc,
                    )
                    if entry["title"] in existing_titles:
                        continue
                    existing_titles.add(entry["title"])
                    templates.append(entry)
                    added += 1

        data["templates"] = templates
        _save_raw(data)
        total = len(templates)
        if total < min_count:
            # 追加变体直到达标
            idx = 0
            while total < min_count:
                cat = list(CATEGORY_DEFS.keys())[idx % len(CATEGORY_DEFS)]
                product = PRODUCT_SAMPLES[cat][idx % len(PRODUCT_SAMPLES[cat])]
                style_key, style_name, style_desc = STYLE_DEFS[idx % len(STYLE_DEFS)]
                variant = f"{product}·系列{idx // len(STYLE_DEFS) + 1}"
                entry = _build_entry(
                    category=cat,
                    product=variant,
                    style_key=style_key,
                    style_name=style_name,
                    style_desc=style_desc,
                )
                if entry["title"] not in existing_titles:
                    existing_titles.add(entry["title"])
                    templates.append(entry)
                    total += 1
                    added += 1
                idx += 1
            data["templates"] = templates
            _save_raw(data)
        return added


def ensure_catalog(min_count: int | None = None) -> None:
    settings = get_settings()
    target = min_count or settings.template_catalog_min_count
    with _lock:
        data = _load_raw()
        if len(data.get("templates", [])) < target:
            bootstrap_catalog(target)


def list_templates(
    *,
    limit: int = 48,
    offset: int = 0,
    category: str | None = None,
) -> tuple[list[dict], int]:
    ensure_catalog()
    with _lock:
        items = list(_load_raw().get("templates", []))
    if category:
        items = [t for t in items if t.get("category") == category]
    total = len(items)
    return items[offset : offset + limit], total


def get_stats() -> dict:
    settings = get_settings()
    ensure_catalog()
    with _lock:
        templates = _load_raw().get("templates", [])
    cat_counts: dict[str, int] = {}
    for t in templates:
        c = t.get("category", "other")
        cat_counts[c] = cat_counts.get(c, 0) + 1
    categories = []
    for cid, (key, label) in CATEGORY_DEFS.items():
        count = cat_counts.get(cid, 0)
        if count <= 0:
            continue
        preview, cover = _media_urls(key)
        categories.append(
            {
                "id": cid,
                "label": label,
                "count": count,
                "preview_video": preview,
                "cover_image": cover,
            }
        )
    meta_path = catalog_path().with_name("expand_meta.json")
    last_at = None
    if meta_path.is_file():
        try:
            last_at = json.loads(meta_path.read_text(encoding="utf-8")).get("last_expanded_at")
        except json.JSONDecodeError:
            pass
    stats = {
        "total": len(templates),
        "target": settings.template_expand_target,
        "expanding": settings.template_expand_enabled,
        "last_expanded_at": last_at,
        "categories": categories,
    }
    try:
        from app.services.template_video_gen import count_video_progress

        stats.update(count_video_progress())
    except Exception:
        pass
    return stats


def _title_exists(title: str) -> bool:
    with _lock:
        for t in _load_raw().get("templates", []):
            if t.get("title") == title:
                return True
    return False


def add_templates(entries: list[dict]) -> int:
    if not entries:
        return 0
    with _lock:
        data = _load_raw()
        templates = list(data.get("templates", []))
        existing = {t["title"] for t in templates}
        added = 0
        for raw in entries:
            title = raw.get("title", "")
            if not title or title in existing:
                continue
            cat = raw.get("category", "fashion")
            media_key, cat_label = CATEGORY_DEFS.get(cat, ("clothes", "综合"))
            preview, cover = _media_urls(raw.get("media_key") or media_key)
            entry = {
                "id": raw.get("id") or f"tpl-{uuid.uuid4().hex[:10]}",
                "title": title,
                "category": cat,
                "category_label": raw.get("category_label") or cat_label,
                "prompt": raw.get("prompt", ""),
                "hook": raw.get("hook", ""),
                "selling_points": raw.get("selling_points") or [],
                "shot_plan": raw.get("shot_plan") or [],
                "cta": raw.get("cta", ""),
                "duration": int(raw.get("duration") or 20),
                "ratio": raw.get("ratio") or "9:16",
                "video_mode": raw.get("video_mode") or cat,
                "preview_video": raw.get("preview_video") or preview,
                "cover_image": raw.get("cover_image") or cover,
                "tags": raw.get("tags") or [],
                "source": raw.get("source") or "seed_llm",
                "is_new": bool(raw.get("is_new", True)),
                "created_at": _now_iso(),
            }
            templates.append(entry)
            existing.add(title)
            added += 1
        data["templates"] = templates
        _save_raw(data)
    return added


def update_template_media(tpl_id: str, preview_video: str, cover_image: str | None = None) -> bool:
    with _lock:
        data = _load_raw()
        templates = data.get("templates", [])
        updated = False
        for t in templates:
            if t.get("id") == tpl_id:
                t["preview_video"] = preview_video
                if cover_image:
                    t["cover_image"] = cover_image
                updated = True
                break
        if updated:
            data["templates"] = templates
            _save_raw(data)
        return updated


def mark_expanded() -> None:
    meta_path = catalog_path().with_name("expand_meta.json")
    meta_path.write_text(
        json.dumps({"last_expanded_at": _now_iso()}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
