#!/usr/bin/env python3
"""Genera los iconos de la app y las versiones transparentes del logotipo.

Parte de assets/LOGO EQUUS.jpg (tinta cafe sobre fondo blanco) y produce:
  assets/logo.png        el logotipo completo, transparente, en su cafe original
  assets/logo-claro.png  el mismo recoloreado en dorado, para el modo oscuro
  assets/marca.png       solo la cabeza, para el encabezado donde ya va el nombre
                         (sin la linea del cuello: a 2 rem parecia un rayon)
  assets/marca-clara.png la cabeza en dorado, para el modo oscuro
  assets/icono-*.png     la cabeza del caballo en dorado sobre el azul del club

El alfa sale de la luminancia: entre BLANCO y NEGRO la tinta se vuelve opaca de
forma gradual, asi los bordes quedan suaves en lugar de dentados.
"""
from PIL import Image, ImageDraw
import pathlib

RAIZ   = pathlib.Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "assets" / "LOGO EQUUS.jpg"
SALIDA = RAIZ / "assets"

AZUL  = (27, 58, 95)
ORO   = (201, 162, 39)
CAFE  = (91, 60, 43)
CREMA = (226, 197, 126)

BLANCO = 225   # de aqui hacia arriba es papel: transparente
NEGRO  = 120   # de aqui hacia abajo es tinta: opaco


def alfa(gris):
    """Mascara de opacidad del trazo, con antialias en la transicion."""
    m = gris.point(lambda v: 0 if v >= BLANCO else
                   255 if v <= NEGRO else
                   int(round(255 * (BLANCO - v) / (BLANCO - NEGRO))))
    return m


def tenido(mascara, color):
    """La mascara pintada de un color plano, sobre fondo transparente."""
    im = Image.new("RGBA", mascara.size, color + (0,))
    im.putalpha(mascara)
    return im


def guardar(im, nombre, colores=64):
    """A paleta antes de escribir: son dibujos de una sola tinta, asi que 64
    tonos bastan y el archivo pesa una quinta parte del RGBA."""
    im.quantize(colors=colores, method=Image.FASTOCTREE).save(SALIDA / nombre, optimize=True)


def a_lo_ancho(im, ancho):
    """Deja la imagen a un ancho fijo: en pantalla nunca se ve mas grande, y
    asi el archivo unico del Artifact no carga peso de mas."""
    if im.width <= ancho:
        return im
    return im.resize((ancho, max(1, round(im.height * ancho / im.width))), Image.LANCZOS)


def recorte_util(mascara, margen=8):
    caja = mascara.getbbox()
    if not caja:
        return mascara
    x0, y0, x1, y1 = caja
    return mascara.crop((max(0, x0 - margen), max(0, y0 - margen),
                         min(mascara.width,  x1 + margen),
                         min(mascara.height, y1 + margen)))


def sin_motas(mascara, minimo=0.02):
    """Borra los trazos sueltos y pequenos: al recortar la cabeza se colaban las
    puntas de la E y la S de la palabra. Se queda con las piezas grandes."""
    ancho, alto = mascara.size
    px = mascara.load()
    visto = bytearray(ancho * alto)
    piezas = []
    for y0 in range(alto):
        for x0 in range(ancho):
            if visto[y0 * ancho + x0] or px[x0, y0] < 40:
                continue
            pila, pieza = [(x0, y0)], []
            visto[y0 * ancho + x0] = 1
            while pila:
                x, y = pila.pop()
                pieza.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < ancho and 0 <= ny < alto \
                           and not visto[ny * ancho + nx] and px[nx, ny] >= 40:
                            visto[ny * ancho + nx] = 1
                            pila.append((nx, ny))
            piezas.append(pieza)
    if not piezas:
        return mascara
    corte = max(len(p) for p in piezas) * minimo
    for pieza in piezas:
        if len(pieza) < corte:
            for x, y in pieza:
                px[x, y] = 0
    return mascara


def cuadro_redondeado(lado, radio, color):
    escala = 4
    g = Image.new("L", (lado * escala, lado * escala), 0)
    ImageDraw.Draw(g).rounded_rectangle(
        (0, 0, lado * escala - 1, lado * escala - 1), radius=radio * escala, fill=255)
    g = g.resize((lado, lado), Image.LANCZOS)
    fondo = Image.new("RGBA", (lado, lado), color + (255,))
    fondo.putalpha(g)
    return fondo


def icono(cabeza, lado, radio, ocupa):
    """La cabeza dorada centrada sobre el azul, en un cuadro redondeado."""
    base = cuadro_redondeado(lado, radio, AZUL)
    caja = int(lado * ocupa)
    esc  = min(caja / cabeza.width, caja / cabeza.height)
    marca = cabeza.resize((max(1, round(cabeza.width * esc)),
                           max(1, round(cabeza.height * esc))), Image.LANCZOS)
    base.alpha_composite(marca, ((lado - marca.width) // 2, (lado - marca.height) // 2))
    return base


def main():
    gris = Image.open(ORIGEN).convert("L")
    m = alfa(gris)

    # El logotipo completo, en sus dos tintas.
    completo = recorte_util(m)
    guardar(a_lo_ancho(tenido(completo, CAFE ), 560), "logo.png")
    guardar(a_lo_ancho(tenido(completo, CREMA), 560), "logo-claro.png")

    # Para el icono solo la cabeza: la palabra EQUUS no se lee a 192 px.
    # El renglon vacio del original separa la cabeza de la tipografia.
    cabeza = recorte_util(sin_motas(m.crop((0, 0, m.width, 486))), margen=6)
    corta = recorte_util(cabeza.crop((0, 0, 555, cabeza.height)), margen=4)
    guardar(a_lo_ancho(tenido(corta, CAFE ), 240), "marca.png")
    guardar(a_lo_ancho(tenido(corta, CREMA), 240), "marca-clara.png")
    cabeza = tenido(cabeza, ORO)

    for lado, nombre, radio, ocupa in [
            (192, "icono-192.png",      42, 0.78),
            (512, "icono-512.png",     112, 0.78),
            (512, "icono-maskable.png", 256, 0.56)]:   # el recorte circular come orillas
        guardar(icono(cabeza, lado, radio, ocupa), nombre)

    for f in ["logo.png", "logo-claro.png", "marca.png", "marca-clara.png", "icono-192.png", "icono-512.png",
              "icono-maskable.png"]:
        im = Image.open(SALIDA / f)
        print(f"{f:22} {im.size[0]}x{im.size[1]}  {(SALIDA / f).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
