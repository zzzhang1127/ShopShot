"""持续为带货模板生成独立的预览视频（调用 Seedance API）。可单独运行或随后端 lifespan 自动运行。"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings
from app.services.template_video_gen import get_pending_template, generate_video_for_template


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate preview videos for templates using Seedance")
    parser.add_argument("--once", action="store_true", help="Run one generation and exit")
    parser.add_argument("--loop", action="store_true", help="Loop until all templates have videos")
    args = parser.parse_args()

    settings = get_settings()
    
    if not settings.volc_api_key or not settings.doubao_seedance_ep:
        print("[Error] VOLC_API_KEY or DOUBAO_SEEDANCE_EP is not configured.")
        return

    def run_one() -> bool:
        tpl = get_pending_template()
        if not tpl:
            print("[templates] All templates have generated videos.")
            return False
        
        print(f"[templates] Generating video for: {tpl['title']}")
        success = generate_video_for_template(tpl)
        if success:
            print(f"[templates] Success: {tpl['title']}")
        else:
            print(f"[templates] Failed: {tpl['title']}")
        return True

    if args.once or not args.loop:
        run_one()
        return

    interval = settings.template_video_gen_interval_seconds
    print(f"[templates] Loop mode, interval={interval}s")
    while True:
        has_more = run_one()
        if not has_more:
            print(f"[templates] Sleeping for {interval}s...")
        time.sleep(interval)


if __name__ == "__main__":
    main()
