"""Generate poster images for template cards using PIL."""
import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../../frontend/public/templates")
os.makedirs(OUTPUT_DIR, exist_ok=True)

TEMPLATES = [
    ("clothes", "Fashion", "#8B5CF6", "#1E1B4B"),
    ("cosmetics", "Beauty", "#EC4899", "#4C0519"),
    ("electronics", "3C Tech", "#3B82F6", "#172554"),
    ("food", "Food", "#F59E0B", "#451A03"),
    ("home", "Home", "#10B981", "#064E3B"),
    ("sports", "Sports", "#EF4444", "#7F1D1D"),
    ("jewelry", "Jewelry", "#F59E0B", "#78350F"),
]

def create_poster(name, label, color1, color2, path):
    width, height = 400, 533
    img = Image.new('RGB', (width, height), color2)
    draw = ImageDraw.Draw(img)

    # Gradient-like effect with rectangles
    for i in range(height):
        ratio = i / height
        r = int(int(color1[1:3], 16) * (1 - ratio) + int(color2[1:3], 16) * ratio)
        g = int(int(color1[3:5], 16) * (1 - ratio) + int(color2[3:5], 16) * ratio)
        b = int(int(color1[5:7], 16) * (1 - ratio) + int(color2[5:7], 16) * ratio)
        draw.line([(0, i), (width, i)], fill=(r, g, b))

    # Try to load a font, fallback to default
    try:
        font_large = ImageFont.truetype("arial.ttf", 36)
        font_small = ImageFont.truetype("arial.ttf", 20)
    except:
        font_large = ImageFont.load_default()
        font_small = font_large

    # Draw text
    text = label
    bbox = draw.textbbox((0, 0), text, font=font_large)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (width - text_w) // 2
    y = (height - text_h) // 2 - 20
    draw.text((x, y), text, fill="white", font=font_large)

    sub = "Template"
    bbox2 = draw.textbbox((0, 0), sub, font=font_small)
    text_w2 = bbox2[2] - bbox2[0]
    x2 = (width - text_w2) // 2
    draw.text((x2, y + text_h + 15), sub, fill="rgba(255,255,255,180)", font=font_small)

    img.save(path, quality=85)
    print(f"Created {path}")

if __name__ == "__main__":
    for tid, label, c1, c2 in TEMPLATES:
        path = os.path.join(OUTPUT_DIR, f"{tid}.jpg")
        create_poster(tid, label, c1, c2, path)
    print("Done.")
