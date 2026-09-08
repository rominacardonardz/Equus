-- ===========================================================================
-- Equus · todo en uno
--
-- Pega este archivo completo en el SQL Editor de Supabase y ejecútalo.
-- Crea las tablas, las reglas de acceso y los datos de arranque.
--
-- SE PUEDE VOLVER A CORRER: empieza borrando lo suyo y lo vuelve a crear, así
-- que si algo falló a la mitad, basta con correrlo otra vez.
--
-- OJO: al volver a correrlo se borran las reservas, firmas y demás datos que ya
-- hubiera. Mientras el club no lo esté usando de verdad, eso no importa.
-- ===========================================================================

-- ------------------------------------------------------------- borrón y cuenta nueva
drop view if exists saldos cascade;
drop view if exists ocupacion cascade;

drop table if exists auditoria cascade;
drop table if exists recordatorios cascade;
drop table if exists inscripciones cascade;
drop table if exists competencias cascade;
drop table if exists anuncios cascade;
drop table if exists aceptaciones cascade;
drop table if exists documentos cascade;
drop table if exists reservas cascade;
drop table if exists horarios cascade;
drop table if exists caballos_habilitados cascade;
drop table if exists caballos cascade;
drop table if exists personas cascade;
drop table if exists espacios cascade;
drop table if exists paquetes cascade;

drop function if exists cq_persona_actual() cascade;
drop function if exists cq_es_admin() cascade;
drop function if exists cq_imparte() cascade;
drop function if exists cq_mis_personas() cascade;
drop function if exists cq_doy_esa_clase(uuid) cascade;

drop type if exists cq_rol cascade;
drop type if exists cq_nivel cascade;
drop type if exists cq_uso cascade;
drop type if exists cq_estado_caballo cascade;
drop type if exists cq_estado_reserva cascade;
drop type if exists cq_audiencia cascade;

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ catálogos
create type cq_rol    as enum ('admin','maestro','propietario','jinete','tutor');
create type cq_nivel  as enum ('cuerdita','principiantes','intermedio','avanzado');
create type cq_uso    as enum ('escuelita','propietario','desarrollo');
create type cq_estado_caballo as enum ('activo','descanso','lesionado','retirado');
create type cq_estado_reserva as enum
  ('confirmada','asistio','no_show','cancelada_a_tiempo','cancelada_tarde','cancelada_por_club');
create type cq_audiencia as enum ('todos','jinete','propietario','menor','tutor','maestro');

create table paquetes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  clases      integer not null check (clases > 0),
  vigencia    text,
  creado      timestamptz not null default now()
);

create table espacios (
  id          text primary key,              -- 'mty', 'equus'
  nombre      text not null,
  capacidad   integer not null check (capacidad > 0)
);

-- Una persona del club. `id` coincide con el usuario de Supabase Auth cuando
-- tiene cuenta; un menor no tiene cuenta y lleva id propio.
create table personas (
  id                uuid primary key default gen_random_uuid(),
  auth_id           uuid unique references auth.users(id) on delete set null,
  nombre            text not null,
  rol               cq_rol not null default 'jinete',
  nivel             cq_nivel,
  menor             boolean not null default false,
  sin_cuenta        boolean not null default false,
  imparte           boolean not null default false,
  tutor_de          uuid references personas(id) on delete set null,
  maestro_id        uuid references personas(id) on delete set null,
  paquete_id        uuid references paquetes(id) on delete set null,
  clases_cargadas   integer not null default 0 check (clases_cargadas >= 0),
  creada            timestamptz not null default now(),
  constraint menor_sin_cuenta check (not menor or sin_cuenta),
  constraint tutor_tiene_pupilo check (rol <> 'tutor' or tutor_de is not null)
);
create index on personas (maestro_id);
create index on personas (tutor_de);

create table caballos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  uso               cq_uso not null default 'escuelita',
  estatus           cq_estado_caballo not null default 'activo',
  nivel_min         cq_nivel not null default 'cuerdita',
  nivel_max         cq_nivel not null default 'avanzado',
  max_clases_dia    integer not null default 3 check (max_clases_dia > 0),
  propietario_id    uuid references personas(id) on delete set null,
  autoriza_escuela  boolean not null default false,   -- RN-14
  edad              integer,
  capa              text,
  origen            text
);

-- RN-04: qué caballos le desbloqueó su entrenador a cada jinete.
create table caballos_habilitados (
  persona_id  uuid not null references personas(id) on delete cascade,
  caballo_id  uuid not null references caballos(id) on delete cascade,
  alta        timestamptz not null default now(),
  primary key (persona_id, caballo_id)
);

-- ------------------------------------------------------- plantilla de horarios
-- Una fila por hora fija de la semana. dia: 0 domingo … 6 sábado.
create table horarios (
  id                 uuid primary key default gen_random_uuid(),
  dia                smallint not null check (dia between 0 and 6),
  hora               time not null,
  duracion_min       integer not null default 60,
  maestro_id         uuid references personas(id) on delete set null,
  espacio_id         text references espacios(id) on delete set null,
  cupo               integer not null default 6 check (cupo > 0),
  solo_propietarios  boolean not null default false,
  activo             boolean not null default true,
  unique (dia, hora, espacio_id)
);

-- ---------------------------------------------------------------- reservas
create table reservas (
  id           uuid primary key default gen_random_uuid(),
  horario_id   uuid not null references horarios(id) on delete cascade,
  fecha        date not null,
  persona_id   uuid not null references personas(id) on delete cascade,
  caballo_id   uuid references caballos(id) on delete set null,
  estado       cq_estado_reserva not null default 'confirmada',
  consume      integer not null default 1,
  cobrada      boolean not null default false,
  reservada_por uuid references personas(id) on delete set null,
  ajustada_por  uuid references personas(id) on delete set null,
  motivo       text,
  creada       timestamptz not null default now(),
  cerrada      timestamptz,
  -- RN-08: un caballo no puede estar en dos clases de la misma hora.
  unique (fecha, horario_id, caballo_id),
  -- RN-10: un jinete no puede tener dos reservas en la misma hora.
  unique (fecha, horario_id, persona_id)
);
create index on reservas (fecha);
create index on reservas (persona_id, fecha);
create index on reservas (caballo_id, fecha);

-- Saldo y consumo, calculados: nunca se guarda un número que pueda desfasarse.
create view saldos with (security_invoker = true) as
  select p.id as persona_id,
         p.nombre,
         p.clases_cargadas,
         coalesce(sum(r.consume) filter (
           where r.estado in ('confirmada','asistio','no_show','cancelada_tarde')
         ), 0)::int as usadas,
         p.clases_cargadas - coalesce(sum(r.consume) filter (
           where r.estado in ('confirmada','asistio','no_show','cancelada_tarde')
         ), 0)::int as saldo,
         count(*) filter (where r.estado = 'no_show')::int as faltas,
         count(*) filter (where r.estado = 'cancelada_tarde')::int as tardias
  from personas p
  left join reservas r on r.persona_id = p.id
  group by p.id, p.nombre, p.clases_cargadas;

-- Ocupación sin nombres: es lo que un jinete necesita para saber qué caballo
-- está tomado, sin poder ver de quién es la reserva.
create view ocupacion with (security_invoker = false) as
  select fecha, horario_id, caballo_id
  from reservas
  where estado = 'confirmada';

-- ------------------------------------------------------------- documentos
create table documentos (
  id                  uuid primary key default gen_random_uuid(),
  titulo              text not null,
  version             text not null,
  vigente_desde       date,
  audiencia           cq_audiencia not null default 'todos',
  obligatorio         boolean not null default true,
  resumen             text,
  cuerpo              jsonb not null default '[]'::jsonb,
  orden               integer not null default 0,
  unique (id, version)
);

create table aceptaciones (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos(id) on delete cascade,
  version      text not null,
  persona_id   uuid not null references personas(id) on delete cascade,
  firmada_por  uuid references personas(id) on delete set null,
  nombre_firma text not null,
  sello        timestamptz not null default now(),
  ip           inet,
  unique (documento_id, version, persona_id)
);

-- --------------------------------------------------- anuncios y competencias
create table anuncios (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  cuerpo      text not null,
  audiencia   cq_audiencia[] not null default array['todos']::cq_audiencia[],
  fijado      boolean not null default false,
  publicado   timestamptz not null default now(),
  expira      date
);

create table competencias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  inicio      date not null,
  fin         date,
  sede        text,
  disciplina  text,
  categorias  text[] not null default '{}',
  horarios    text[] not null default '{}',
  cierre      date,
  nota        text,
  check (fin is null or fin >= inicio)
);

create table inscripciones (
  id             uuid primary key default gen_random_uuid(),
  competencia_id uuid not null references competencias(id) on delete cascade,
  persona_id     uuid not null references personas(id) on delete cascade,
  categoria      text,
  cuando         timestamptz not null default now(),
  unique (competencia_id, persona_id)
);

create table recordatorios (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references personas(id) on delete cascade,
  texto       text not null,
  fecha       date,
  hecho       boolean not null default false,
  creado      timestamptz not null default now()
);

-- RN-20 y M11: toda modificación manual deja rastro.
create table auditoria (
  id            bigserial primary key,
  persona_id    uuid references personas(id) on delete set null,
  accion        text not null,
  entidad       text not null,
  entidad_id    text,
  valor_anterior jsonb,
  valor_nuevo   jsonb,
  motivo        text,
  cuando        timestamptz not null default now()
);
create index on auditoria (entidad, entidad_id);
create index on auditoria (cuando desc);


-- ===========================================================================
-- Equus · reglas de acceso (Row Level Security)
--
-- Esto es lo que hoy no existe: la separación entre socios la aplica el
-- servidor, no el navegador. Un jinete solo lee lo suyo aunque manipule la
-- página; los catálogos solo los escribe dirección.
--
-- Ejecutar después de 01-esquema.sql.
-- ===========================================================================

-- --------------------------------------------------------------- quién soy
-- En Supabase, auth.uid() devuelve el usuario de la sesión. Estas funciones lo
-- traducen a la persona del club y responden las preguntas que usan las reglas.

create or replace function cq_persona_actual() returns uuid
  language sql stable security definer set search_path = public, auth as $$
  select id from personas where auth_id = auth.uid() limit 1;
$$;

create or replace function cq_es_admin() returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from personas where auth_id = auth.uid() and rol = 'admin');
$$;

create or replace function cq_imparte() returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from personas where auth_id = auth.uid() and imparte);
$$;

-- Yo, más el menor a mi cargo si soy tutor: es el conjunto sobre el que puedo
-- reservar, cancelar y firmar (RN-18).
create or replace function cq_mis_personas() returns setof uuid
  language sql stable security definer set search_path = public, auth as $$
  select id from personas where auth_id = auth.uid()
  union
  select tutor_de from personas where auth_id = auth.uid() and tutor_de is not null;
$$;

-- ¿Doy yo esa clase? Un maestro ve y ajusta solo las suyas.
create or replace function cq_doy_esa_clase(p_horario uuid) returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from horarios h
    join personas p on p.id = h.maestro_id
    where h.id = p_horario and p.auth_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------------ encendido
alter table personas             enable row level security;
alter table paquetes             enable row level security;
alter table espacios             enable row level security;
alter table caballos             enable row level security;
alter table caballos_habilitados enable row level security;
alter table horarios             enable row level security;
alter table reservas             enable row level security;
alter table documentos           enable row level security;
alter table aceptaciones         enable row level security;
alter table anuncios             enable row level security;
alter table competencias         enable row level security;
alter table inscripciones        enable row level security;
alter table recordatorios        enable row level security;
alter table auditoria            enable row level security;

-- ------------------------------------------------- catálogos: leer todos,
-- escribir solo dirección. Son los que hoy protege la regla del almacén.
do $$
declare t text;
begin
  foreach t in array array['paquetes','espacios','caballos','horarios',
                           'documentos','anuncios','competencias']
  loop
    execute format($f$
      create policy %1$s_lectura on %1$s for select to authenticated using (true);
      create policy %1$s_escritura on %1$s for all to authenticated
        using (cq_es_admin()) with check (cq_es_admin());
    $f$, t);
  end loop;
end $$;

-- ------------------------------------------------------------------ personas
-- Cada quien se ve a sí mismo y al menor a su cargo. Dirección ve a todos, y un
-- maestro también, porque necesita la lista de sus jinetes.
create policy personas_lectura on personas for select to authenticated
  using (id in (select cq_mis_personas()) or cq_es_admin() or cq_imparte());

-- Nadie se da de alta solo: el padrón lo escribe dirección.
create policy personas_escritura on personas for all to authenticated
  using (cq_es_admin()) with check (cq_es_admin());

-- ------------------------------------------------------- caballos habilitados
create policy habilitados_lectura on caballos_habilitados for select to authenticated
  using (persona_id in (select cq_mis_personas()) or cq_es_admin() or cq_imparte());

-- RN-04: el entrenador administra la lista; dirección también.
create policy habilitados_escritura on caballos_habilitados for all to authenticated
  using (cq_es_admin() or cq_imparte()) with check (cq_es_admin() or cq_imparte());

-- ------------------------------------------------------------------ reservas
-- Un jinete ve las suyas; su maestro, las de su clase; dirección, todas.
create policy reservas_lectura on reservas for select to authenticated
  using (persona_id in (select cq_mis_personas()) or cq_es_admin() or cq_doy_esa_clase(horario_id));

create policy reservas_alta on reservas for insert to authenticated
  with check (persona_id in (select cq_mis_personas()) or cq_es_admin());

create policy reservas_cambio on reservas for update to authenticated
  using (persona_id in (select cq_mis_personas()) or cq_es_admin() or cq_doy_esa_clase(horario_id))
  with check (persona_id in (select cq_mis_personas()) or cq_es_admin() or cq_doy_esa_clase(horario_id));

create policy reservas_baja on reservas for delete to authenticated
  using (persona_id in (select cq_mis_personas()) or cq_es_admin() or cq_doy_esa_clase(horario_id));

-- La ocupación va sin nombres: cualquiera puede saber que Jazmín está tomado a
-- las 7, nadie puede saber por quién.
grant select on ocupacion to authenticated;
grant select on saldos to authenticated;

-- ------------------------------------------------- firmas, inscripciones, notas
create policy aceptaciones_lectura on aceptaciones for select to authenticated
  using (persona_id in (select cq_mis_personas()) or cq_es_admin());
create policy aceptaciones_alta on aceptaciones for insert to authenticated
  with check (persona_id in (select cq_mis_personas()));

create policy inscripciones_lectura on inscripciones for select to authenticated
  using (persona_id in (select cq_mis_personas()) or cq_es_admin());
create policy inscripciones_propias on inscripciones for all to authenticated
  using (persona_id in (select cq_mis_personas()) or cq_es_admin())
  with check (persona_id in (select cq_mis_personas()) or cq_es_admin());

create policy recordatorios_propios on recordatorios for all to authenticated
  using (persona_id in (select cq_mis_personas()) or cq_es_admin())
  with check (persona_id in (select cq_mis_personas()) or cq_es_admin());

-- --------------------------------------------------------------- auditoría
create policy auditoria_lectura on auditoria for select to authenticated
  using (cq_es_admin());
create policy auditoria_alta on auditoria for insert to authenticated
  with check (true);


-- ===========================================================================
-- Equus · datos de arranque
-- Catálogos que no dependen de las cuentas de usuario. Las personas se crean
-- después, cuando existan sus cuentas (ver el README).
-- ===========================================================================

insert into espacios (id, nombre, capacidad) values
  ('mty',   'Hípico Mty', 6),
  ('equus', 'Equus',      6)
on conflict (id) do nothing;

insert into paquetes (nombre, clases) values
  ('4 clases', 4), ('8 clases', 8), ('10 clases', 10), ('15 clases', 15);

-- Caballos de ejemplo: dirección los edita desde la app.
insert into caballos (nombre, uso, estatus, nivel_min, nivel_max, max_clases_dia, edad, capa, origen) values
  ('Jazmín',  'escuelita',   'activo',   'principiantes', 'intermedio',    3, 11, 'alazana',        'KWPN'),
  ('Duende',  'escuelita',   'activo',   'cuerdita',      'principiantes', 3, 16, 'tordillo',       'Azteca'),
  ('Nube',    'escuelita',   'activo',   'cuerdita',      'principiantes', 3, 14, 'palomino',       'Cuarto de milla'),
  ('Pícaro',  'escuelita',   'activo',   'principiantes', 'intermedio',    3,  9, 'castaño',        'Azteca'),
  ('Alazán',  'escuelita',   'activo',   'intermedio',    'avanzado',      3, 12, 'alazán',         'Silla argentino'),
  ('Sereno',  'escuelita',   'descanso', 'principiantes', 'intermedio',    3, 18, 'bayo',           'Azteca'),
  ('Camelot', 'propietario', 'activo',   'intermedio',    'avanzado',      1, 10, 'castaño oscuro', 'Holsteiner'),
  ('Tornado', 'propietario', 'activo',   'intermedio',    'avanzado',      1,  7, 'tordillo',       'KWPN');

-- Plantilla semanal. Dos clases a la vez, una por pista. El maestro de cada
-- hora lo asigna dirección desde la app (queda en null a propósito).
-- dia: 0 domingo … 6 sábado. El lunes (1) no se monta.
insert into horarios (dia, hora, espacio_id, cupo, solo_propietarios)
select d.dia, h.hora, e.id, 6, d.dia = 0
from (values (2),(3),(4),(5)) as d(dia)
cross join (values ('07:00'::time),('08:00'),('09:00'),('16:00'),('17:00'),('18:00')) as h(hora)
cross join (values ('mty'),('equus')) as e(id);

insert into horarios (dia, hora, espacio_id, cupo, solo_propietarios)
select 6, h.hora, e.id, 6, false
from (values ('07:00'::time),('08:00'),('09:00'),('10:00')) as h(hora)
cross join (values ('mty'),('equus')) as e(id);

insert into horarios (dia, hora, espacio_id, cupo, solo_propietarios)
select 0, h.hora, e.id, 6, true
from (values ('07:00'::time),('08:00'),('09:00')) as h(hora)
cross join (values ('mty'),('equus')) as e(id);

-- Calendario de competencias.
insert into competencias (nombre, inicio, fin, sede, disciplina) values
  ('San Pedro',        '2026-09-17', '2026-09-20', 'San Pedro',              'Salto'),
  ('Paloma Blanca',    '2026-10-01', '2026-10-04', 'Paloma Blanca',          'Salto'),
  ('Hípico Monterrey', '2026-10-22', '2026-10-25', 'Club Hípico Monterrey',  'Salto'),
  ('Hípico La Silla',  '2026-11-02', '2026-11-15', 'Club Hípico La Silla',   'Salto');
-- Concurso Interclub de La Silla, sábado 12 de septiembre.
insert into competencias (nombre, inicio, fin, sede, disciplina, categorias, horarios, nota) values
  ('Concurso Interclub · La Silla', '2026-09-12', '2026-09-12',
   'Club Hípico La Silla', 'Salto',
   array['1.20 m','1.10 m','1.00 m','0.90 m','0.80 m','0.60 m'],
   array['Sábado 12 — Inicio a las 8:00 a.m.',
         '1.20 m y 1.10 m — Pista 2 Sierra Madre, césped (ría opcional)',
         '1.00 m, 0.90 m, 0.80 m y 0.60 m — Pista Techada, arena',
         'Cada prueba — Al término de la anterior'],
   '$950 por binomio, en efectivo o transferencia. Trofeo a los primeros tres lugares y moña cada cuatro binomios.');

-- Documentos. El texto es de muestra: dirección lo sustituye desde la app.
insert into documentos (titulo, version, vigente_desde, audiencia, obligatorio, resumen, orden, cuerpo) values
  ('Reglamento del club', '2.1', '2026-07-01', 'todos', true,
   'Normas de convivencia, uso de instalaciones, equipo obligatorio y horarios.', 0, '[]'::jsonb),
  ('Contrato de jinete', '1.4', '2026-07-01', 'jinete', true,
   'Deslinde de responsabilidad y condiciones de las clases.', 1, '[]'::jsonb),
  ('Contrato de pupilaje', '1.2', '2026-07-01', 'propietario', true,
   'Condiciones del servicio de pensión para caballos en el club.', 2, '[]'::jsonb),
  ('Carta responsiva de menor', '1.1', '2026-07-01', 'menor', true,
   'La firma el padre, madre o tutor que responde por el jinete menor de edad.', 3, '[]'::jsonb);
