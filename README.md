# Casa Quirón — Sistema de Reservas

App web del club: reserva de clases, reglamento y contratos, calendario de
competencias y recordatorios. Mobile-first, en español de México, sin
dependencias ni compilación.

```
index.html            La app
especificacion/       El documento fuente (especificación funcional v2.0) como sitio
tools/                Genera las versiones de archivo único de dist/
dist/                 Versiones de archivo único, para publicar como Artifact
```

## Qué hace la app

**Reservar.** Vista semanal con las clases que el nivel y el paquete del jinete
autorizan; lo demás se oculta. Se elige sesión y después caballo, solo entre los
que el entrenador habilitó y estén libres a esa hora. Al confirmar se descuenta
la clase y se muestra la hora exacta del límite de cancelación.

**Reglamento y contratos.** Cada perfil ve solo sus documentos. Los obligatorios
se firman escribiendo el nombre completo, y sin esa firma no se puede reservar.
Cada documento lleva versión: al publicar una nueva se vuelve a pedir la firma.

**Competencias.** Calendario con sede, disciplina, categorías y fecha de cierre.
El jinete se anota y el club ve cuántos van.

**Recordatorios.** Los propios, con fecha; y los automáticos que salen de las
reservas y del calendario — el límite de cancelación de cada clase, el cierre de
inscripciones, la apertura de la agenda del lunes.

## Reglas de negocio aplicadas

Las de la especificación (§04), calculadas siempre en la zona horaria del club:

| Clave | Regla |
|---|---|
| RN-01 | Cancelación sin costo hasta 10 horas antes; después la clase se cobra |
| RN-03 | No se reserva sin saldo; lo carga el administrador tras el cobro presencial |
| RN-04 | Solo caballos que el entrenador habilitó para ese alumno |
| RN-05 | El caballo debe ser compatible con el nivel del jinete |
| RN-06 | Máximo de clases por día por caballo; al llegar al tope desaparece |
| RN-08 | Un caballo apartado deja de ofrecerse a los demás, al confirmar |
| RN-09 | No se excede el cupo de la sesión ni la capacidad de la pista |
| RN-10 | Sin traslapes de jinete ni de caballo |
| RN-11 | La agenda se abre y se cierra el lunes |
| RN-12 | Solo se ven las sesiones que el paquete autoriza |
| RN-15 | Sin documentos firmados no hay primera reserva |
| RN-16 | Cada perfil ve solo sus documentos |
| RN-20 | Dirección puede saltarse la ventana; la reserva queda marcada |

## Lo que este prototipo todavía no es

Es una app funcional, no el sistema de producción. Falta lo que necesita un
servidor:

- **Sin autenticación.** Se elige un perfil de ejemplo desde el encabezado.
  El sistema real pide teléfono o correo con contraseña (§08).
- **Las reglas se aplican en el navegador.** La especificación pide que se
  apliquen en el servidor. Al apartar un caballo se usa una reserva de lugar
  antes de escribir, así que dos jinetes no se lo ganan a la vez, pero el resto
  de los topes se revisan del lado del cliente.
- **Sin notificaciones por WhatsApp** (M12): los recordatorios viven en la app.
- **Sin panel administrativo** (M11), portal de propietarios (M9) ni notas de
  cuadra (M8).
- **Catálogo de ejemplo.** Caballos, entrenadores, horarios, miembros y
  competencias son datos de prueba, no los del club.

## Cómo verlo

```bash
python3 -m http.server 8000
# http://localhost:8000            la app
# http://localhost:8000/especificacion/   el documento
```

Publicado como Artifact, la app guarda las reservas en el almacén compartido: lo
que aparta un jinete lo ven los demás. Abierta como archivo local guarda en el
navegador.

## Identidad visual

Paleta y tipografía provisionales —verde de cuadra, latón y hueso, con Cormorant
Garamond e Inter—: el manual de marca se entrega al inicio del desarrollo (§08).
Todos los colores son tokens en `:root`; ninguno está escrito dentro de los
componentes.
