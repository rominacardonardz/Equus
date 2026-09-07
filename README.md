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

**Reservar.** Vista semanal. El lunes no se monta: es el día en que se abre la
agenda. Jinetes de escuela reservan de martes a sábado; propietarios, de martes a
domingo. Horarios: 7, 8 y 9 de la mañana y 4, 5 y 6 de la tarde de martes a
viernes; 7, 8, 9 y 10 de la mañana sábado y domingo.

Se monta en las dos pistas del club: **Hípico Mty** y **Equus**.

Al reservar, un jinete de escuela elige entre los caballos que le desbloquearon y
estén libres; un propietario monta el suyo, sin elegir de una lista ajena. Al
confirmar se descuenta la clase y se muestra la hora exacta del límite de
cancelación.

**Documentos.** Lo que hay que firmar sale del perfil que dirección asignó al dar
de alta a la persona, ni más ni menos:

| Perfil | Firma |
|---|---|
| Jinete | Reglamento del club y contrato de jinete |
| Propietario y jinete | Esos dos, más el contrato de pupilaje |
| Menor de edad | Los de jinete, más la carta responsiva que firma el tutor |

Se firman escribiendo el nombre completo, y sin esa firma no se puede reservar.
Cada documento lleva versión: al publicar una nueva se vuelve a pedir la firma.

**Competencias.** Calendario que carga y edita dirección: fechas, sede, categorías,
horarios de cada prueba y cierre de inscripciones. El jinete se anota eligiendo
categoría; solo dirección ve la lista de quién está anotado y en qué.

**La semana (solo dirección).** El calendario maestro: todas las reservas de la
semana, día por día y hora por hora, con quién monta y en qué caballo, más el
total de clases, jinetes y caballos en uso y cuál es el que más trabaja. Se
navega a semanas anteriores y siguientes. Desde ahí dirección ajusta cada hora
del horario: pista, entrenador, cupo, o quitarla del horario.

**Recordatorios.** Los propios, con fecha; y los automáticos que salen de las
reservas y del calendario — el límite de cancelación de cada clase, el cierre de
inscripciones, la apertura de la agenda del lunes.

## Perfiles y qué ve cada uno

| Perfil | Ve | Notas |
|---|---|---|
| Dirección | Todo. Da de alta personas, les asigna perfil y nivel, les carga clases, les desbloquea caballos, ajusta el horario semanal y edita el calendario de competencias | Tiene la agenda completa de la semana y ve quién se anotó a cada clase; puede agendar fuera de la ventana del lunes (RN-20) |
| Propietario | Lo de propietario y lo de jinete | Ficha de su caballo, pupilaje, requisitos y autorización de uso |
| Jinete | Solo lo de jinete | Reglamento y contrato de jinete; nunca documentos de propietario |
| Tutor | Lo de jinete, sobre la cuenta del menor | Reserva, cancela y firma en nombre del menor (RN-18) |

Nadie fuera de dirección ve las reservas, firmas, recordatorios ni inscripciones
de otra persona. La lista de anotados a una competencia es información del club:
un jinete solo sabe si él está anotado.

Nadie se da de alta solo: las personas las crea dirección, y de su perfil sale
qué documentos firma, qué días puede reservar y qué caballos monta.

**Qué se aplica de verdad y qué no.** Publicada como Artifact, el almacén aplica
tres reglas que el navegador no puede saltarse: el padrón de personas, el horario
semanal y el calendario de competencias solo los escribe quien tenga permiso de
edición de la página. La cuenta de dirección de
la app solo se abre para esa persona, y se comprueba contra el almacén, no contra
el código. El resto de la separación por perfil vive en la app: filtra lo que
muestra, pero los datos del club están en un almacén común, así que alguien con
herramientas de desarrollador podría leerlos. La separación real por usuario
necesita el servidor con cuentas de verdad.

## Reglas de negocio aplicadas

Las de la especificación (§04), calculadas siempre en la zona horaria del club:

| Clave | Regla |
|---|---|
| RN-01 | Cancelación sin costo hasta 10 horas antes; después la clase se cobra |
| RN-03 | No se reserva sin saldo; lo carga el administrador tras el cobro presencial |
| RN-04 | El jinete de escuela solo monta caballos que le desbloquearon; el propietario, los suyos |
| RN-05 | El caballo debe ser compatible con el nivel del jinete |
| RN-06 | Máximo de clases por día por caballo; al llegar al tope desaparece |
| RN-08 | Un caballo apartado deja de ofrecerse a los demás, al confirmar |
| RN-09 | No se excede el cupo de la sesión ni la capacidad de la pista |
| RN-10 | Sin traslapes de jinete ni de caballo |
| RN-11 | La agenda se abre y se cierra el lunes, día en que no hay clases |
| RN-12 | Solo se ven las sesiones que el paquete autoriza |
| RN-15 | Sin documentos firmados no hay primera reserva |
| RN-16 | Cada perfil ve solo sus documentos |
| RN-20 | Dirección puede saltarse la ventana; la reserva queda marcada |

## Lo que este prototipo todavía no es

Es una app funcional, no el sistema de producción. Falta lo que necesita un
servidor:

- **Sin autenticación.** Se elige una cuenta de ejemplo desde el encabezado. Los
  permisos por perfil sí están implementados, pero sin contraseñas cualquiera
  puede elegir otra cuenta; la excepción es dirección, que el almacén verifica.
  El sistema real pide teléfono o correo con contraseña (§08).
- **Las reglas se aplican en el navegador.** La especificación pide que se
  apliquen en el servidor. Al apartar un caballo se usa una reserva de lugar
  antes de escribir, así que dos jinetes no se lo ganan a la vez, pero el resto
  de los topes se revisan del lado del cliente.
- **Sin notificaciones por WhatsApp** (M12): los recordatorios viven en la app.
- **Sin panel administrativo** (M11), portal de propietarios (M9) ni notas de
  cuadra (M8).
- **Catálogo de ejemplo.** Caballos y entrenadores son datos de prueba. Los días
  y horas de clase, y el calendario de competencias, son los que dio dirección;
  categorías y horarios de cada competencia se publican desde la app.
- **Los niveles no dividen los horarios todavía.** Cada hora está abierta a todos
  los niveles hasta que dirección diga qué nivel va en cada una.
- **El reparto de pistas es provisional.** Por defecto las clases de la mañana
  son en Hípico Mty y las de la tarde en Equus; dirección lo cambia hora por hora
  desde *La semana*.

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

Azules y dorados, con Cormorant Garamond e Inter. Sigue siendo provisional: el
manual de marca se entrega al inicio del desarrollo (§08).
Todos los colores son tokens en `:root`; ninguno está escrito dentro de los
componentes.
