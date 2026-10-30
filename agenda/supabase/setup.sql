-- =====================================================================
-- Equus · Agenda de alumnos — base de datos en Supabase
-- Cópialo completo en Supabase → SQL Editor → New query → Run.
-- Se puede correr otra vez sin problema.
-- =====================================================================

-- Quién puede entrar a la agenda. Solo estos correos ven y guardan datos.
create table if not exists public.editores (
  email  text primary key,
  nombre text not null,
  dueno  boolean not null default false   -- la dueña conecta Google Drive
);

-- Todos los datos de la agenda: un renglón por documento, con la misma
-- ruta que usaba la versión de claude.ai (maestros/tania/alumnos/<id>, etc.).
create table if not exists public.docs (
  path       text primary key,
  coleccion  text generated always as (regexp_replace(path, '/[^/]+$', '')) stored,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create index if not exists docs_coleccion on public.docs (coleccion);

-- ¿El correo de la sesión está en la lista de editores?
create or replace function public.es_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editores where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

alter table public.editores enable row level security;
alter table public.docs enable row level security;

drop policy if exists "editores se ven entre si" on public.editores;
create policy "editores se ven entre si" on public.editores for select using (public.es_editor());

drop policy if exists "editores leen" on public.docs;
drop policy if exists "editores agregan" on public.docs;
drop policy if exists "editores cambian" on public.docs;
drop policy if exists "editores borran" on public.docs;
create policy "editores leen"    on public.docs for select using (public.es_editor());
create policy "editores agregan" on public.docs for insert with check (public.es_editor());
create policy "editores cambian" on public.docs for update using (public.es_editor()) with check (public.es_editor());
create policy "editores borran"  on public.docs for delete using (public.es_editor());

-- Para que los cambios de Tania aparezcan solos en el celular de Edwin y viceversa.
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Comprobantes de pago (fotos y PDF), privados.
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;
drop policy if exists "comprobantes leer" on storage.objects;
drop policy if exists "comprobantes subir" on storage.objects;
drop policy if exists "comprobantes borrar" on storage.objects;
create policy "comprobantes leer"   on storage.objects for select using (bucket_id = 'comprobantes' and public.es_editor());
create policy "comprobantes subir"  on storage.objects for insert with check (bucket_id = 'comprobantes' and public.es_editor());
create policy "comprobantes borrar" on storage.objects for delete using (bucket_id = 'comprobantes' and public.es_editor());

-- =====================================================================
-- Quién entra. Cambia TU_CORREO por tu correo.
-- Tania y Edwin comparten el correo de Hípico Equus: entran con el mismo
-- código y cada uno escoge su perfil (Tania o Edwin) en la portada.
-- =====================================================================
insert into public.editores (email, nombre, dueno) values
  ('TU_CORREO@ejemplo.com', 'Romina', true),
  ('hipicoequus@icloud.com', 'Tania y Edwin', false)
on conflict (email) do update set nombre = excluded.nombre, dueno = excluded.dueno;
