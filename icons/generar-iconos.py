# -*- coding: utf-8 -*-
"""Regenera los favicons y los iconos instalables desde los SVG de marca.

Requiere: pip install svglib rlPyCairo pillow
Ejecutar desde la raiz: python icons/generar-iconos.py
"""
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.graphics import renderPM
from svglib.svglib import svg2rlg

ICONS = Path(__file__).resolve().parent
ROOT = ICONS.parent
SIZE = 2048


def render(svg):
    drawing = svg2rlg(str(svg))
    scale = SIZE / drawing.width
    drawing.width *= scale
    drawing.height *= scale
    drawing.scale(scale, scale)
    return Image.open(BytesIO(renderPM.drawToString(drawing, fmt="PNG"))).convert("RGBA")


brand = render(ICONS / "favicon.svg")
# renderPM entrega fondo opaco; la mascara restituye las esquinas del SVG.
alpha = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(alpha).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=SIZE // 5, fill=255)
brand.putalpha(alpha)
maskable = render(ICONS / "logo-filtro-maskable.svg")


def save(image, file, size):
    image.resize((size, size), Image.Resampling.LANCZOS).save(file, "PNG", optimize=True)
    print(file.relative_to(ROOT), size)


save(brand, ROOT / "favicon.png", 192)
save(brand, ICONS / "logo-filtro-180.png", 180)
save(brand, ICONS / "logo-filtro-192.png", 192)
save(brand, ICONS / "logo-filtro-512.png", 512)
save(maskable, ICONS / "logo-filtro-maskable-512.png", 512)
brand.save(ROOT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("favicon.ico", "16, 32, 48, 64")