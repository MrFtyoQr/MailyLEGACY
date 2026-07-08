#!/usr/bin/env python3
"""Copia insignias de logro, quita fondo negro y las guarda por código de badge."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = Path(
    '/Users/madelinequintana/.cursor/projects/'
    'Users-madelinequintana-Desktop-MailyT-CuidaLEGACY/assets'
)
OUT_DIR = ROOT / 'assets' / 'images' / 'badges'
THRESHOLD = 28

# archivo fuente (prefijo) → código backend
FILE_TO_CODE = {
    'DOSIS_1':              'ADHERENCE_1',
    'DOSIS_10':             'ADHERENCE_10',
    'DOSIS_50':             'ADHERENCE_50',
    'DOSIS_100':            'ADHERENCE_100',
    'DOSIS_500':            'ADHERENCE_500',
    'RACHA_7':              'STREAK_7',
    'RACHA_14':             'STREAK_14',
    'RACHA_30':             'STREAK_30',
    'RACHA_60':             'STREAK_60',
    'RACHA_90':             'STREAK_90',
    'VITALS_5':             'VITALS_5',
    'VITALS_20':            'VITALS_20',
    'VITALS_50':            'VITALS_50',
    '500_PTS':              'POINTS_500',
    '1000_PTS':             'POINTS_1000',
    '5000_PTS':             'POINTS_5000',
    '10000_PTS':            'POINTS_10000',
    'PRIMER_ESPECIALISTA':  'REFERRAL_1',
    'RED_ESPECIALISTAS':    'REFERRAL_5',
}


def is_bg(r: int, g: int, b: int, a: int = 255) -> bool:
    return a > 0 and max(r, g, b) <= THRESHOLD


def remove_black_bg(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, a = px[x, y]
        if is_bg(r, g, b, a):
            visited[idx] = 1
            q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        if x > 0:
            push(x - 1, y)
        if x < w - 1:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y < h - 1:
            push(x, y + 1)

    return im


def find_source(prefix: str) -> Path:
    matches = sorted(SRC_DIR.glob(f'{prefix}*.png'))
    if not matches:
        raise FileNotFoundError(f'No se encontró imagen para {prefix}')
    return matches[0]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for prefix, code in FILE_TO_CODE.items():
        src = find_source(prefix)
        out = OUT_DIR / f'{code.lower()}.png'
        img = remove_black_bg(Image.open(src))
        img.save(out, 'PNG')
        print(f'✓ {code} ← {src.name}')


if __name__ == '__main__':
    main()
