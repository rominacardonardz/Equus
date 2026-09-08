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

En Supabase, en **SQL Editor**, correr en este orden:

1. `almacen.sql` — la tabla y las reglas. Se puede repetir cuantas veces haga falta.
2. `datos-del-club.sql` — los datos que ya había en la app, para no empezar de cero.

### Antes hace falta un dominio del club

Se entra con usuario, no con correo. Pero la base necesita algo con forma de
correo, así que la app le pega un dominio por detrás. **Ese dominio tiene que
existir y ser del club.**

Está comprobado contra el proyecto: Supabase **rechaza** un dominio inventado
(`cuentas.equus.mx` → *"Email address is invalid"*). Y poner uno ajeno es peor:
le manda correos de confirmación a un desconocido. `equus.mx`, por ejemplo, ya
es de alguien más.

Cuando esté comprado, se pone en `assets/js/supabase-config.js`:

```js
dominioCuentas: "equusmty.com",
```

Mientras esté vacío, la app funciona guardando en cada aparato y lo avisa en
pantalla. No falla en silencio.

### Y apagar la confirmación por correo

En **Authentication → Sign In / Providers**, apagar *Confirm email*. Si queda
encendida, Supabase intenta mandarle un correo a cada cuenta nueva, choca con
su propio límite de envíos, y nadie puede entrar hasta confirmar un correo que
no existe.

Por último, entrar a la app como dirección: sale un aviso con el botón
**«Crear las cuentas que faltan»**. Ese botón le crea la cuenta a cada persona
que ya tiene ficha. Es una sola vez.

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
