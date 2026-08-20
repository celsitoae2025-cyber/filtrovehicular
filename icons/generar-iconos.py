# -*- coding: utf-8 -*-
"""Escribe icons/favicon.svg y saca de él todos los tamaños.

Se corre a mano cuando cambie el icono:

    python icons/generar-iconos.py

Necesita svglib, rlPyCairo y Pillow (pip install svglib rlPyCairo pillow).

El aro se calcula aquí y se escribe como cuatro arcos explícitos. Se
intentó antes con un patrón de trazo (stroke-dasharray) sobre cuatro
círculos, que es más corto de escribir, y salió mal: los rasterizadores
que no soportan stroke-dashoffset pintaban los cuatro tramos encima del
mismo sitio y el icono acababa con un solo arco rojo. Un arco explícito
lo dibuja igual todo el mundo.
"""
import math
import os
import subprocess
import sys

DEST_ICONS = r"C:\Users\MAGIC\Desktop\FV+\icons"
DEST_RAIZ = r"C:\Users\MAGIC\Desktop\FV+"
SVG = os.path.join(DEST_ICONS, "favicon.svg")

CX = CY = 512.0
R = 460.0            # radio del centro del trazo
GROSOR = 86.0
HUECO = 5.0          # grados de aire a cada lado de cada tramo

COLORES = [("#00bcd4", -90), ("#8fc72e", 0), ("#ffb020", 90), ("#e53935", 180)]

# El coche de la pestaña de Vehículos: el símbolo #i-car de app.html, tal
# cual. Su lienzo mide 29700 × 21000.
COCHE = ("M20425.98 11038.24c341.57,-146.2 2730.56,-160.66 3183.85,-56.93 958.5,219.37 1069.83,1539.18 "
         "146.23,1917.77 -338.96,138.94 -2817.1,144.87 -3216.82,52.04 -932.75,-216.64 -1166.18,-1462.2 "
         "-113.26,-1912.88zm-14370.33 -37.54c308.15,-101.87 2860.38,-103.59 3223.02,6.17 957.02,289.71 "
         "906.7,1638.01 -10.02,1922.19 -332.44,103.06 -2894.9,103.12 -3223.23,-1.81 -933.34,-298.29 "
         "-949.52,-1609.32 10.23,-1926.55zm2546.65 -7326.97l12510.13 34.5 1986.58 5430.43 -16441.69 "
         "-9.31 1944.98 -5455.62zm-3724.76 3582.03c-439.59,-723.34 150.31,-763.43 -1826.92,-760.08 "
         "-964.67,1.63 -1736.71,-255.64 -1964.09,640.92 -645.68,2546 1394.59,1963.2 3113.63,1963.2 "
         "-643.72,741.22 -916.26,257.37 -908.7,2061.04l27.64 7978.11c108.5,387.46 76.92,231.23 "
         "296.44,370.94 363.87,251.06 3381.62,249.87 3748.41,1.32 744.23,-487.36 23.71,-2158.45 "
         "388.41,-3526.89l14221.04 0c155.1,581.97 66.6,1286.42 65.31,1897.09 -2.12,1016.92 "
         "-146.32,1322.42 323.1,1629.8 366.78,248.55 3384.51,249.74 3748.4,-1.32 243.98,-155.29 "
         "236.88,-27.22 312.82,-457.96l11.88 -8000.67c3.2,-809.6 51.83,-1136.45 -522.93,-1616.56l-386.38 "
         "-334.9c2295.24,0 3260.4,436.09 3192.51,-1401.44 -58.76,-1591.03 -824.96,-1191.25 "
         "-2478.51,-1205.11 -1306.2,-10.93 -918.99,-21.01 -1390.53,761.65 -2566.55,-7035.74 "
         "-926.3,-5881.23 -9986.19,-5881.23 -7997.72,0 -7622.39,-716.4 -8941.32,3014.5 -337.35,954.29 "
         "-711.73,1951.37 -1044.02,2867.59z")

COCHE_ANCHO = 430.0                       # lo que ocupa el coche en el icono
ESC = COCHE_ANCHO / 29700.0
COCHE_X = CX - COCHE_ANCHO / 2.0
COCHE_Y = CY - (21000.0 * ESC) / 2.0


def punto(grados):
    r = math.radians(grados)
    return CX + R * math.cos(r), CY + R * math.sin(r)


def arco(desde, hasta):
    x1, y1 = punto(desde)
    x2, y2 = punto(hasta)
    grande = 1 if (hasta - desde) % 360 > 180 else 0
    return "M %.2f %.2f A %.0f %.0f 0 %d 1 %.2f %.2f" % (x1, y1, R, R, grande, x2, y2)


tramos = "\n".join(
    '    <path d="%s" stroke="%s"/>' % (arco(ini + HUECO, ini + 90 - HUECO), color)
    for color, ini in COLORES
)

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">
  <!-- ============================================================
       Icono de marca — Filtro Vehicular+

       Un disco oscuro con el aro de los cuatro colores de la casa y,
       dentro, el mismo coche que la aplicación usa en la pestaña de
       Vehículos (el símbolo #i-car de app.html). No es un dibujo nuevo a
       propósito: el icono del navegador y el de dentro tienen que ser el
       mismo, o son dos marcas.

       Los colores del aro son los de la línea que va bajo el nombre en
       la pantalla de acceso —turquesa, verde, ámbar y rojo—, en ese
       orden y empezando arriba. A 16 px el coche se difumina, pero el
       aro sigue reconociéndose: es lo que distingue esta pestaña de las
       otras veinte que tenga abiertas el cliente.

       Los cuatro tramos van como arcos explícitos. Con un patrón de
       trazo salía más corto, pero los rasterizadores que no entienden
       stroke-dashoffset pintaban los cuatro en el mismo sitio y el icono
       acababa con un solo arco rojo.

       Este archivo lo escribe un guion; no se edita a mano.
  ============================================================ -->

  <rect x="0" y="0" width="1024" height="1024" rx="512" ry="512" fill="#141d1c"/>

  <g fill="none" stroke-width="%d" stroke-linecap="butt">
%s
  </g>

  <g transform="translate(%.2f %.2f) scale(%.6f)">
    <path fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd" d="%s"/>
  </g>
</svg>
''' % (int(GROSOR), tramos, COCHE_X, COCHE_Y, ESC, COCHE)

with open(SVG, "w", encoding="utf-8", newline="\n") as f:
    f.write(svg)
print("svg escrito:", SVG)

# ------------------------------------------------------------ rasterizado
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPM
from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
dib = svg2rlg(SVG)
esc = 2048.0 / dib.width
dib.width *= esc
dib.height *= esc
dib.scale(esc, esc)
renderPM.drawToFile(dib, os.path.join(BASE, "render.png"), fmt="PNG")

plano = Image.open(os.path.join(BASE, "render.png")).convert("RGB")

# El renderizador no guarda transparencia: el disco se recorta a mano con
# una máscara circular, que es exactamente el borde del icono.
mascara = Image.new("L", plano.size, 0)
from PIL import ImageDraw
ImageDraw.Draw(mascara).ellipse([0, 0, plano.size[0] - 1, plano.size[1] - 1], fill=255)
base = plano.convert("RGBA")
base.putalpha(mascara)


def guardar(img, ruta, lado):
    img.resize((lado, lado), Image.LANCZOS).save(ruta, "PNG", optimize=True)
    print("  %-30s %4d px  %6d bytes" % (os.path.basename(ruta), lado, os.path.getsize(ruta)))


# Enmascarable: Android recorta un círculo, así que el dibujo entero tiene
# que caber dentro del 80% central y el resto va relleno del fondo.
mask = Image.new("RGBA", base.size, (20, 29, 28, 255))
chico = base.resize((int(base.size[0] * 0.76),) * 2, Image.LANCZOS)
salto = (base.size[0] - chico.size[0]) // 2
mask.paste(chico, (salto, salto), chico)

print("iconos:")
guardar(base, os.path.join(DEST_ICONS, "icon-192.png"), 192)
guardar(base, os.path.join(DEST_ICONS, "icon-512.png"), 512)
guardar(base, os.path.join(DEST_ICONS, "apple-touch-icon.png"), 180)
guardar(mask, os.path.join(DEST_ICONS, "icon-maskable-512.png"), 512)

ico = os.path.join(DEST_RAIZ, "favicon.ico")
base.resize((256, 256), Image.LANCZOS).save(
    ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("  %-30s          %6d bytes" % ("favicon.ico", os.path.getsize(ico)))

# Una tira para mirarlo a los tamaños de verdad.
tira = Image.new("RGBA", (560, 200), (242, 244, 243, 255))
x = 40
for t in (16, 32, 64, 128):
    tira.alpha_composite(base.resize((t, t), Image.LANCZOS), (x, 100 - t // 2))
    x += t + 40
tira.convert("RGB").save(os.path.join(BASE, "tira-final.png"))
base.resize((512, 512), Image.LANCZOS).convert("RGB").save(os.path.join(BASE, "vista-icono.png"))
