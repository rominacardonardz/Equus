-- ===========================================================================
-- Casa Quirón · esquema de la base de datos
-- PostgreSQL / Supabase. Ejecutar primero este archivo, luego 02-seguridad.sql.
--
-- En Supabase, el esquema `auth` y la tabla `auth.users` ya existen: los crea
-- Supabase al dar de alta el proyecto. Aquí no se tocan.
-- ===========================================================================

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
  auth_id           uuid unique,             -- references auth.users(id) en Supabase
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
