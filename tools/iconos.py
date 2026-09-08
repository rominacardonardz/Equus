#!/usr/bin/env python3
"""Genera los iconos de la app a partir de assets/logo.png.

Si no existe el logo, dibuja el monograma E. Correr después de subir el logo:

    python3 tools/iconos.py
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
AZUL = (27, 58, 95, 255)
ORO = (201, 162, 39, 255)
SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
LOGO = RAIZ / "assets" / "logo.png"


def icono(n, radio_frac, destino):
    S = 4
    N = n * S
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(N * radio_frac)
    if r:
        d.rounded_rectangle([0, 0, N - 1, N - 1], radius=r, fill=AZUL)
    else:
        d.rectangle([0, 0, N - 1, N - 1], fill=AZUL)

    if LOGO.exists():
        # El logo, aclarado a oro y centrado con margen de seguridad.
        marca = Image.open(LOGO).convert("RGBA")
        caja = int(N * (0.68 if radio_frac else 0.52))
        marca.thumbnail((caja, caja), Image.LANCZOS)
        tinta = Image.new("RGBA", marca.size, ORO)
        # el trazo oscuro del logo se vuelve máscara
        alfa = marca.split()[3].point(lambda a: a)
        gris = marca.convert("L").point(lambda v: 255 - v)
        mascara = Image.new("L", marca.size)
        mascara.paste(gris, mask=alfa)
        img.paste(tinta, ((N - marca.width) // 2, (N - marca.height) // 2), mascara)
    else:
        tam = int(N * (0.58 if radio_frac else 0.44))
        f = ImageFont.truetype(SERIF, tam)
        x0, y0, x1, y1 = d.textbbox((0, 0), "E", font=f)
        d.text(((N - (x1 - x0)) / 2 - x0, (N - (y1 - y0)) / 2 - y0), "E", font=f, fill=ORO)

    img.resize((n, n), Image.LANCZOS).save(destino)
    print(f"  {destino.relative_to(RAIZ)}{'  (desde el logo)' if LOGO.exists() else '  (monograma)'}")


for n, rf, nombre in [(192, 0.22, "icono-192.png"), (512, 0.22, "icono-512.png"),
                      (512, 0.00, "icono-maskable.png")]:
    icono(n, rf, RAIZ / "assets" / nombre)
