-- ===========================================================================
-- Equus · los datos del club
--
-- Lo que ya había en la app, tal cual: 30 registros. Correr DESPUÉS de
-- almacen.sql. Se puede repetir: si un registro ya está, se actualiza.
--
-- Solo el personal —Tania, Edwin, Romina, Nicolás y Felipe— lleva usuario y la
-- huella de la contraseña (la huella, no la contraseña): el servidor la
-- necesita para enganchar cada cuenta con su ficha la primera vez que alguien
-- entra. Van sin authId a propósito: eso lo pone ese enganche.
--
-- Los clientes NO llevan usuario ni contraseña. Un cliente es una ficha con
-- sus clases y su caballo; no entra a la página, su semana la maneja su
-- maestro. Por eso crear_accesos_faltantes() solo les da cuenta a los cinco.
-- ===========================================================================

-- personas (10)
insert into almacen (coleccion, doc_id, datos) values
  ('personas', 'carllos', '{"clasesCargadas": 8, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": ["guero"], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "intermedio", "nombre": "Carlos", "paquete": "8 clases", "paqueteId": "p8", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": ""}'::jsonb),
  ('personas', 'edwin', '{"clasesCargadas": 0, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "imparte": true, "menor": false, "nivel": "avanzado", "nombre": "Edwin", "paquete": "", "paqueteId": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "edwin"}'::jsonb),
  ('personas', 'felipe', '{"clasesCargadas": 0, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "menor": false, "nivel": "avanzado", "nombre": "Felipe", "paquete": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "felipe"}'::jsonb),
  ('personas', 'katia', '{"clasesCargadas": 15, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": ["alazan"], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "avanzado", "nombre": "Katia", "paquete": "15 clases", "paqueteId": "p15", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": ""}'::jsonb),
  ('personas', 'melisa', '{"clasesCargadas": 10, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": ["jazmin", "duende", "picaro"], "imparte": false, "maestroId": "edwin", "menor": false, "nivel": "principiantes", "nombre": "Melisa", "paquete": "10 clases", "paqueteId": "p10", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": ""}'::jsonb),
  ('personas', 'nicolas', '{"clasesCargadas": 0, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "menor": false, "nivel": "avanzado", "nombre": "Nicolás", "paquete": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "nicolas"}'::jsonb),
  ('personas', 'paola', '{"clasesCargadas": 8, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "intermedio", "nombre": "Paola", "paquete": "8 clases", "paqueteId": "p8", "propios": ["allegra"], "rol": "propietario", "sinCuenta": false, "tutorDe": ""}'::jsonb),
  ('personas', 'romina', '{"clasesCargadas": 8, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "imparte": false, "maestroId": "", "menor": false, "nivel": "avanzado", "nombre": "Romina Cardona", "paquete": "", "paqueteId": "", "propios": ["norte"], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "romina"}'::jsonb),
  ('personas', 'tania', '{"clasesCargadas": 0, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": [], "imparte": true, "maestroId": "", "menor": false, "nivel": "avanzado", "nombre": "Tania", "paquete": "", "paqueteId": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "tania"}'::jsonb),
  ('personas', 'vale', '{"clasesCargadas": 4, "clave": "04ff2c93496abb8ca0978928a00bd08d4e062e92f499791edf61df9d2e7ad619", "habilitados": ["duende", "nube"], "imparte": false, "maestroId": "edwin", "menor": false, "nivel": "cuerdita", "nombre": "Vale", "paquete": "4 clases", "paqueteId": "p4", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": ""}'::jsonb)
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
