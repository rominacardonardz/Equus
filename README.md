# Casa Quirón — Sistema de Reservas y Portal de Clientes

Sitio web de la **especificación funcional v2.0** (agosto 2026) del sistema de reservas
y portal de clientes de Casa Quirón. Convierte el documento entregado por dirección en
un sitio consultable desde el celular, con índice navegable, enlaces directos a cada
regla de negocio y versión imprimible.

## Contenido

El sitio reproduce íntegro el documento fuente:

| Sección | Tema |
|---|---|
| 01 | Objetivo y contexto · alcance y fuera de alcance |
| 02 | Perfiles de usuario y permisos (acumulativos) |
| 03 | Módulos funcionales M1–M12 |
| 04 | Reglas de negocio RN-01 a RN-20 |
| 05 | Modelo de datos sugerido |
| 06 | Pantallas por perfil |
| 07 | Fases de entrega |
| 08 | Requisitos técnicos |
| 09 | Decisiones cerradas por dirección |
| 10 | Supuestos por confirmar y criterio de aceptación |

## Estructura

```
index.html            Documento completo
assets/css/styles.css Estilos (mobile-first, modo claro/oscuro, hoja de impresión)
assets/js/main.js     Índice lateral, sección activa, barra de progreso
```

## Cómo verlo

Es un sitio estático sin dependencias ni compilación. Basta abrir `index.html`
en el navegador, o servirlo:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Se publica tal cual en GitHub Pages, Netlify o cualquier hosting estático.

## Criterios de diseño

- **Mobile-first**, igual que el sistema que especifica (§08).
- **Español de México** en toda la interfaz.
- Enlaces profundos a cada regla: `#rn-06`, `#rn-11`, y a cada módulo: `#m4`, `#m8`.
- Índice fijo en escritorio, cajón lateral en celular.
- Modo claro y oscuro según la preferencia del sistema.
- Hoja de impresión: al imprimir vuelve a leerse como el PDF original.

## Identidad visual

La paleta y la tipografía actuales son **provisionales** —verde de cuadra, latón y
hueso, con Cormorant Garamond e Inter— porque el manual de marca de Casa Quirón se
entrega al inicio del desarrollo (§08, *Identidad visual*). Al recibirlo basta
sustituir los tokens del bloque `:root` en `assets/css/styles.css`; ningún color está
escrito directamente en los componentes.

---

Documento interno para el equipo de desarrollo. Solicita: Romy Uresti Cardona — Dirección.
