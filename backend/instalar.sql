-- ===========================================================================
-- Equus · INSTALAR
--
-- Un solo pegado. Copiar todo este archivo en Supabase → SQL Editor → Run.
--
-- SE PUEDE VOLVER A CORRER SIN MIEDO. No borra ninguna tabla ni ningún dato:
-- crea lo que falte, actualiza las reglas de acceso y deja intacto todo lo que
-- el club haya hecho mientras tanto.
--
-- Supabase avisa que hay operaciones destructivas porque el archivo retira y
-- vuelve a crear las reglas y una vista. Eso no guarda datos: los datos viven
-- en la tabla almacen, y a esa tabla no se le borra nada.
--
-- DESPUÉS DE CORRERLO, correr también esta línea para darle su acceso a la
-- gente que ya tiene ficha (una sola vez):
--
--     select * from public.crear_accesos_faltantes('hipicoequus.com');
--
-- En Supabase, el registro abierto se queda APAGADO: nadie se crea una cuenta
-- por su cuenta. Las cuentas las da dirección desde la propia app.
-- ===========================================================================

-- ===========================================================================
-- Equus · almacén de la app
--
-- La app maneja documentos: colecciones con un id de texto y un objeto JSON.
-- Esta tabla guarda justo eso, y las reglas de abajo deciden quién ve y quién
-- escribe cada cosa. El navegador no puede saltárselas: las aplica Postgres.
--
-- Se puede volver a correr entero cuantas veces haga falta.
-- ===========================================================================

-- ------------------------------------------------------------------ tabla
-- Nunca se borra: este archivo se corre otra vez para actualizar las reglas,
-- y si borrara la tabla se llevaría por delante las reservas del club.
create table if not exists almacen (
  coleccion   text        not null,
  doc_id      text        not null,
  datos       jsonb       not null,
  actualizado timestamptz not null default now(),
  primary key (coleccion, doc_id)
);

create index if not exists almacen_coleccion on almacen (coleccion);
-- Las reglas preguntan por estos dos campos en casi cada fila.
create index if not exists almacen_persona on almacen ((datos->>'personaId'));
create index if not exists almacen_auth    on almacen ((datos->>'authId'));

alter table almacen enable row level security;

-- ------------------------------------------------- quién es quien pregunta
-- En un esquema aparte: PostgREST no publica cq_priv, así que estas funciones
-- no se pueden llamar desde el navegador aunque sean SECURITY DEFINER.
create schema if not exists cq_priv;
revoke all on schema cq_priv from public;
grant usage on schema cq_priv to authenticated;

-- El id de la persona que abrió sesión.
create or replace function cq_priv.yo() returns text
  language sql stable security definer set search_path = public, auth as $$
  select doc_id from almacen
   where coleccion = 'personas' and datos->>'authId' = auth.uid()::text
   limit 1;
$$;

create or replace function cq_priv.mi_ficha() returns jsonb
  language sql stable security definer set search_path = public, auth as $$
  select datos from almacen
   where coleccion = 'personas' and datos->>'authId' = auth.uid()::text
   limit 1;
$$;

create or replace function cq_priv.es_admin() returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select coalesce(cq_priv.mi_ficha()->>'rol', '') = 'admin';
$$;

create or replace function cq_priv.imparte() returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select coalesce((cq_priv.mi_ficha()->>'imparte')::boolean, false);
$$;

-- El menor a cargo de un tutor: sus reservas y sus firmas son las del tutor.
create or replace function cq_priv.mi_tutelado() returns text
  language sql stable security definer set search_path = public, auth as $$
  select nullif(cq_priv.mi_ficha()->>'tutorDe', '');
$$;

-- ¿La clase de esta fila la doy yo? Se compara con el maestro que quedó
-- grabado en la reserva.
create or replace function cq_priv.doy_esa_clase(fila jsonb) returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select cq_priv.imparte() and fila->>'ent' = cq_priv.yo();
$$;

-- ¿Es mío lo que dice esta fila? Mío, o del menor que manejo.
create or replace function cq_priv.es_mio(fila jsonb) returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select fila->>'personaId' in (cq_priv.yo(), coalesce(cq_priv.mi_tutelado(), '\x00'));
$$;

revoke all on all functions in schema cq_priv from public, anon;
grant execute on all functions in schema cq_priv to authenticated;

-- --------------------------------------------------------------- catálogos
-- Caballos, paquetes, competencias, horarios, documentos y anuncios los ve
-- todo el que entró; solo dirección los escribe.
drop policy if exists catalogo_lectura on almacen;
create policy catalogo_lectura on almacen for select to authenticated
  using (coleccion in ('caballos','paquetes','competencias','horarios','documentos','anuncios'));

drop policy if exists catalogo_escritura on almacen;
create policy catalogo_escritura on almacen for all to authenticated
  using (coleccion in ('caballos','paquetes','competencias','horarios','documentos','anuncios')
         and cq_priv.es_admin())
  with check (coleccion in ('caballos','paquetes','competencias','horarios','documentos','anuncios')
         and cq_priv.es_admin());

-- ---------------------------------------------------------------- personas
-- Un jinete se ve a sí mismo, al menor que maneja y a los maestros (necesita
-- sus nombres). Dirección y los maestros ven a todos.
drop policy if exists personas_lectura on almacen;
create policy personas_lectura on almacen for select to authenticated
  using (coleccion = 'personas' and (
       cq_priv.es_admin()
    or cq_priv.imparte()
    or doc_id = cq_priv.yo()
    or doc_id = cq_priv.mi_tutelado()
    or coalesce((datos->>'imparte')::boolean, false)
  ));

-- Solo dirección da de alta, edita o da de baja personas.
drop policy if exists personas_escritura on almacen;
create policy personas_escritura on almacen for all to authenticated
  using (coleccion = 'personas' and cq_priv.es_admin())
  with check (coleccion = 'personas' and cq_priv.es_admin());

-- ------------------------------------------------------------------ montas
-- Cada quien ve lo suyo; el maestro, lo de sus clases; dirección, todo.
drop policy if exists montas_lectura on almacen;
create policy montas_lectura on almacen for select to authenticated
  using (coleccion in ('reservas','historial') and (
       cq_priv.es_admin() or cq_priv.doy_esa_clase(datos) or cq_priv.es_mio(datos)));

-- Reservas: un jinete se apunta, se cambia y se cancela a sí mismo. Dirección
-- y el maestro de esa clase pueden con cualquiera.
drop policy if exists reservas_escritura on almacen;
create policy reservas_escritura on almacen for all to authenticated
  using (coleccion = 'reservas' and (
       cq_priv.es_admin() or cq_priv.doy_esa_clase(datos) or cq_priv.es_mio(datos)))
  with check (coleccion = 'reservas' and (
       cq_priv.es_admin() or cq_priv.doy_esa_clase(datos) or cq_priv.es_mio(datos)));

-- Registro: es de dinero. Un jinete puede dejar constancia de que canceló,
-- pero no puede volver después a borrar la falta que se le cobró: corregirlo
-- es de dirección y del maestro de esa clase.
drop policy if exists registro_alta on almacen;
create policy registro_alta on almacen for insert to authenticated
  with check (coleccion = 'historial' and (
       cq_priv.es_admin() or cq_priv.doy_esa_clase(datos) or cq_priv.es_mio(datos)));

drop policy if exists registro_correccion on almacen;
create policy registro_correccion on almacen for update to authenticated
  using (coleccion = 'historial' and (cq_priv.es_admin() or cq_priv.doy_esa_clase(datos)))
  with check (coleccion = 'historial' and (cq_priv.es_admin() or cq_priv.doy_esa_clase(datos)));

drop policy if exists registro_baja on almacen;
create policy registro_baja on almacen for delete to authenticated
  using (coleccion = 'historial' and (cq_priv.es_admin() or cq_priv.doy_esa_clase(datos)));

-- ------------------------------------------------------------------ suyo
-- Firmas, inscripciones y recordatorios: de cada quien, y de dirección.
drop policy if exists propio_lectura on almacen;
create policy propio_lectura on almacen for select to authenticated
  using (coleccion in ('aceptaciones','inscripciones','recordatorios')
         and (cq_priv.es_admin() or cq_priv.es_mio(datos)));

drop policy if exists propio_escritura on almacen;
create policy propio_escritura on almacen for all to authenticated
  using (coleccion in ('aceptaciones','inscripciones','recordatorios')
         and (cq_priv.es_admin() or cq_priv.es_mio(datos)))
  with check (coleccion in ('aceptaciones','inscripciones','recordatorios')
         and (cq_priv.es_admin() or cq_priv.es_mio(datos)));

-- -------------------------------------------------------------- ocupación
-- Para no apartar dos veces el mismo caballo hace falta saber qué caballo
-- está tomado, pero no de quién es la clase. Esta vista dice lo primero sin
-- decir lo segundo.
drop view if exists ocupacion_app;
create view ocupacion_app with (security_invoker = false) as
  select doc_id                as doc_id,
         datos->>'fecha'       as fecha,
         datos->>'plantillaId' as plantilla_id,
         datos->>'caballoId'   as caballo_id,
         datos->>'hora'        as hora,
         datos->>'tipoId'      as tipo_id
    from almacen
   where coleccion = 'reservas';

revoke all on ocupacion_app from public, anon;
grant select on ocupacion_app to authenticated;

-- --------------------------------------------------- el primer acceso
-- Huevo y gallina: para crear las cuentas hay que entrar como dirección, y
-- para entrar hacen falta las cuentas. Se rompe así: cada quien se registra la
-- primera vez, y esta función engancha su cuenta nueva con la ficha que ya
-- tenía —pero solo si sabe la contraseña—.
--
-- La comprobación pasa en el servidor, contra la huella guardada en la ficha.
-- Sin esto cualquiera podría registrarse como "romina" y quedarse con
-- dirección. Y solo engancha fichas libres: una ya enganchada no se toca.
create or replace function public.reclamar_ficha(p_usuario text, p_clave text)
  returns text
  language plpgsql security definer set search_path = public, auth as $$
declare
  fila   record;
  huella text;
begin
  if auth.uid() is null then return 'sin sesion'; end if;

  -- ¿esta cuenta ya tiene ficha?
  select doc_id into fila from almacen
   where coleccion = 'personas' and datos->>'authId' = auth.uid()::text limit 1;
  if found then return 'ya'; end if;

  select * into fila from almacen
   where coleccion = 'personas'
     and lower(datos->>'usuario') = lower(trim(p_usuario))
     and coalesce(datos->>'authId', '') = ''
   limit 1;
  if not found then return 'sin ficha'; end if;

  -- sha256 es de PostgreSQL, sin extensiones de por medio
  huella := encode(sha256(convert_to(p_clave, 'UTF8')), 'hex');
  if huella is distinct from coalesce(fila.datos->>'clave', '') then return 'clave'; end if;

  update almacen
     set datos = datos || jsonb_build_object('authId', auth.uid()::text)
   where coleccion = 'personas' and doc_id = fila.doc_id;
  return 'listo';
end;
$$;

revoke all on function public.reclamar_ficha(text, text) from public, anon;
grant execute on function public.reclamar_ficha(text, text) to authenticated;

-- --------------------------------------------------- crear los accesos
-- El registro abierto queda APAGADO en Supabase: nadie se crea una cuenta por
-- su cuenta. Las crea dirección, y para eso está esta función.
--
-- Escribe en auth.users, que es cosa de Supabase, así que solo la puede llamar
-- alguien que ya sea dirección —y la primera vez la llama el propio instalador,
-- que corre con todos los permisos—.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.crear_acceso(p_usuario text, p_clave text, p_dominio text)
  returns text
  language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  correo text := lower(trim(p_usuario)) || '@' || lower(trim(p_dominio));
  nuevo  uuid := gen_random_uuid();
  ficha  record;
begin
  -- Solo dirección. La excepción es el arranque, cuando todavía no hay nadie
  -- enganchado y esto lo corre el instalador desde el editor de SQL.
  if auth.uid() is not null and not cq_priv.es_admin() then
    return 'solo direccion';
  end if;

  select * into ficha from almacen
   where coleccion = 'personas' and lower(datos->>'usuario') = lower(trim(p_usuario)) limit 1;
  if not found then return 'sin ficha'; end if;

  if exists (select 1 from auth.users where email = correo) then
    -- Ya existía: solo hay que asegurarse de que la ficha lo sepa.
    update almacen set datos = datos || jsonb_build_object('authId',
             (select id::text from auth.users where email = correo))
     where coleccion = 'personas' and doc_id = ficha.doc_id;
    return 'ya existia';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values (
    '00000000-0000-0000-0000-000000000000', nuevo, 'authenticated', 'authenticated',
    correo, extensions.crypt(p_clave, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', '');

  -- GoTrue quiere además la identidad; en versiones viejas no existe
  -- provider_id, así que se pregunta antes de escribir.
  if to_regclass('auth.identities') is not null then
    if exists (select 1 from information_schema.columns
                where table_schema='auth' and table_name='identities' and column_name='provider_id') then
      insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                                   last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), nuevo, nuevo::text,
              jsonb_build_object('sub', nuevo::text, 'email', correo),
              'email', now(), now(), now());
    else
      insert into auth.identities (id, user_id, identity_data, provider,
                                   last_sign_in_at, created_at, updated_at)
      values (nuevo, nuevo, jsonb_build_object('sub', nuevo::text, 'email', correo),
              'email', now(), now(), now());
    end if;
  end if;

  update almacen set datos = datos || jsonb_build_object('authId', nuevo::text)
   where coleccion = 'personas' and doc_id = ficha.doc_id;
  return 'listo';
end;
$$;

revoke all on function public.crear_acceso(text, text, text) from public, anon;
grant execute on function public.crear_acceso(text, text, text) to authenticated;

-- Le crea el acceso a toda ficha que tenga usuario y todavía no tenga cuenta.
-- Se corre una vez al instalar, y otra vez cuando haga falta: lo que ya está
-- no se toca.
create or replace function public.crear_accesos_faltantes(p_dominio text, p_clave text default null)
  returns table(usuario text, resultado text)
  language plpgsql security definer set search_path = public, auth, extensions as $$
declare f record;
begin
  if auth.uid() is not null and not cq_priv.es_admin() then
    return query select ''::text, 'solo direccion'::text; return;
  end if;
  for f in select datos->>'usuario' as u, datos->>'clave' as h from almacen
            where coleccion = 'personas'
              and coalesce(datos->>'usuario','') <> ''
              and coalesce(datos->>'authId','') = ''
  loop
    -- Si no se pasa contraseña se usa la del club, que es la que ya conocen.
    return query select f.u, public.crear_acceso(f.u, coalesce(p_clave, 'equus'), p_dominio);
  end loop;
end;
$$;

revoke all on function public.crear_accesos_faltantes(text, text) from public, anon;
grant execute on function public.crear_accesos_faltantes(text, text) to authenticated;

-- ------------------------------------------------------------------ tiempo
create or replace function cq_priv.marcar_hora() returns trigger
  language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

drop trigger if exists almacen_hora on almacen;
create trigger almacen_hora before insert or update on almacen
  for each row execute function cq_priv.marcar_hora();

-- ------------------------------------------------------------ en vivo
-- Para que a todos se les actualice la pantalla sin recargar.
do $$
begin
  alter publication supabase_realtime add table almacen;
exception when duplicate_object then null;   -- ya estaba, y está bien
end $$;
-- ===========================================================================
-- Equus · los datos del club
--
-- Lo que ya había en la app, tal cual: 34 registros. Correr DESPUÉS de
-- almacen.sql. Se puede repetir: si un registro ya está, se actualiza.
--
-- Las fichas llevan la huella de la contraseña —no la contraseña— porque el
-- servidor la necesita para enganchar cada cuenta con su ficha la primera vez
-- que alguien entra. Van sin authId a propósito: eso lo pone ese enganche.
-- ===========================================================================

-- personas (10)
insert into almacen (coleccion, doc_id, datos) values
  ('personas', 'carllos', '{"clasesCargadas": 8, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": ["guero"], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "intermedio", "nombre": "Carlos", "paquete": "8 clases", "paqueteId": "p8", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": "", "usuario": "carlos"}'::jsonb),
  ('personas', 'edwin', '{"clasesCargadas": 0, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "imparte": true, "menor": false, "nivel": "avanzado", "nombre": "Edwin", "paquete": "", "paqueteId": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "edwin"}'::jsonb),
  ('personas', 'felipe', '{"clasesCargadas": 0, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "menor": false, "nivel": "avanzado", "nombre": "Felipe", "paquete": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "felipe"}'::jsonb),
  ('personas', 'katia', '{"clasesCargadas": 15, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": ["alazan"], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "avanzado", "nombre": "Katia", "paquete": "15 clases", "paqueteId": "p15", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": "", "usuario": "katia"}'::jsonb),
  ('personas', 'melisa', '{"clasesCargadas": 10, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": ["jazmin", "duende", "picaro"], "imparte": false, "maestroId": "edwin", "menor": false, "nivel": "principiantes", "nombre": "Melisa", "paquete": "10 clases", "paqueteId": "p10", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": "", "usuario": "melisa"}'::jsonb),
  ('personas', 'nicolas', '{"clasesCargadas": 0, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "menor": false, "nivel": "avanzado", "nombre": "Nicolás", "paquete": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "nicolas"}'::jsonb),
  ('personas', 'paola', '{"clasesCargadas": 8, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "intermedio", "nombre": "Paola", "paquete": "8 clases", "paqueteId": "p8", "propios": ["allegra"], "rol": "propietario", "sinCuenta": false, "tutorDe": "", "usuario": "paola"}'::jsonb),
  ('personas', 'romina', '{"clasesCargadas": 8, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "imparte": false, "maestroId": "", "menor": false, "nivel": "avanzado", "nombre": "Romina Cardona", "paquete": "", "paqueteId": "", "propios": ["norte"], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "romina"}'::jsonb),
  ('personas', 'tania', '{"clasesCargadas": 0, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "imparte": true, "maestroId": "", "menor": false, "nivel": "avanzado", "nombre": "Tania", "paquete": "", "paqueteId": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "tania"}'::jsonb),
  ('personas', 'vale', '{"clasesCargadas": 4, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": ["duende", "nube"], "imparte": false, "maestroId": "edwin", "menor": false, "nivel": "cuerdita", "nombre": "Vale", "paquete": "4 clases", "paqueteId": "p4", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": "", "usuario": "vale"}'::jsonb)
on conflict (coleccion, doc_id) do nothing;   -- lo que ya está, no se toca

-- caballos (3)
insert into almacen (coleccion, doc_id, datos) values
  ('caballos', 'allegra', '{"autorizaEscuela": false, "capa": "", "edad": "", "estatus": "activo", "max": "avanzado", "maxDia": 1, "min": "avanzado", "nombre": "Allegra", "origen": "Paola", "uso": "propietario"}'::jsonb),
  ('caballos', 'guero', '{"autorizaEscuela": false, "capa": "palomino", "edad": "7", "estatus": "activo", "max": "intermedio", "maxDia": 2, "min": "principiantes", "nombre": "Güero", "origen": "", "uso": "escuelita"}'::jsonb),
  ('caballos', 'norte', '{"autorizaEscuela": false, "capa": "alazan", "edad": "8", "estatus": "activo", "max": "intermedio", "maxDia": 2, "min": "principiantes", "nombre": "Norte", "origen": "Romina Cardona", "uso": "propietario"}'::jsonb)
on conflict (coleccion, doc_id) do nothing;   -- lo que ya está, no se toca

-- paquetes (4)
insert into almacen (coleccion, doc_id, datos) values
  ('paquetes', 'p10', '{"clases": 10, "nombre": "10 clases", "vigencia": ""}'::jsonb),
  ('paquetes', 'p15', '{"clases": 15, "nombre": "15 clases", "vigencia": ""}'::jsonb),
  ('paquetes', 'p4', '{"clases": 4, "nombre": "4 clases", "vigencia": ""}'::jsonb),
  ('paquetes', 'p8', '{"clases": 8, "nombre": "8 clases", "vigencia": ""}'::jsonb)
on conflict (coleccion, doc_id) do nothing;   -- lo que ya está, no se toca

-- competencias (5)
insert into almacen (coleccion, doc_id, datos) values
  ('competencias', 'hipico-mty', '{"categorias": [], "cierre": "", "disciplina": "Salto", "fin": "2026-10-25", "horarios": [], "inicio": "2026-10-22", "nombre": "Hípico Monterrey", "nota": "", "sede": "Club Hípico Monterrey"}'::jsonb),
  ('competencias', 'interclub-la-silla', '{"categorias": ["1.20 m", "1.10 m", "1.00 m", "0.90 m", "0.80 m", "0.60 m"], "cierre": "", "disciplina": "Salto", "fin": "2026-09-12", "horarios": ["Sábado 12 — Inicio a las 8:00 a.m.", "1.20 m y 1.10 m — Pista 2 Sierra Madre, césped (ría opcional)", "1.00 m, 0.90 m, 0.80 m y 0.60 m — Pista Techada, arena", "Cada prueba — Al término de la anterior"], "inicio": "2026-09-12", "nombre": "Concurso Interclub · La Silla", "nota": "$950 por binomio, en efectivo o transferencia. Trofeo a los primeros tres lugares y moña cada cuatro binomios.", "sede": "Club Hípico La Silla"}'::jsonb),
  ('competencias', 'la-silla', '{"categorias": [], "cierre": "", "disciplina": "Salto", "fin": "2026-11-15", "horarios": [], "inicio": "2026-11-02", "nombre": "Hípico La Silla", "nota": "", "sede": "Club Hípico La Silla"}'::jsonb),
  ('competencias', 'paloma-blanca', '{"categorias": [], "cierre": "", "disciplina": "Salto", "fin": "2026-10-04", "horarios": [], "inicio": "2026-10-01", "nombre": "Paloma Blanca", "nota": "", "sede": "Paloma Blanca"}'::jsonb),
  ('competencias', 'san-pedro', '{"categorias": [], "cierre": "", "disciplina": "Salto", "fin": "2026-09-20", "horarios": [], "inicio": "2026-09-17", "nombre": "San Pedro", "nota": "", "sede": "San Pedro"}'::jsonb)
on conflict (coleccion, doc_id) do nothing;   -- lo que ya está, no se toca

-- horarios (1)
insert into almacen (coleccion, doc_id, datos) values
  ('horarios', 'd2-0900', '{"activo": true, "cupo": 6, "ent": "tania", "esp": "mty"}'::jsonb)
on conflict (coleccion, doc_id) do nothing;   -- lo que ya está, no se toca

-- documentos (4)
insert into almacen (coleccion, doc_id, datos) values
  ('documentos', 'contrato-jinete', '{"audiencia": "jinete", "cuerpo": [{"h": "Riesgo de la actividad", "l": ["La equitación es una actividad de riesgo. El jinete la practica por voluntad propia.", "El club no se hace responsable de incidentes derivados del incumplimiento del reglamento."]}, {"h": "Clases y saldo", "l": ["Las clases se pagan en las oficinas del club; no hay cobro en línea.", "El saldo lo carga dirección una vez recibido el pago.", "La vigencia del paquete la define dirección al cargarlo."]}, {"h": "Cancelaciones", "l": ["Cancelación sin costo hasta 10 horas antes del inicio de la clase.", "Después de ese límite la clase se cobra.", "No presentarse cuesta la clase igual que cancelar tarde."]}], "obligatorio": true, "orden": 1, "resumen": "Deslinde de responsabilidad y condiciones de las clases.", "titulo": "Contrato de jinete", "version": "1.4", "vigente": "1 de julio de 2026"}'::jsonb),
  ('documentos', 'contrato-pupilaje', '{"audiencia": "propietario", "cuerpo": [{"h": "Servicio incluido", "l": ["Caballeriza individual, cama, alimentación y agua limpia.", "Salida diaria al padock y revisión del equipo de cuadra."]}, {"h": "A cargo del propietario", "l": ["Herrador, veterinario, desparasitaciones y vacunas al corriente.", "Suplementos y electrolitos, entregados en la fecha del mes que marque el calendario.", "Equipo completo del caballo, identificado con su nombre."]}, {"h": "Uso del caballo", "l": ["El caballo no entra al pool de escuela salvo autorización expresa del propietario, revocable en cualquier momento.", "El club no monta ni trabaja al caballo sin acuerdo previo."]}, {"h": "Salida del club", "l": ["Avisar con 30 días de anticipación para dar de baja el pupilaje."]}], "obligatorio": true, "orden": 2, "resumen": "Condiciones del servicio de pensión para caballos en el club.", "titulo": "Contrato de pupilaje", "version": "1.2", "vigente": "1 de julio de 2026"}'::jsonb),
  ('documentos', 'reglamento', '{"audiencia": "todos", "cuerpo": [{"h": "Equipo obligatorio", "l": ["Casco homologado en todo momento sobre el caballo, sin excepción.", "Botas de montar y pantalón adecuado.", "Chaleco protector obligatorio en salto para menores de edad."]}, {"h": "Uso de instalaciones", "l": ["El acceso a caballerizas es solo con autorización del equipo de cuadra.", "La pista se libera puntualmente al terminar cada clase.", "Prohibido dar alimento a caballos que no sean propios."]}, {"h": "Horarios", "l": ["El lunes no hay clases: es el día en que se abre la agenda de la semana.", "Jinetes de escuela: de martes a sábado.", "Propietarios: de martes a domingo.", "Todos los horarios están abiertos para cualquier nivel.", "Presentarse 15 minutos antes de la clase para ensillar."]}, {"h": "Convivencia", "l": ["Trato respetuoso con personal, jinetes y caballos.", "El incumplimiento del reglamento puede derivar en suspensión temporal."]}], "obligatorio": true, "orden": 0, "resumen": "Normas de convivencia, uso de instalaciones, equipo obligatorio y horarios.", "titulo": "Reglamento del club", "version": "2.1", "vigente": "1 de julio de 2026"}'::jsonb),
  ('documentos', 'responsiva-menor', '{"audiencia": "menor", "cuerpo": [{"h": "Quién responde", "l": ["El tutor que firma responde por el menor dentro de las instalaciones.", "El tutor acepta el reglamento y el contrato de jinete en nombre del menor."]}, {"h": "Autorización médica", "l": ["El tutor autoriza la atención médica de urgencia si hiciera falta.", "Datos de contacto y alergias del menor entregados a dirección y actualizados."]}, {"h": "Acompañamiento", "l": ["El menor no permanece solo en las instalaciones.", "Chaleco protector obligatorio en salto."]}], "obligatorio": true, "orden": 3, "resumen": "La firma el padre, madre o tutor que responde por el jinete menor de edad.", "titulo": "Carta responsiva de menor", "version": "1.1", "vigente": "1 de julio de 2026"}'::jsonb)
on conflict (coleccion, doc_id) do nothing;   -- lo que ya está, no se toca

-- reservas (7)
insert into almacen (coleccion, doc_id, datos) values
  ('reservas', '2026-09-08__d2-0800-tania__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-07T19:34:46.577Z", "ent": "tania", "esp": "mty", "fecha": "2026-09-08", "hora": "08:00", "movidaPor": "romina", "override": false, "personaId": "carllos", "plantillaId": "d2-0800-tania", "reservadaPor": "carllos", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-08__d2-1700-edwin__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-08T16:43:57.245Z", "ent": "edwin", "esp": "equus", "fecha": "2026-09-08", "hora": "17:00", "personaId": "carllos", "plantillaId": "d2-1700-edwin", "reservadaPor": "romina", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-09__d3-0800-edwin__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-07T19:34:59.568Z", "ent": "edwin", "esp": "equus", "fecha": "2026-09-09", "hora": "08:00", "override": false, "personaId": "carllos", "plantillaId": "d3-0800-edwin", "reservadaPor": "carllos", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-09__d3-1600-tania__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-08T19:55:57.787Z", "ent": "tania", "esp": "mty", "fecha": "2026-09-09", "hora": "16:00", "personaId": "carllos", "plantillaId": "d3-1600-tania", "reservadaPor": "tania", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-10__d4-0800-edwin__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-07T19:35:03.913Z", "ent": "edwin", "esp": "equus", "fecha": "2026-09-10", "hora": "08:00", "override": false, "personaId": "carllos", "plantillaId": "d4-0800-edwin", "reservadaPor": "carllos", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-10__d4-0800-tania__allegra', '{"caballoId": "allegra", "consume": 1, "creada": "2026-09-08T19:56:09.869Z", "ent": "tania", "esp": "mty", "fecha": "2026-09-10", "hora": "08:00", "personaId": "paola", "plantillaId": "d4-0800-tania", "reservadaPor": "tania", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-11__d5-0900-tania__allegra', '{"caballoId": "allegra", "consume": 1, "creada": "2026-09-08T19:56:16.373Z", "ent": "tania", "esp": "mty", "fecha": "2026-09-11", "hora": "09:00", "personaId": "paola", "plantillaId": "d5-0900-tania", "reservadaPor": "tania", "tipoId": "escuela"}'::jsonb)
on conflict (coleccion, doc_id) do nothing;   -- lo que ya está, no se toca
