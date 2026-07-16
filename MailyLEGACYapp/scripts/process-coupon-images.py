#!/usr/bin/env python3
"""Quita el fondo negro de los cupones y los guarda como PNG con transparencia."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
COUPON_DIR = ROOT / 'assets' / 'images' / 'coupons'
PADDING = 8


def is_removable(r: int, g: int, b: int) -> bool:
    peak = max(r, g, b)
    avg = (r + g + b) / 3
    if peak <= 45:
        return True
    # Halos oscuros del JPEG original sobre fondo negro.
    return peak <= 95 and avg <= 44


def remove_black_bg(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and is_removable(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    return im


def crop_to_content(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    left, top, right, bottom = bbox
    left = max(0, left - PADDING)
    top = max(0, top - PADDING)
    right = min(im.width, right + PADDING)
    bottom = min(im.height, bottom + PADDING)
    return im.crop((left, top, right, bottom))


def main() -> None:
    for src in sorted(COUPON_DIR.glob('coupon-*.png')):
        img = crop_to_content(remove_black_bg(Image.open(src)))
        img.save(src, 'PNG')
        print(f'✓ {src.name} → {img.width}x{img.height}')


if __name__ == '__main__':
    main()
