"""Generate 7 e-commerce template videos using Seedance API."""
import os
import sys
import requests

# Add parent to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import get_settings
from app.utils.seedance_client import get_seedance_client

settings = get_settings()
client = get_seedance_client()

OUTPUT_DIR = "D:/FILE/ShopShot/frontend/public/templates"
os.makedirs(OUTPUT_DIR, exist_ok=True)

TEMPLATES = [
    {
        "id": "clothes",
        "prompt": "A stylish young model wearing a trendy oversized hoodie, walking confidently in an urban street setting. Dynamic camera movement, soft natural lighting, cinematic fashion showcase. The clothing fabric texture is clearly visible with smooth flowing motion.",
    },
    {
        "id": "cosmetics",
        "prompt": "Close-up of an elegant perfume bottle on a marble vanity, golden liquid shimmering inside. A woman's hand gracefully picks it up. Soft bokeh background, luxurious beauty product showcase, warm studio lighting.",
    },
    {
        "id": "electronics",
        "prompt": "A sleek ultrawide monitor displaying vibrant colorful content, rotating slowly on a minimalist white desk. Modern tech product showcase, clean aesthetic, professional studio lighting with subtle reflections.",
    },
    {
        "id": "food",
        "prompt": "Delicious gourmet burger with melting cheese and fresh vegetables, steam rising slowly. Overhead rotating shot, appetizing food photography style, warm golden lighting, mouth-watering details.",
    },
    {
        "id": "home",
        "prompt": "Cozy modern living room with a plush velvet sofa, soft afternoon sunlight streaming through large windows. A hand gently touches the premium fabric. Warm homely atmosphere, lifestyle product showcase.",
    },
    {
        "id": "sports",
        "prompt": "Athletic running shoes in motion on a track, dynamic slow-motion shot showing cushioning technology. Energetic sports product showcase, outdoor stadium lighting, motivating and powerful atmosphere.",
    },
    {
        "id": "jewelry",
        "prompt": "Elegant diamond necklace on a black velvet display, sparkling under focused spotlight. Slow rotation showing intricate craftsmanship. Luxury jewelry showcase, dramatic lighting, premium feel.",
    },
]


def download_video(url: str, path: str):
    r = requests.get(url, stream=True)
    r.raise_for_status()
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"  Saved to {path} ({os.path.getsize(path)} bytes)")


def main():
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Using endpoint: {settings.doubao_seedance_ep}")

    for tpl in TEMPLATES:
        video_path = os.path.join(OUTPUT_DIR, f"{tpl['id']}.mp4")
        if os.path.exists(video_path) and os.path.getsize(video_path) > 10000:
            print(f"[{tpl['id']}] Already exists, skipping.")
            continue

        print(f"[{tpl['id']}] Generating: {tpl['prompt'][:60]}...")
        try:
            video_url = client.generate(prompt=tpl["prompt"], duration=5)
            print(f"[{tpl['id']}] Video URL: {video_url[:80]}...")
            download_video(video_url, video_path)
            print(f"[{tpl['id']}] Done!")
        except Exception as e:
            print(f"[{tpl['id']}] FAILED: {e}")

    print("\nAll templates processed.")


if __name__ == "__main__":
    main()
