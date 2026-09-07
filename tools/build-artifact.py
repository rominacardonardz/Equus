#!/usr/bin/env python3
"""Genera la versión de archivo único del sitio, para publicarla como Artifact.

El sitio del repositorio (index.html + assets/) es la fuente de verdad.
Este script incrusta el CSS y el JS en un solo archivo y quita el esqueleto
<!doctype>/<html>/<head>/<body>, que el servicio de Artifacts agrega por su
cuenta. Correr después de cualquier cambio en index.html o assets/:

    python3 tools/build-artifact.py
"""
import pathlib
import re

raiz    = pathlib.Path(__file__).resolve().parent.parent
html    = (raiz / "index.html").read_text(encoding="utf-8")
css     = (raiz / "assets/css/styles.css").read_text(encoding="utf-8")
js      = (raiz / "assets/js/main.js").read_text(encoding="utf-8")
destino = raiz / "dist/casa-quiron.html"

titulo = re.search(r"<title>(.*?)</title>", html, re.S).group(1).strip()
cuerpo = re.search(r"<body>(.*)</body>", html, re.S).group(1).strip()

# El <link> a la hoja de estilo local sobra: el CSS va incrustado.
cuerpo = cuerpo.replace('<script src="assets/js/main.js"></script>', "").strip()

destino.parent.mkdir(exist_ok=True)
destino.write_text(
    f"""<title>{titulo}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap">
<style>
{css}
</style>

{cuerpo}

<script>
{js}
</script>
""",
    encoding="utf-8",
)

print(f"{destino.relative_to(raiz)} — {destino.stat().st_size:,} bytes")
