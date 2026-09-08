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
