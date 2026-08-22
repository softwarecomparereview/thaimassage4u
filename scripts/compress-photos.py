#!/usr/bin/env python3
"""Resize and recompress directory photography so the Worker assets stay lean."""
from pathlib import Path
from PIL import Image

root = Path("public/images")
max_px = 1400
quality = 72

for path in list(root.rglob("*.jpg")) + list(root.rglob("*.jpeg")) + list(root.rglob("*.png")):
    if path.name == "photo-credits.json":
        continue
    try:
        im = Image.open(path)
    except Exception as exc:
        print("skip", path, exc)
        continue
    im = im.convert("RGB")
    w, h = im.size
    if max(w, h) > max_px:
        im.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
    dest = path.with_suffix(".jpg")
    im.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
    if dest != path:
        path.unlink()
    print(f"{dest} {w}x{h} -> {im.size[0]}x{im.size[1]} {dest.stat().st_size // 1024}kb")
