-- ===========================================================================
-- Casa Quirón · reglas de acceso (Row Level Security)
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
