#!/usr/bin/env python3
"""Genera las versiones de archivo único, para publicarlas como Artifact.

Los sitios del repositorio son la fuente de verdad. Este script arma, para
cada uno, un archivo con el CSS y el JS incrustados y sin el esqueleto
<!doctype>/<html>/<head>/<body>, que el servicio de Artifacts agrega por su
cuenta. Correr después de cualquier cambio:

    python3 tools/build-artifact.py
"""
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SITIOS = [
    ("index.html",                "dist/equus-app.html"),
    ("especificacion/index.html", "dist/equus-especificacion.html"),
]


def construir(origen: pathlib.Path, destino: pathlib.Path) -> None:
    html = origen.read_text(encoding="utf-8")
    base = origen.parent

    titulo = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
    cabeza = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    cuerpo = re.search(r"<body>(.*)</body>", html, re.S).group(1).strip()

    # De la cabeza sobreviven las tipografías y los estilos propios; el resto
    # (charset, viewport, favicon) lo pone el servicio.
    piezas = re.findall(r'<link rel="(?:preconnect|stylesheet)"[^>]*fonts\.g[^>]*>', cabeza)
    piezas += re.findall(r"<style>.*?</style>", cabeza, re.S)

    # Hojas y guiones externos: se incrustan y se quita la etiqueta original.
    for href in re.findall(r'<link rel="stylesheet" href="((?!http)[^"]+)"', cabeza):
        piezas.append("<style>\n" + (base / href).read_text(encoding="utf-8") + "\n</style>")
    for src in re.findall(r'<script src="((?!http)[^"]+)"></script>', cuerpo):
        codigo = (base / src).read_text(encoding="utf-8")
        cuerpo = cuerpo.replace(f'<script src="{src}"></script>', f"<script>\n{codigo}\n</script>")

    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(
        f"<title>{titulo}</title>\n" + "\n".join(piezas) + "\n\n" + cuerpo + "\n",
        encoding="utf-8",
    )
    print(f"{destino.relative_to(RAIZ)} — {destino.stat().st_size:,} bytes")


for origen, destino in SITIOS:
    construir(RAIZ / origen, RAIZ / destino)
