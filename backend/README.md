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

**2. Darle su acceso a quien ya tiene ficha.** En el mismo SQL Editor, una
línea, una sola vez:

```sql
select * from public.crear_accesos_faltantes('hipicoequus.com');
```

Devuelve una lista diciendo a quién le creó su acceso. La contraseña es la del
club; si se quiere otra: `crear_accesos_faltantes('hipicoequus.com', 'otra')`.

**3. En Authentication → Sign In / Providers**, dejarlo así:

| | |
|---|---|
| **Email** (el proveedor) | **encendido** |
| **Confirm email** | **apagado** — estos correos no existen |
| **Allow new users to sign up** | **apagado** — nadie se registra solo |

Ya está.

### Cómo se da de alta a alguien nuevo

Desde la app, como siempre: dirección crea la ficha con su usuario y su
contraseña, y al guardarla **el servidor le crea el acceso**. No hace falta
volver a Supabase.

Eso funciona con el registro apagado porque la cuenta no la crea el navegador:
la crea una función del servidor que **solo obedece a dirección**. Cualquier
otro que la llame recibe un no.

### Y si alguien ya tenía cuenta

Al entrar, el servidor engancha su cuenta con su ficha, pero **solo si la
contraseña coincide** con la huella guardada, y solo si esa ficha está libre.
Probado contra PostgreSQL:

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
