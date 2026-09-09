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
