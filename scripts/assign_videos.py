"""
批量为缺少预览视频的模板分配下载的视频文件。

用法：
  1. 把下载好的视频（.mp4）放到任意文件夹，比如 download_videos/
  2. 运行：python scripts/assign_videos.py download_videos/ --category home
     （不加 --category 则按顺序分配给所有缺视频的模板）

下载推荐来源：
  - https://www.pexels.com/videos/  （免费商用，搜索 home decor / furniture / jewelry 等）
  - https://pixabay.com/videos/

脚本会：
  - 把视频复制到 frontend/public/templates/generated/tpl-{id}.mp4
  - 更新 data/templates/catalog.json 中对应模板的 preview_video 字段
"""

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED_DIR = ROOT / "frontend" / "public" / "templates" / "generated"
CATALOG_PATH = ROOT / "data" / "templates" / "catalog.json"

GENERATED_PREFIX = "/templates/generated/"


def load_catalog() -> dict:
    with open(CATALOG_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_catalog(data: dict) -> None:
    tmp = CATALOG_PATH.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(CATALOG_PATH)


def file_exists_for(t: dict) -> bool:
    pv = t.get("preview_video", "")
    if not pv.startswith(GENERATED_PREFIX):
        return False
    return (GENERATED_DIR / pv.removeprefix(GENERATED_PREFIX)).is_file()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="分配下载视频到模板")
    parser.add_argument("source_dir", help="存放下载视频的文件夹路径")
    parser.add_argument("--category", default="", help="只分配给该类目（如 home / sports / jewelry）")
    parser.add_argument("--dry-run", action="store_true", help="只预览，不实际复制/修改")
    args = parser.parse_args()

    source = Path(args.source_dir)
    if not source.is_dir():
        print(f"错误：找不到文件夹 {source}")
        sys.exit(1)

    # 收集视频文件
    videos = sorted(p for p in source.iterdir() if p.suffix.lower() in (".mp4", ".mov", ".webm"))
    if not videos:
        print(f"错误：{source} 中没有 .mp4 / .mov / .webm 文件")
        sys.exit(1)
    print(f"找到 {len(videos)} 个视频文件")

    # 找缺少视频的模板
    data = load_catalog()
    templates = data.get("templates", [])

    missing = [
        t for t in templates
        if not file_exists_for(t)
        and (not args.category or t.get("category") == args.category)
    ]
    print(f"找到 {len(missing)} 个缺少视频的模板" + (f"（类目：{args.category}）" if args.category else ""))

    if not missing:
        print("所有模板都已有视频，无需分配。")
        return

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    assigned = 0
    for tpl, video in zip(missing, videos):
        dest_name = f"{tpl['id']}.mp4"
        dest_path = GENERATED_DIR / dest_name
        new_url = f"{GENERATED_PREFIX}{dest_name}"

        print(f"  {'[预览]' if args.dry_run else '[复制]'} {video.name}  →  {dest_name}  ({tpl['title']})")
        if not args.dry_run:
            shutil.copy2(video, dest_path)
            tpl["preview_video"] = new_url
        assigned += 1

    if not args.dry_run:
        save_catalog(data)
        print(f"\n完成！已分配 {assigned} 个视频，catalog.json 已更新。")
        print("刷新浏览器即可看到效果。")
    else:
        print(f"\n[预览模式] 将分配 {assigned} 个视频（未实际执行）。去掉 --dry-run 后运行即生效。")

    remaining = len(missing) - assigned
    if remaining > 0:
        print(f"\n还剩 {remaining} 个模板没有视频（视频文件不够），可继续下载后重新运行。")


if __name__ == "__main__":
    main()
