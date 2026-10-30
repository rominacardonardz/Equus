# Equus · Agenda de alumnos (versión web)

Es la misma agenda que estaba en claude.ai, ahora como página web propia que se instala en el celular como app.

| Pieza | Para qué sirve | Servicio |
|---|---|---|
| `index.html` | La agenda: pantallas, reglas, PDF, Excel y WhatsApp | Vercel |
| `nube.js` | Guarda los datos, maneja la entrada con correo y contraseña, los comprobantes y Google Drive | Supabase y Google |
| `api/asistente.js` | El chat que hace cambios, lee fotos de horarios y comprobantes | Anthropic, con tu cuenta |
| `supabase/setup.sql` | Crea la base de datos y decide quién puede entrar | Supabase |

Se hace una sola vez. Sigue los pasos en orden; son unos 30–45 minutos.

---

## Paso 1 · Supabase (base de datos y cuentas)

1. Entra a **supabase.com**, crea una cuenta gratis y luego **New project**.
   - Nombre: `equus-agenda`.
   - Contraseña de la base de datos: inventa una y guárdala.
   - Región: la más cercana a Monterrey (por ejemplo, la del este de Estados Unidos).
2. Prepara el archivo `supabase/setup.sql`:
   - Abre el archivo y, hasta abajo, cambia `TU_CORREO@ejemplo.com` por **tu** correo.
   - Tania y Edwin ya están: los dos entran con `hipicoequus@icloud.com` y cada uno escoge su perfil.
3. Corre el archivo:
   - En Supabase entra a **SQL Editor** y luego **New query**.
   - Pega todo el contenido de `setup.sql` y toca **Run**.
4. Pasa los datos de la agenda anterior:
   - Haz otra **New query**.
   - Pega el archivo `datos-agenda-anterior.sql` que te mandé aparte y toca **Run**.
   - Ese archivo trae los alumnos, la semana, los caballos y el historial. No está en el repositorio porque tiene datos personales.
5. Crea las cuentas para entrar (correo y contraseña):
   - Ve a **Authentication**, luego **Users**, luego **Add user**, luego **Create new user**.
   - Crea una cuenta para ti y otra para `hipicoequus@icloud.com` (la comparten Tania y Edwin).
   - A cada una ponle una contraseña y deja marcada la casilla **Auto Confirm User**.
   - No se manda ningún correo: con esa contraseña entran directo.
6. Copia dos datos en **Project Settings**, luego **API** (o **Data API** / **API Keys**):
   - **Project URL** (se ve así: `https://abcd1234.supabase.co`).
   - La llave **anon** / **publishable**.
   - **No** copies la llave `service_role` / `secret`; esa no se usa aquí.

> Más adelante, para dar acceso a alguien más, corre en el SQL Editor:
> `insert into editores (email, nombre) values ('correo@ejemplo.com', 'Nombre');`
> Para quitarle el acceso: `delete from editores where email = 'correo@ejemplo.com';`

## Paso 2 · Anthropic (el chat asistente)

1. Entra a **console.anthropic.com** con tu cuenta.
2. Agrega una forma de pago en **Billing**. Te recomiendo poner un **límite de gasto mensual** (por ejemplo 5 o 10 dólares) para que nunca se pase.
3. En **API Keys** crea una llave con el nombre `equus-agenda` y cópiala. Empieza con `sk-ant-`.
   - **No la mandes por chat ni por correo.** Solo se pega en Vercel, en el paso 3.

## Paso 3 · Vercel (publicar la página)

1. Entra a **vercel.com** y crea una cuenta con tu GitHub.
2. Toca **Add New…**, luego **Project**, e importa el repositorio `Equus`.
3. Antes de publicar:
   - **Root Directory:** `agenda` (importante).
   - **Framework Preset:** Other.
   - **Environment Variables:** agrega estas tres:

     | Nombre | Valor |
     |---|---|
     | `SUPABASE_URL` | el Project URL del paso 1 |
     | `SUPABASE_ANON_KEY` | la llave anon / publishable del paso 1 |
     | `ANTHROPIC_API_KEY` | la llave `sk-ant-…` del paso 2 |

4. Toca **Deploy**. Al terminar te da una dirección tipo `equus-agenda.vercel.app`.
5. Entra a esa dirección, entra con tu correo y tu contraseña, y listo.

> Vercel publica en la dirección principal lo que está en la rama **main**. Si esta carpeta todavía está en otra rama, une esa rama a `main` (con un pull request) o, en Vercel, ve a **Settings**, luego **Git**, y elige esa rama como **Production Branch**.

## Paso 4 · Instalar en el celular

- **iPhone:** abre la dirección en **Safari**, toca **Compartir**, luego **Agregar a pantalla de inicio**.
- **Android:** abre la dirección en **Chrome**, toca el menú ⋮ y luego **Instalar app** (o **Agregar a pantalla principal**).

Tania y Edwin entran con `hipicoequus@icloud.com` y cada uno toca su perfil. Entran con correo y contraseña una vez, y la sesión se queda abierta.

## Paso 5 (opcional) · Hoja de pagos en Google Drive

Sin este paso todo funciona, y el botón **Excel de pagos** descarga el Excel. Con este paso, además se mantiene una hoja en tu Google Drive que Tania y Edwin pueden editar.

1. Entra a **console.cloud.google.com** y crea un proyecto `equus-agenda`.
2. Ve a **APIs & Services**, luego **Library**, busca **Google Drive API** y toca **Enable**.
3. Configura la pantalla de permiso:
   - Ve a **APIs & Services** y luego **OAuth consent screen** (o **Google Auth Platform**).
   - Tipo **External**.
   - Nombre "Agenda Equus" y tu correo.
   - En **Test users** agrega tu correo de Google.
4. Crea el permiso para la página:
   - Ve a **Credentials**, luego **Create credentials**, luego **OAuth client ID**.
   - Tipo **Web application**.
   - En **Authorized JavaScript origins** pon tu dirección de Vercel (por ejemplo `https://equus-agenda.vercel.app`).
   - Copia el **Client ID**.
5. En Vercel ve a **Settings**, luego **Environment Variables**:
   - Agrega `GOOGLE_CLIENT_ID` con ese valor.
   - Luego ve a **Deployments**, abre el menú ⋯ del último y toca **Redeploy**.
6. En la agenda, en **Pagos**, toca **Conectar Google Drive**. Se crea la carpeta **"Equus · Pagos"**. Compártela en Drive con Tania y Edwin como **Editores**.

Cosas a saber de Google Drive:
- La agenda solo puede ver los archivos que ella misma creó en tu Drive (permiso `drive.file`), no el resto de tu Drive.
- Google mostrará un aviso de "app no verificada" porque es tu app personal. Toca **Continuar**.
- El permiso de Google dura una hora. Después, la hoja se actualiza cuando toques **Actualizar ahora**.

---

## Costos (revísalos en las páginas oficiales; cambian seguido)

- **Supabase:** el plan gratis alcanza de sobra para dos maestros. Creo que pausa el proyecto si pasa como **una semana sin uso**. Si pasa, se reactiva desde su página.
- **Vercel:** el plan gratis (Hobby) creo que es solo para **uso personal, no comercial**. Como son clases cobradas, revisa sus condiciones. Si no aplica, su plan Pro cuesta creo que unos 20 dólares al mes, o se puede mover a otro hospedaje gratis.
- **Anthropic:** se paga por uso del chat.
  - El modelo que viene puesto es `claude-opus-5-5`, con esfuerzo bajo.
  - Para gastar mucho menos, agrega en Vercel la variable `ANTHROPIC_MODEL` con el valor `claude-haiku-5-5`. Creo que sale unas 40 veces más barato, aunque puede entender peor los mensajes difíciles o las fotos borrosas.
- **Google Drive:** gratis.
- **Dominio propio** (opcional): creo que entre 10 y 20 dólares al año.

## Diferencias con la versión de claude.ai

- Se entra con **correo y contraseña**, en vez de la cuenta de claude.ai.
- Los **comprobantes** se guardan en Supabase. La agenda anterior no tenía comprobantes subidos, así que no se perdió ninguno.
- La conexión con Google Drive empieza de nuevo: se crea una carpeta nueva y la anterior se puede borrar.
- En el Historial, los cambios hechos antes de la mudanza no muestran quién los hizo.
