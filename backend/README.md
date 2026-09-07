# Backend de Casa Quirón

Lo que falta para que la app deje de ser un prototipo: una base de datos de
verdad, cuentas con contraseña, y las reglas aplicadas **en el servidor** en vez
de en el navegador, como pide la especificación (§04).

Está escrito para **Supabase**, que da base de datos PostgreSQL, autenticación y
API en un solo servicio. Se puede usar cualquier PostgreSQL, pero entonces hay que
poner la autenticación y la API aparte.

## Los archivos

| Archivo | Qué hace |
|---|---|
| `01-esquema.sql` | Tablas, vistas y relaciones |
| `02-seguridad.sql` | Las reglas de acceso (Row Level Security) |
| `03-datos-iniciales.sql` | Pistas, paquetes, caballos, horarios, competencias y documentos |

Los tres se ejecutaron contra PostgreSQL 16 y se probaron con usuarios de
distintos perfiles antes de escribir esto. Lo que **no** se ha probado es
Supabase en sí: sus funciones `auth.uid()` y su tabla `auth.users` se dan por
buenas según su documentación. Conviene verificarlo al montarlo.

## Pasos

### 1. Crear el proyecto

En [supabase.com](https://supabase.com), crea un proyecto. Elige la región más
cercana a Monterrey. Guarda la contraseña de la base de datos: no se vuelve a
mostrar.

### 2. Cargar el esquema

En el panel de Supabase, **SQL Editor**, pega y ejecuta en este orden:

1. `01-esquema.sql`
2. `02-seguridad.sql`
3. `03-datos-iniciales.sql`

En `01-esquema.sql`, descomenta la referencia a `auth.users` en la columna
`auth_id` de `personas` — aquí está sin ella porque en un PostgreSQL normal ese
esquema no existe.

### 3. Crear las cuentas de dirección

En **Authentication → Users**, agrega a las cinco personas de dirección con su
correo. Supabase les manda una invitación para poner su contraseña; ya no hace
falta una compartida, y así sí queda registro de quién hizo cada cambio.

Después, por cada una, en el SQL Editor:

```sql
insert into personas (auth_id, nombre, rol, imparte)
values ('<el uuid que muestra Authentication>', 'Tania', 'admin', true);
```

Con eso ya pueden entrar y dar de alta al resto desde la app.

### 4. Conectar la app

En **Project Settings → API** están la URL del proyecto y la clave `anon`. Esa
clave es pública a propósito: **quien protege los datos son las reglas de acceso,
no la clave**. La clave `service_role` no se usa nunca desde el navegador.

Falta escribir el adaptador que sustituya la capa `Datos` de `index.html` por
llamadas a Supabase. Es la única pieza de código que queda; la app ya está
construida con esa capa aislada justamente para esto.

### 5. Subir el sitio

El sitio es estático: no necesita servidor propio.

- **Netlify o Vercel**: conectas este repositorio de GitHub y publica solo. Cada
  push actualiza el sitio.
- **GitHub Pages**: en Settings → Pages del repositorio, apuntando a la rama.

Los tres tienen plan gratuito. No pongo cifras porque no estoy segura de las
actuales; conviene mirarlas en su página.

Para que se instale en el teléfono como app, falta agregar un `manifest.json` y
un service worker — es poco trabajo y hace que se abra a pantalla completa desde
el icono.

### 6. WhatsApp (opcional, va aparte)

La especificación lo pide como canal principal (M12). Requiere una cuenta de
WhatsApp Business API, que se contrata por separado y cobra por conversación. Es
la parte con el costo menos predecible; conviene dejarla para después de que el
sistema esté funcionando.

## Qué protegen las reglas

Probado contra PostgreSQL 16 con usuarios reales de cada perfil:

| Intento | Resultado |
|---|---|
| Un jinete lee las reservas de otro | Solo ve las suyas |
| Un jinete lee el padrón completo | Solo se ve a sí mismo |
| Un jinete se carga clases de más | La actualización no afecta ninguna fila |
| Un jinete se hace administrador | Igual: ninguna fila |
| Un jinete borra la reserva de otro | Ninguna fila |
| Un jinete crea un caballo o publica un anuncio | Rechazado por la política |
| Un jinete reserva a nombre de otra persona | Rechazado por la política |
| Un jinete consulta la ocupación de los caballos | **Sí**, sin nombres |
| Un tutor consulta el saldo del menor a su cargo | **Sí**, el suyo y el del menor |
| Un maestro lee las reservas | Solo las de las clases que él da |
| Dirección | Todo |

La pieza que hace esto posible sin sacrificar el sistema de reservas es la vista
`ocupacion`: dice qué caballo está tomado a qué hora **sin decir de quién es la
reserva**. Así un jinete puede saber que Jazmín no está libre a las 7 sin poder
ver la agenda de nadie.

## Lo que el esquema resuelve y la app todavía no

- **El saldo se calcula, no se guarda** (vista `saldos`): no puede desfasarse.
- **Dos llaves únicas** impiden por construcción que un caballo quede en dos
  clases de la misma hora (RN-08) y que un jinete tenga dos reservas encimadas
  (RN-10). Hoy eso depende de que el navegador se porte bien.
- **Tabla de auditoría** para el registro de cambios manuales que pide RN-20,
  que hoy no existe en ningún lado.
