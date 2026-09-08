-- ===========================================================================
-- Equus · los datos del club
--
-- Lo que ya había en la app, tal cual, para no empezar de cero: 34 registros
-- sacados del almacén compartido el 8 de septiembre de 2026.
--
-- Correr DESPUÉS de almacen.sql. Se puede repetir cuantas veces haga falta: si
-- un registro ya está, se actualiza en vez de duplicarse.
--
-- Van sin contraseña y sin authId a propósito. En la base del club la
-- contraseña la revisa el servidor, no viaja en los datos; y la cuenta con la
-- que cada quien inicia sesión se crea desde la app, con el botón «Crear las
-- cuentas que faltan» que le sale a dirección. Así nadie tiene que manejar la
-- llave secreta del proyecto.
-- ===========================================================================

-- personas (10)
insert into almacen (coleccion, doc_id, datos) values
  ('personas', 'carllos', '{"clasesCargadas": 8, "habilitados": ["guero"], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "intermedio", "nombre": "Carlos", "paquete": "8 clases", "paqueteId": "p8", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": "", "usuario": "carlos"}'::jsonb),
  ('personas', 'edwin', '{"clasesCargadas": 0, "habilitados": [], "imparte": true, "menor": false, "nivel": "avanzado", "nombre": "Edwin", "paquete": "", "paqueteId": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "edwin"}'::jsonb),
  ('personas', 'felipe', '{"clasesCargadas": 0, "habilitados": [], "menor": false, "nivel": "avanzado", "nombre": "Felipe", "paquete": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "felipe"}'::jsonb),
  ('personas', 'katia', '{"clasesCargadas": 15, "habilitados": ["alazan"], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "avanzado", "nombre": "Katia", "paquete": "15 clases", "paqueteId": "p15", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": "", "usuario": "katia"}'::jsonb),
  ('personas', 'melisa', '{"clasesCargadas": 10, "habilitados": ["jazmin", "duende", "picaro"], "imparte": false, "maestroId": "edwin", "menor": false, "nivel": "principiantes", "nombre": "Melisa", "paquete": "10 clases", "paqueteId": "p10", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": "", "usuario": "melisa"}'::jsonb),
  ('personas', 'nicolas', '{"clasesCargadas": 0, "habilitados": [], "menor": false, "nivel": "avanzado", "nombre": "Nicolás", "paquete": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "nicolas"}'::jsonb),
  ('personas', 'paola', '{"clasesCargadas": 8, "habilitados": [], "imparte": false, "maestroId": "tania", "menor": false, "nivel": "intermedio", "nombre": "Paola", "paquete": "8 clases", "paqueteId": "p8", "propios": ["allegra"], "rol": "propietario", "sinCuenta": false, "tutorDe": "", "usuario": "paola"}'::jsonb),
  ('personas', 'romina', '{"clasesCargadas": 8, "habilitados": [], "imparte": false, "maestroId": "", "menor": false, "nivel": "avanzado", "nombre": "Romina Cardona", "paquete": "", "paqueteId": "", "propios": ["norte"], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "romina"}'::jsonb),
  ('personas', 'tania', '{"clasesCargadas": 0, "habilitados": [], "imparte": true, "maestroId": "", "menor": false, "nivel": "avanzado", "nombre": "Tania", "paquete": "", "paqueteId": "", "propios": [], "rol": "admin", "sinCuenta": false, "tutorDe": "", "usuario": "tania"}'::jsonb),
  ('personas', 'vale', '{"clasesCargadas": 4, "habilitados": ["duende", "nube"], "imparte": false, "maestroId": "edwin", "menor": false, "nivel": "cuerdita", "nombre": "Vale", "paquete": "4 clases", "paqueteId": "p4", "propios": [], "rol": "jinete", "sinCuenta": false, "tutorDe": "", "usuario": "vale"}'::jsonb)
on conflict (coleccion, doc_id) do update set datos = excluded.datos;

-- caballos (3)
insert into almacen (coleccion, doc_id, datos) values
  ('caballos', 'allegra', '{"autorizaEscuela": false, "capa": "", "edad": "", "estatus": "activo", "max": "avanzado", "maxDia": 1, "min": "avanzado", "nombre": "Allegra", "origen": "Paola", "uso": "propietario"}'::jsonb),
  ('caballos', 'guero', '{"autorizaEscuela": false, "capa": "palomino", "edad": "7", "estatus": "activo", "max": "intermedio", "maxDia": 2, "min": "principiantes", "nombre": "Güero", "origen": "", "uso": "escuelita"}'::jsonb),
  ('caballos', 'norte', '{"autorizaEscuela": false, "capa": "alazan", "edad": "8", "estatus": "activo", "max": "intermedio", "maxDia": 2, "min": "principiantes", "nombre": "Norte", "origen": "Romina Cardona", "uso": "propietario"}'::jsonb)
on conflict (coleccion, doc_id) do update set datos = excluded.datos;

-- paquetes (4)
insert into almacen (coleccion, doc_id, datos) values
  ('paquetes', 'p10', '{"clases": 10, "nombre": "10 clases", "vigencia": ""}'::jsonb),
  ('paquetes', 'p15', '{"clases": 15, "nombre": "15 clases", "vigencia": ""}'::jsonb),
  ('paquetes', 'p4', '{"clases": 4, "nombre": "4 clases", "vigencia": ""}'::jsonb),
  ('paquetes', 'p8', '{"clases": 8, "nombre": "8 clases", "vigencia": ""}'::jsonb)
on conflict (coleccion, doc_id) do update set datos = excluded.datos;

-- competencias (5)
insert into almacen (coleccion, doc_id, datos) values
  ('competencias', 'hipico-mty', '{"categorias": [], "cierre": "", "disciplina": "Salto", "fin": "2026-10-25", "horarios": [], "inicio": "2026-10-22", "nombre": "Hípico Monterrey", "nota": "", "sede": "Club Hípico Monterrey"}'::jsonb),
  ('competencias', 'interclub-la-silla', '{"categorias": ["1.20 m", "1.10 m", "1.00 m", "0.90 m", "0.80 m", "0.60 m"], "cierre": "", "disciplina": "Salto", "fin": "2026-09-12", "horarios": ["Sábado 12 — Inicio a las 8:00 a.m.", "1.20 m y 1.10 m — Pista 2 Sierra Madre, césped (ría opcional)", "1.00 m, 0.90 m, 0.80 m y 0.60 m — Pista Techada, arena", "Cada prueba — Al término de la anterior"], "inicio": "2026-09-12", "nombre": "Concurso Interclub · La Silla", "nota": "$950 por binomio, en efectivo o transferencia. Trofeo a los primeros tres lugares y moña cada cuatro binomios.", "sede": "Club Hípico La Silla"}'::jsonb),
  ('competencias', 'la-silla', '{"categorias": [], "cierre": "", "disciplina": "Salto", "fin": "2026-11-15", "horarios": [], "inicio": "2026-11-02", "nombre": "Hípico La Silla", "nota": "", "sede": "Club Hípico La Silla"}'::jsonb),
  ('competencias', 'paloma-blanca', '{"categorias": [], "cierre": "", "disciplina": "Salto", "fin": "2026-10-04", "horarios": [], "inicio": "2026-10-01", "nombre": "Paloma Blanca", "nota": "", "sede": "Paloma Blanca"}'::jsonb),
  ('competencias', 'san-pedro', '{"categorias": [], "cierre": "", "disciplina": "Salto", "fin": "2026-09-20", "horarios": [], "inicio": "2026-09-17", "nombre": "San Pedro", "nota": "", "sede": "San Pedro"}'::jsonb)
on conflict (coleccion, doc_id) do update set datos = excluded.datos;

-- horarios (1)
insert into almacen (coleccion, doc_id, datos) values
  ('horarios', 'd2-0900', '{"activo": true, "cupo": 6, "ent": "tania", "esp": "mty"}'::jsonb)
on conflict (coleccion, doc_id) do update set datos = excluded.datos;

-- documentos (4)
insert into almacen (coleccion, doc_id, datos) values
  ('documentos', 'contrato-jinete', '{"audiencia": "jinete", "cuerpo": [{"h": "Riesgo de la actividad", "l": ["La equitación es una actividad de riesgo. El jinete la practica por voluntad propia.", "El club no se hace responsable de incidentes derivados del incumplimiento del reglamento."]}, {"h": "Clases y saldo", "l": ["Las clases se pagan en las oficinas del club; no hay cobro en línea.", "El saldo lo carga dirección una vez recibido el pago.", "La vigencia del paquete la define dirección al cargarlo."]}, {"h": "Cancelaciones", "l": ["Cancelación sin costo hasta 10 horas antes del inicio de la clase.", "Después de ese límite la clase se cobra.", "No presentarse cuesta la clase igual que cancelar tarde."]}], "obligatorio": true, "orden": 1, "resumen": "Deslinde de responsabilidad y condiciones de las clases.", "titulo": "Contrato de jinete", "version": "1.4", "vigente": "1 de julio de 2026"}'::jsonb),
  ('documentos', 'contrato-pupilaje', '{"audiencia": "propietario", "cuerpo": [{"h": "Servicio incluido", "l": ["Caballeriza individual, cama, alimentación y agua limpia.", "Salida diaria al padock y revisión del equipo de cuadra."]}, {"h": "A cargo del propietario", "l": ["Herrador, veterinario, desparasitaciones y vacunas al corriente.", "Suplementos y electrolitos, entregados en la fecha del mes que marque el calendario.", "Equipo completo del caballo, identificado con su nombre."]}, {"h": "Uso del caballo", "l": ["El caballo no entra al pool de escuela salvo autorización expresa del propietario, revocable en cualquier momento.", "El club no monta ni trabaja al caballo sin acuerdo previo."]}, {"h": "Salida del club", "l": ["Avisar con 30 días de anticipación para dar de baja el pupilaje."]}], "obligatorio": true, "orden": 2, "resumen": "Condiciones del servicio de pensión para caballos en el club.", "titulo": "Contrato de pupilaje", "version": "1.2", "vigente": "1 de julio de 2026"}'::jsonb),
  ('documentos', 'reglamento', '{"audiencia": "todos", "cuerpo": [{"h": "Equipo obligatorio", "l": ["Casco homologado en todo momento sobre el caballo, sin excepción.", "Botas de montar y pantalón adecuado.", "Chaleco protector obligatorio en salto para menores de edad."]}, {"h": "Uso de instalaciones", "l": ["El acceso a caballerizas es solo con autorización del equipo de cuadra.", "La pista se libera puntualmente al terminar cada clase.", "Prohibido dar alimento a caballos que no sean propios."]}, {"h": "Horarios", "l": ["El lunes no hay clases: es el día en que se abre la agenda de la semana.", "Jinetes de escuela: de martes a sábado.", "Propietarios: de martes a domingo.", "Todos los horarios están abiertos para cualquier nivel.", "Presentarse 15 minutos antes de la clase para ensillar."]}, {"h": "Convivencia", "l": ["Trato respetuoso con personal, jinetes y caballos.", "El incumplimiento del reglamento puede derivar en suspensión temporal."]}], "obligatorio": true, "orden": 0, "resumen": "Normas de convivencia, uso de instalaciones, equipo obligatorio y horarios.", "titulo": "Reglamento del club", "version": "2.1", "vigente": "1 de julio de 2026"}'::jsonb),
  ('documentos', 'responsiva-menor', '{"audiencia": "menor", "cuerpo": [{"h": "Quién responde", "l": ["El tutor que firma responde por el menor dentro de las instalaciones.", "El tutor acepta el reglamento y el contrato de jinete en nombre del menor."]}, {"h": "Autorización médica", "l": ["El tutor autoriza la atención médica de urgencia si hiciera falta.", "Datos de contacto y alergias del menor entregados a dirección y actualizados."]}, {"h": "Acompañamiento", "l": ["El menor no permanece solo en las instalaciones.", "Chaleco protector obligatorio en salto."]}], "obligatorio": true, "orden": 3, "resumen": "La firma el padre, madre o tutor que responde por el jinete menor de edad.", "titulo": "Carta responsiva de menor", "version": "1.1", "vigente": "1 de julio de 2026"}'::jsonb)
on conflict (coleccion, doc_id) do update set datos = excluded.datos;

-- reservas (7)
insert into almacen (coleccion, doc_id, datos) values
  ('reservas', '2026-09-08__d2-0800-tania__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-07T19:34:46.577Z", "ent": "tania", "esp": "mty", "fecha": "2026-09-08", "hora": "08:00", "movidaPor": "romina", "override": false, "personaId": "carllos", "plantillaId": "d2-0800-tania", "reservadaPor": "carllos", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-08__d2-1700-edwin__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-08T16:43:57.245Z", "ent": "edwin", "esp": "equus", "fecha": "2026-09-08", "hora": "17:00", "personaId": "carllos", "plantillaId": "d2-1700-edwin", "reservadaPor": "romina", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-09__d3-0800-edwin__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-07T19:34:59.568Z", "ent": "edwin", "esp": "equus", "fecha": "2026-09-09", "hora": "08:00", "override": false, "personaId": "carllos", "plantillaId": "d3-0800-edwin", "reservadaPor": "carllos", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-09__d3-1600-tania__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-08T19:55:57.787Z", "ent": "tania", "esp": "mty", "fecha": "2026-09-09", "hora": "16:00", "personaId": "carllos", "plantillaId": "d3-1600-tania", "reservadaPor": "tania", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-10__d4-0800-edwin__guero', '{"caballoId": "guero", "consume": 1, "creada": "2026-09-07T19:35:03.913Z", "ent": "edwin", "esp": "equus", "fecha": "2026-09-10", "hora": "08:00", "override": false, "personaId": "carllos", "plantillaId": "d4-0800-edwin", "reservadaPor": "carllos", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-10__d4-0800-tania__allegra', '{"caballoId": "allegra", "consume": 1, "creada": "2026-09-08T19:56:09.869Z", "ent": "tania", "esp": "mty", "fecha": "2026-09-10", "hora": "08:00", "personaId": "paola", "plantillaId": "d4-0800-tania", "reservadaPor": "tania", "tipoId": "escuela"}'::jsonb),
  ('reservas', '2026-09-11__d5-0900-tania__allegra', '{"caballoId": "allegra", "consume": 1, "creada": "2026-09-08T19:56:16.373Z", "ent": "tania", "esp": "mty", "fecha": "2026-09-11", "hora": "09:00", "personaId": "paola", "plantillaId": "d5-0900-tania", "reservadaPor": "tania", "tipoId": "escuela"}'::jsonb)
on conflict (coleccion, doc_id) do update set datos = excluded.datos;
