# Casa Quirón — Sistema de Reservas

App web del club: reserva de clases, reglamento y contratos, calendario de
competencias y recordatorios. Mobile-first, en español de México, sin
dependencias ni compilación.

```
index.html            La app
backend/              Esquema, reglas de acceso y datos iniciales para el servidor
especificacion/       El documento fuente (especificación funcional v2.0) como sitio
tools/                Genera las versiones de archivo único de dist/
dist/                 Versiones de archivo único, para publicar como Artifact
```

## Qué hace la app

**Reservar.** Vista semanal. A cada jinete se le asigna un maestro, y solo ve las
clases de ese maestro: una por hora, no las dos. Sin maestro asignado ve las de
todos. Jinetes de escuela reservan de martes a sábado; propietarios, de martes a
domingo.

**Cada hora hay dos clases a la vez**, una por maestro y pista: Tania en **Hípico
Mty** y Edwin en **Equus**. Horarios: de martes a viernes 7, 8 y 9 de la mañana y
4, 5 y 6 de la tarde; sábado 7, 8, 9 y 10; domingo 7, 8 y 9, solo para
propietarios. El lunes no se monta.

**Todos los horarios están abiertos para cualquier nivel**, por decisión de
dirección: una jinete de cuerdita ve las mismas horas que una de avanzado. El
nivel no reparte horarios, solo decide qué caballos puede montar cada quien
(RN-05). La única restricción por perfil es el domingo, reservado a propietarios.

Al reservar, un jinete de escuela elige entre los caballos que le desbloquearon y
estén libres; un propietario monta el suyo, sin elegir de una lista ajena. Al
confirmar se descuenta la clase y se muestra la hora exacta del límite de
cancelación.

**Documentos.** Dirección los redacta desde la app —título, versión, a qué perfil
le tocan, si son obligatorios y el texto— y no firma ninguno. Lo que cada quien
firma sale del perfil que dirección le asignó al darlo de alta, ni más ni menos:

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

**Lo que administra dirección.** Desde Inicio: el **personal y los socios** (nombre,
perfil, nivel, usuario y contraseña, clases cargadas, caballos desbloqueados, y si
da clases); el **catálogo de caballos** (alta, baja, nivel que admiten, tope diario
y estatus — uno en descanso, lesionado o retirado desaparece del selector aunque
esté desbloqueado); y los **paquetes** de 4, 8, 10 y 15 clases, editables. El jinete
ve en su inicio cuántas lleva usadas de su paquete.

**La semana.** El calendario maestro. Dirección —y el maestro en sus propias
clases— toca el nombre de un jinete para sacarlo de la hora, con las tres salidas
que distingue el reglamento: el club cancela y le devuelve la clase (RN-13), el
jinete canceló tarde y se le cobra (RN-01), o no se presentó (RN-02). También puede **cambiarla de horario**: la app ofrece los huecos de esa
semana donde el caballo está libre, hay lugar y no se le encima otra clase, y la
mueve sin cobrar ni devolver nada. Lo que se cierre así queda en el historial del
jinete, con su motivo.

**Faltas y cancelaciones tardías.** Dirección lleva el conteo por persona de las
clases que se cobraron sin darse —no se presentó, o canceló pasado el límite—, y
cada jinete lo ve en su propia tarjeta de paquete. Un maestro entra y ve **solo sus clases**;
dirección ve las del club entero, y quien es las dos cosas —como Tania y Edwin—
abre en las suyas y alterna con un botón. Arriba, el pulso de la
semana: clases reservadas, jinetes distintos, caballos en uso y cuál es el que más
trabaja. Debajo, una tira de siete días con una barra por día para ver de un
vistazo dónde se junta la gente; se toca un día y se abre su detalle hora por
hora, con quién monta y en qué caballo. Se navega a semanas anteriores y
siguientes, y desde cada hora se ajusta pista, maestro y cupo, o se quita del
horario.

**Avisos y recordatorios.** Tres capas en la misma pantalla: los anuncios que
escribe dirección y elige a qué perfiles les salen —o a todos—, con opción de
fijarlos arriba y de que caduquen solos; los recordatorios que escribe cada quien;
y los automáticos que salen de las reservas y del calendario — el límite de
cancelación de cada clase, el cierre de inscripciones, la apertura de la agenda
del lunes.

## Entrar

La app abre en una pantalla de acceso: usuario y contraseña. Sin sesión no se ve
nada. Las cuentas las crea dirección desde *Personas del club*, con su usuario y
su contraseña; un menor no lleva usuario porque entra su tutor. La sesión aguanta
recargas y se cierra desde el chip del encabezado.

Las contraseñas se guardan como huella SHA-256, no en claro.

> **Esto no es autenticación de verdad.** El cotejo ocurre en el navegador y la
> página se puede leer. Sirve para que cada socio entre a lo suyo y no se meta en
> lo de otro por descuido; no resiste a alguien que quiera saltárselo a propósito.
> La autenticación real necesita servidor, y es la primera pieza de la lista de
> pendientes de más abajo.

## Perfiles y qué ve cada uno

| Perfil | Ve | Notas |
|---|---|---|
| Maestro | Su propia agenda de la semana, y lo de un jinete |
| Jinete asignado | Solo las clases de su maestro |
| Dirección | Todo, con su propio usuario. Administra caballos, paquetes y personal; da de alta personas, les asigna perfil y nivel, les carga clases, les desbloquea caballos, ajusta el horario semanal y edita el calendario de competencias | Tiene la agenda completa de la semana y ve quién se anotó a cada clase; puede agendar fuera de la ventana del lunes (RN-20) |
| Propietario | Lo de propietario y lo de jinete | Ficha de su caballo, pupilaje, requisitos y autorización de uso |
| Jinete | Solo lo de jinete | Reglamento y contrato de jinete; nunca documentos de propietario |
| Tutor | Lo de jinete, sobre la cuenta del menor | Reserva, cancela y firma en nombre del menor (RN-18) |

Nadie fuera de dirección ve las reservas, firmas, recordatorios ni inscripciones
de otra persona. La lista de anotados a una competencia es información del club:
un jinete solo sabe si él está anotado.

Nadie se da de alta solo: las personas las crea dirección, y de su perfil sale
qué documentos firma, qué días puede reservar y qué caballos monta.

**Qué se aplica de verdad y qué no.** El inicio de sesión decide qué ve cada
quien dentro de la app. Publicada como Artifact, el almacén aplica
siete reglas que el navegador no puede saltarse: el padrón de personas, el catálogo
de caballos, los paquetes, el horario semanal, los documentos, los anuncios y el
calendario de competencias solo los escribe quien tenga permiso de edición. La cuenta de dirección de
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
| RN-12 | Los horarios están abiertos para cualquier nivel, por decisión de dirección; el domingo es la única restricción, solo para propietarios |
| RN-15 | Sin documentos firmados no hay primera reserva |
| RN-16 | Cada perfil ve solo sus documentos |
| RN-20 | Dirección puede saltarse la ventana; la reserva queda marcada |

## Pasar a producción

`backend/` trae lo que falta: el esquema de PostgreSQL, las reglas de acceso que
aplican la separación entre socios **en el servidor** en vez de en el navegador, y
los datos de arranque. Los tres archivos se ejecutaron y se probaron contra
PostgreSQL 16 con usuarios de cada perfil. `backend/README.md` lleva los pasos
para montarlo en Supabase y publicar el sitio.

Queda una sola pieza de código: el adaptador que sustituya la capa `Datos` de
`index.html` por llamadas a Supabase.

## Lo que este prototipo todavía no es

Es una app funcional, no el sistema de producción. Falta lo que necesita un
servidor:

- **El acceso es una puerta con llave, no una caja fuerte.** Hay usuario y
  contraseña, y cada quien entra a lo suyo, pero la comprobación pasa en el
  navegador. El sistema real la hace en el servidor, con teléfono o correo (§08).
- **Contraseña compartida entre los cinco administradores.** Es lo que pidió
  dirección; en producción conviene una por persona, para saber quién hizo cada
  cambio.
- **Las reglas se aplican en el navegador.** La especificación pide que se
  apliquen en el servidor. Al apartar un caballo se usa una reserva de lugar
  antes de escribir, así que dos jinetes no se lo ganan a la vez, pero el resto
  de los topes se revisan del lado del cliente.
- **Sin notificaciones por WhatsApp** (M12): los recordatorios viven en la app.
- **Sin panel administrativo** (M11), portal de propietarios (M9) ni notas de
  cuadra (M8).
- **Catálogo de ejemplo.** Los caballos que vienen cargados son de prueba, pero ya
  se editan desde la app. Los maestros, las pistas, los días
  y horas de clase, y el calendario de competencias, son los que dio dirección;
  categorías y horarios de cada competencia se publican desde la app.
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
