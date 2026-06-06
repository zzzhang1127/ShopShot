"""持续扩充带货模板目录（Seed LLM）。可单独运行或随后端 lifespan 自动运行。"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings
from app.services.template_catalog_service import bootstrap_catalog, ensure_catalog, get_stats
from app.services.template_expander import expand_once_via_seed


def main() -> None:
    parser = argparse.ArgumentParser(description="Expand ShopShot e-commerce template catalog")
    parser.add_argument("--bootstrap-only", action="store_true", help="Only matrix bootstrap to min count")
    parser.add_argument("--once", action="store_true", help="Run one Seed expansion batch")
    parser.add_argument("--loop", action="store_true", help="Loop until target reached")
    parser.add_argument("--min", type=int, default=None, help="Minimum catalog size for bootstrap")
    parser.add_argument("--target", type=int, default=None, help="Expansion target count")
    args = parser.parse_args()

    settings = get_settings()
    min_count = args.min or settings.template_catalog_min_count
    target = args.target or settings.template_expand_target

    print(f"[templates] catalog path: {settings.template_catalog_path}")
    ensure_catalog(min_count)
    added = bootstrap_catalog(min_count)
    stats = get_stats()
    print(f"[templates] bootstrap added {added}, total={stats['total']}")

    if args.bootstrap_only:
        return

    def run_batch() -> int:
        n = expand_once_via_seed()
        stats = get_stats()
        print(f"[templates] seed batch +{n}, total={stats['total']}/{target}")
        return stats["total"]

    if args.once or not args.loop:
        if stats["total"] < target:
            run_batch()
        return

    interval = settings.template_expand_interval_seconds
    print(f"[templates] loop mode, target={target}, interval={interval}s")
    while True:
        stats = get_stats()
        if stats["total"] >= target:
            print(f"[templates] target reached ({stats['total']}), sleeping...")
            time.sleep(interval)
            continue
        run_batch()
        time.sleep(interval)


if __name__ == "__main__":
    main()
