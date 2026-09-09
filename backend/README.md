# La base del club

Esto es lo que hace que **no importe desde qué teléfono se entre**: los datos
viven en un servidor, no en el aparato de cada quien. Cuando dirección cambia
algo, a todos se les actualiza la pantalla sin recargar.

Y algo más importante: **quién puede ver y tocar qué no lo decide la app**.
Lo decide la base. Si alguien abre la consola del navegador y trata de leer las
reservas de otro, el servidor le contesta que no. Eso no se puede lograr con
una página sola.

## Qué ve cada quien

Probado contra PostgreSQL, no supuesto:

| | Jinete | Tutor | Maestro | Dirección |
|---|---|---|---|---|
| Su ficha y la de los maestros | sí | + la del menor | todas | todas |
| Sus reservas | sí | + las del menor | las de **sus** clases | todas |
| Qué caballo está tomado | sí, sin saber de quién | igual | sí | sí |
| Reservar a nombre de otro | **no** | solo del menor | en sus clases | sí |
| Corregir el registro de faltas | **no** | **no** | en sus clases | sí |
| Editar caballos, paquetes, personas | **no** | **no** | **no** | sí |

Un jinete sí puede dejar constancia de que canceló. Lo que no puede es volver
después a borrar la falta que se le cobró: eso es de dirección.

## Cómo se pone

Son **dos cosas**, y ninguna toma más de un minuto.

**1. Pegar el SQL.** En Supabase → **SQL Editor** → pegar entero
`backend/instalar.sql` → **Run**.

Supabase avisa que la consulta «incluye operaciones destructivas». Es verdad a
medias y conviene entender por qué: el archivo **retira y vuelve a crear las
reglas de acceso y una vista**, y eso es lo que dispara el aviso. **A la tabla
de datos no le borra nada.** Está probado corriéndolo tres veces seguidas con
actividad de por medio: las reservas, el registro, las personas nuevas y las
fichas editadas siguen ahí igual.

**2. Apagar la confirmación por correo.** En **Authentication → Sign In /
Providers**, apagar *Confirm email*. Las cuentas del club no llevan correo de
verdad; si queda encendida, Supabase espera que confirmen algo que no existe y
nadie entra. Si se olvida, la app lo dice en la pantalla de acceso con todas
sus letras, no con un "usuario o contraseña incorrectos".

Ya está. **No hay tercer paso**: cada quien se registra solo la primera vez que
entra, con su usuario y su contraseña de siempre.

### Cómo puede ser eso seguro

Al entrar por primera vez la app crea la cuenta y le pide al servidor que la
enganche con la ficha que dirección ya había hecho. **El servidor comprueba la
contraseña contra la huella guardada en la ficha** antes de enganchar nada, y
solo engancha fichas libres.

Así que registrarse con el nombre de otra persona no sirve: sin su contraseña
el enganche se rechaza, y si esa ficha ya está enganchada, tampoco. Probado
contra PostgreSQL:

| Intento | Resultado |
|---|---|
| Romina, con su contraseña | enganchada |
| La misma cuenta otra vez | ya estaba, no pasa nada |
| Un desconocido se registra como "romina" | **rechazado** |
| Con la contraseña buena, pero la ficha ya tomada | **rechazado** |
| Katia con la contraseña equivocada | **rechazado** |
| Alguien sin sesión llama a la función | **rechazado** |

## Una advertencia que conviene no saltarse

Con **una sola contraseña para todo el club**, cualquiera que la sepa puede
entrar como dirección si adivina el usuario —y los usuarios son el nombre de
pila—. Las reglas de la base son sólidas, pero protegen a *quien entró*: si
alguien entra como dirección, para la base es dirección.

Mientras las contraseñas sean iguales, esto ordena quién ve qué entre gente del
club. Para que sea seguridad de verdad, cada persona necesita la suya, y se
cambia desde su ficha.

## Los archivos

- `almacen.sql` — la tabla de la app y sus reglas de acceso. **Es el que usa la app.**
- `datos-del-club.sql` — los datos actuales.
- `01-esquema.sql`, `02-seguridad.sql`, `03-datos-iniciales.sql`, `todo-en-uno.sql`
  — un diseño con una tabla por cosa (personas, caballos, reservas…), más
  ortodoxo. Está aplicado en el proyecto pero **la app todavía no lo usa**: se
  quedó como el camino de más adelante, si algún día hacen falta reportes o
  cobros. Se puede dejar donde está sin que estorbe.
