-- Synthetic PQRSD demo seed.
-- All people, contact details, radicados, and situations are synthetic.
-- Loaded by Supabase after migrations because supabase/config.toml points here.

begin;

-- =============================================================================
-- Demo functionaries
-- =============================================================================

with seed_functionaries (id, email, nombre, role, secretaria_codigo) as (
  values
    ('10000000-0000-0000-0000-000000000001', 'juridica.pqrs@medellin.gov.test', 'Equipo Juridico PQRSD', 'juridica', null),
    ('10000000-0000-0000-0000-000000000002', 'camila.ramirez@medellin.gov.test', 'Camila Ramirez', 'funcionario', 'SINF'),
    ('10000000-0000-0000-0000-000000000003', 'diego.moreno@medellin.gov.test', 'Diego Moreno', 'funcionario', 'SMOV'),
    ('10000000-0000-0000-0000-000000000004', 'laura.gomez@medellin.gov.test', 'Laura Gomez', 'funcionario', 'SSAL'),
    ('10000000-0000-0000-0000-000000000005', 'martin.ospina@medellin.gov.test', 'Martin Ospina', 'director', 'SDE'),
    ('10000000-0000-0000-0000-000000000006', 'paula.arango@medellin.gov.test', 'Paula Arango', 'funcionario', 'SSEG'),
    ('10000000-0000-0000-0000-000000000007', 'andres.velez@medellin.gov.test', 'Andres Velez', 'funcionario', 'SMAM'),
    ('10000000-0000-0000-0000-000000000008', 'valentina.ruiz@medellin.gov.test', 'Valentina Ruiz', 'funcionario', 'SEDU')
)
insert into public.functionaries (
  id,
  tenant_id,
  secretaria_id,
  email,
  nombre,
  role,
  active
)
select
  sf.id::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  s.id,
  sf.email,
  sf.nombre,
  sf.role,
  true
from seed_functionaries sf
left join public.secretarias s
  on s.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
 and s.codigo = sf.secretaria_codigo
on conflict (id) do update
set
  secretaria_id = excluded.secretaria_id,
  email = excluded.email,
  nombre = excluded.nombre,
  role = excluded.role,
  active = excluded.active
where
  public.functionaries.secretaria_id is distinct from excluded.secretaria_id
  or public.functionaries.email is distinct from excluded.email
  or public.functionaries.nombre is distinct from excluded.nombre
  or public.functionaries.role is distinct from excluded.role
  or public.functionaries.active is distinct from excluded.active;

-- =============================================================================
-- Demo citizens
-- =============================================================================

with seed_citizens (
  id,
  cedula,
  email,
  nombre,
  telefono,
  direccion,
  vulnerability_flags
) as (
  values
    ('20000000-0000-0000-0000-000000000001', '900000001', 'maria.torres@example.test', 'Maria Torres', '3000000001', 'Carrera 99 # 44-12', '{"adulto_mayor": true, "salud_cronica": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000002', '900000002', 'jhon.mejia@example.test', 'Jhon Mejia', '3000000002', 'Calle 53 # 29-40', '{"riesgo_habitacional": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000003', '900000003', 'lina.osorio@example.test', 'Lina Osorio', '3000000003', 'Carrera 50 # 48-22', '{"denunciante": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000004', '900000004', 'santiago.cano@example.test', 'Santiago Cano', '3000000004', 'Circular 1 # 72-15', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000005', '900000005', 'ana.salazar@example.test', 'Ana Salazar', '3000000005', 'Carrera 43A # 10-20', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000006', '900000006', 'hector.marin@example.test', 'Hector Marin', '3000000006', 'Calle 78B # 80-18', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000007', '900000007', 'paola.restrepo@example.test', 'Paola Restrepo', '3000000007', 'Calle 104 # 73-11', '{"menor_a_cargo": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000008', '900000008', 'oscar.garcia@example.test', 'Oscar Garcia', '3000000008', 'Carrera 49 # 52-60', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000009', '900000009', 'natalia.arias@example.test', 'Natalia Arias', '3000000009', 'Calle 92 # 50-14', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000010', '900000010', 'ricardo.rua@example.test', 'Ricardo Rua', '3000000010', 'Carrera 45 # 67-08', '{"lider_comunitario": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000011', '900000011', 'yuliana.perez@example.test', 'Yuliana Perez', '3000000011', 'Calle 108 # 32-16', '{"madre_cabeza_hogar": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000012', '900000012', 'carlos.mesa@example.test', 'Carlos Mesa', '3000000012', 'Calle 30A # 76-45', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000013', '900000013', 'gloria.uribe@example.test', 'Gloria Uribe', '3000000013', 'Calle 44 # 88-30', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000014', '900000014', 'manuel.quintero@example.test', 'Manuel Quintero', '3000000014', 'Carrera 65 # 96-20', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000015', '900000015', 'juliana.henao@example.test', 'Juliana Henao', '3000000015', 'Calle 107 # 49-15', '{}'::jsonb),
    ('20000000-0000-0000-0000-000000000016', '900000016', 'elkin.zapata@example.test', 'Elkin Zapata', '3000000016', 'Vereda La Verde, San Antonio de Prado', '{"zona_rural": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000017', '900000017', 'diana.munoz@example.test', 'Diana Munoz', '3000000017', 'Carrera 53 # 46-31', '{"comerciante": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000018', '900000018', 'robinson.lopez@example.test', 'Robinson Lopez', '3000000018', 'Calle 9 Sur # 52-22', '{}'::jsonb)
)
insert into public.citizens (
  id,
  tenant_id,
  cedula,
  email,
  nombre,
  telefono,
  direccion,
  vulnerability_flags,
  email_verified
)
select
  sc.id::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  sc.cedula,
  sc.email,
  sc.nombre,
  sc.telefono,
  sc.direccion,
  sc.vulnerability_flags,
  true
from seed_citizens sc
on conflict (id) do update
set
  cedula = excluded.cedula,
  email = excluded.email,
  nombre = excluded.nombre,
  telefono = excluded.telefono,
  direccion = excluded.direccion,
  vulnerability_flags = excluded.vulnerability_flags,
  email_verified = excluded.email_verified
where
  public.citizens.cedula is distinct from excluded.cedula
  or public.citizens.email is distinct from excluded.email
  or public.citizens.nombre is distinct from excluded.nombre
  or public.citizens.telefono is distinct from excluded.telefono
  or public.citizens.direccion is distinct from excluded.direccion
  or public.citizens.vulnerability_flags is distinct from excluded.vulnerability_flags
  or public.citizens.email_verified is distinct from excluded.email_verified;

-- =============================================================================
-- Synthetic PQRSD cases
-- =============================================================================

with seed_pqrs (
  id,
  citizen_id,
  radicado,
  source_hash,
  tipo,
  channel,
  status,
  classification_status,
  hechos,
  peticion,
  lead,
  discriminacion_tematica,
  secretaria_codigo,
  comuna_numero,
  captured_by_id,
  estructura_minima,
  respeto_ok,
  anonimato,
  tutela_risk_score,
  issued_at,
  legal_deadline,
  priority_level,
  priority_score,
  priority_reason,
  priority_locked_by_id,
  updated_at
) as (
  values
    (
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'MED-20260418-000001',
      'synthetic-pqrs:001',
      'peticion',
      'web',
      'assigned',
      'classified',
      'La ciudadana informa que su formula de medicamento para hipertension fue autorizada hace tres semanas, pero el punto de entrega no registra disponibilidad. Indica mareos recientes y dependencia economica de un familiar.',
      'Solicita gestion prioritaria para entrega del medicamento y orientacion sobre el punto de atencion habilitado.',
      'Adulto mayor reporta falta de entrega de medicamento cronico autorizado.',
      '[{"namespace":"tema","slug":"salud","confidence":0.96},{"namespace":"vulnerabilidad","slug":"adulto_mayor","confidence":0.91}]'::jsonb,
      'SSAL',
      13,
      '10000000-0000-0000-0000-000000000004',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.92,
      now() - interval '5 days',
      now() - interval '1 day',
      'P0_critica',
      96.5,
      '{"signals":["adulto_mayor","salud_cronica","deadline_overdue"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000001',
      now() - interval '1 day'
    ),
    (
      '30000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      'MED-20260418-000002',
      'synthetic-pqrs:002',
      'denuncia',
      'social_manual',
      'received',
      'classified',
      'Vecinos de Villa Hermosa reportan grietas visibles en un muro de contencion junto a una vivienda despues de lluvias fuertes. Afirman que hay filtraciones y desprendimiento de material hacia una escalera peatonal.',
      'Solicitan visita tecnica urgente y cierre preventivo si el riesgo es confirmado.',
      'Posible riesgo estructural por muro de contencion con grietas y filtraciones.',
      '[{"namespace":"tema","slug":"gestion_riesgo","confidence":0.97},{"namespace":"infraestructura","slug":"muro_contencion","confidence":0.89}]'::jsonb,
      'DAGRD',
      8,
      '10000000-0000-0000-0000-000000000002',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.88,
      now() - interval '11 hours',
      now() + interval '12 hours',
      'P0_critica',
      94.2,
      '{"signals":["riesgo_habitacional","lluvias","seguridad_vital"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000001',
      now() - interval '10 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000003',
      'MED-20260418-000003',
      'synthetic-pqrs:003',
      'denuncia',
      'verbal',
      'in_review',
      'classified',
      'La solicitante informa amenazas recurrentes a comerciantes cerca de una institucion educativa del centro. Manifiesta temor de represalias y pide reserva de sus datos personales.',
      'Pide intervencion coordinada de seguridad, orientacion para denuncia formal y proteccion de identidad.',
      'Denuncia de amenazas a comerciantes cerca de colegio en La Candelaria.',
      '[{"namespace":"tema","slug":"seguridad","confidence":0.95},{"namespace":"actor","slug":"comerciantes","confidence":0.84}]'::jsonb,
      'SSEG',
      10,
      '10000000-0000-0000-0000-000000000006',
      '{"hechos": true, "peticion": true, "contacto": true, "reserva_identidad": true}'::jsonb,
      true,
      false,
      0.9,
      now() - interval '4 days',
      now() - interval '8 hours',
      'P0_critica',
      91.0,
      '{"signals":["amenazas","reserva_identidad","entorno_escolar"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000001',
      now() - interval '3 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000004',
      '20000000-0000-0000-0000-000000000004',
      'MED-20260418-000004',
      'synthetic-pqrs:004',
      'oposicion',
      'web',
      'assigned',
      'classified',
      'En Laureles-Estadio hay un hueco profundo en la calzada de la Circular 1. Usuarios reportan dos caidas de motociclistas durante la ultima semana y ausencia de senalizacion temporal.',
      'Solicita reparacion de la carpeta asfaltica y senalizacion mientras se programa la intervencion.',
      'Hueco profundo en corredor vial de Laureles genera riesgo para motociclistas.',
      '[{"namespace":"tema","slug":"malla_vial","confidence":0.94},{"namespace":"infraestructura","slug":"hueco","confidence":0.93}]'::jsonb,
      'SINF',
      11,
      '10000000-0000-0000-0000-000000000002',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.34,
      now() - interval '2 days',
      now() + interval '2 days',
      'P1_alta',
      85.0,
      '{"signals":["riesgo_vial","incidentes_reportados"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000002',
      now() - interval '20 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000005',
      '20000000-0000-0000-0000-000000000005',
      'MED-20260418-000005',
      'synthetic-pqrs:005',
      'queja',
      'email',
      'accepted',
      'classified',
      'El semaforo peatonal ubicado cerca de una estacion de transporte masivo en El Poblado permanece intermitente desde el viernes. En horas pico los peatones cruzan sin indicacion clara.',
      'Solicita revision tecnica y priorizacion por alto flujo peatonal.',
      'Semaforo peatonal intermitente en zona de alto flujo.',
      '[{"namespace":"tema","slug":"movilidad","confidence":0.93},{"namespace":"infraestructura","slug":"semaforo","confidence":0.92}]'::jsonb,
      'SMOV',
      14,
      '10000000-0000-0000-0000-000000000003',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.26,
      now() - interval '18 hours',
      now() + interval '1 day',
      'P1_alta',
      82.0,
      '{"signals":["alto_flujo","riesgo_peatonal"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000003',
      now() - interval '14 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000006',
      '20000000-0000-0000-0000-000000000006',
      'MED-20260418-000006',
      'synthetic-pqrs:006',
      'denuncia',
      'web',
      'in_draft',
      'classified',
      'Residentes de Robledo informan tala de varios arboles junto a una quebrada sin aviso visible de permiso ambiental. Tambien reportan disposicion de residuos de poda en el cauce.',
      'Solicitan verificacion de permisos, retiro de residuos y respuesta sobre medidas de compensacion.',
      'Denuncia por posible tala no autorizada y residuos en quebrada.',
      '[{"namespace":"tema","slug":"ambiente","confidence":0.95},{"namespace":"infraestructura","slug":"quebrada","confidence":0.82}]'::jsonb,
      'SMAM',
      7,
      '10000000-0000-0000-0000-000000000007',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.2,
      now() - interval '3 days',
      now() + interval '4 days',
      'P1_alta',
      78.0,
      '{"signals":["afectacion_ambiental","cauce"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000007',
      now() - interval '10 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000007',
      '20000000-0000-0000-0000-000000000007',
      'MED-20260418-000007',
      'synthetic-pqrs:007',
      'peticion',
      'web',
      'assigned',
      'classified',
      'Madre de familia de Doce de Octubre reporta que la ruta escolar asignada dejo de recoger a su hijo hace ocho dias. El menor camina un trayecto largo y cruza una avenida de alto trafico.',
      'Solicita restablecer la ruta o indicar alternativa segura mientras se resuelve la novedad contractual.',
      'Interrupcion de ruta escolar expone a menor a trayecto inseguro.',
      '[{"namespace":"tema","slug":"educacion","confidence":0.94},{"namespace":"vulnerabilidad","slug":"menor_edad","confidence":0.9}]'::jsonb,
      'SEDU',
      6,
      '10000000-0000-0000-0000-000000000008',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.62,
      now() - interval '7 days',
      now() - interval '1 day',
      'P1_alta',
      76.0,
      '{"signals":["menor_a_cargo","ruta_escolar","deadline_overdue"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000008',
      now() - interval '2 days'
    ),
    (
      '30000000-0000-0000-0000-000000000008',
      '20000000-0000-0000-0000-000000000008',
      'MED-20260418-000008',
      'synthetic-pqrs:008',
      'peticion',
      'verbal',
      'approved',
      'classified',
      'Comerciante de La Candelaria solicita claridad sobre requisitos para participar en una feria temporal de emprendimiento y el procedimiento para usar espacio publico autorizado.',
      'Pide listado de requisitos, fechas de postulacion y canal de radicacion de documentos.',
      'Solicitud de informacion para permiso temporal de feria de emprendimiento.',
      '[{"namespace":"tema","slug":"desarrollo_economico","confidence":0.92},{"namespace":"actor","slug":"comerciante","confidence":0.85}]'::jsonb,
      'SDE',
      10,
      '10000000-0000-0000-0000-000000000005',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.08,
      now() - interval '6 days',
      now() + interval '5 days',
      'P2_media',
      66.0,
      '{"signals":["tramite_economico","informacion_publica"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000005',
      now() - interval '9 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000009',
      '20000000-0000-0000-0000-000000000009',
      'MED-20260418-000009',
      'synthetic-pqrs:009',
      'sugerencia',
      'email',
      'accepted',
      'classified',
      'Una usuaria de Aranjuez propone ampliar el horario de talleres culturales para jovenes porque muchos asistentes salen tarde de estudiar. Adjunta lista de interesados del barrio.',
      'Solicita evaluar un piloto de talleres nocturnos o sabatinos en la biblioteca comunitaria.',
      'Sugerencia para ampliar horarios de talleres culturales juveniles.',
      '[{"namespace":"tema","slug":"cultura","confidence":0.91},{"namespace":"actor","slug":"jovenes","confidence":0.78}]'::jsonb,
      'SCUL',
      4,
      '10000000-0000-0000-0000-000000000008',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.04,
      now() - interval '16 hours',
      now() + interval '9 days',
      'P3_baja',
      42.0,
      '{"signals":["sugerencia_servicio","bajo_riesgo"],"seed":true}'::jsonb,
      null,
      now() - interval '15 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000010',
      '20000000-0000-0000-0000-000000000010',
      'MED-20260418-000010',
      'synthetic-pqrs:010',
      'peticion',
      'web',
      'received',
      'classified',
      'Lider comunitario de Manrique pide acompanamiento para actualizar la documentacion de una junta de accion comunal. Indica que el proceso anterior quedo incompleto por cambio de dignatarios.',
      'Solicita agenda de asesoria y requisitos para radicar la actualizacion.',
      'Junta de accion comunal solicita acompanamiento para actualizacion documental.',
      '[{"namespace":"tema","slug":"participacion","confidence":0.93},{"namespace":"actor","slug":"jac","confidence":0.88}]'::jsonb,
      'SPAR',
      3,
      '10000000-0000-0000-0000-000000000005',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.11,
      now() - interval '6 hours',
      now() + interval '11 days',
      'P2_media',
      58.0,
      '{"signals":["organizacion_comunitaria"],"seed":true}'::jsonb,
      null,
      now() - interval '5 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000011',
      '20000000-0000-0000-0000-000000000011',
      'MED-20260418-000011',
      'synthetic-pqrs:011',
      'peticion',
      'web',
      'assigned',
      'classified',
      'Madre cabeza de hogar en Popular informa que fue retirada de un listado de apoyo alimentario sin explicacion. Indica que tiene dos menores a cargo y no cuenta con ingresos estables.',
      'Solicita revisar su caso, explicar el motivo de retiro y orientar ruta de restablecimiento si aplica.',
      'Solicitud de revision de apoyo alimentario para hogar vulnerable.',
      '[{"namespace":"tema","slug":"inclusion_social","confidence":0.95},{"namespace":"vulnerabilidad","slug":"madre_cabeza_hogar","confidence":0.9}]'::jsonb,
      'SINC',
      1,
      '10000000-0000-0000-0000-000000000001',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.72,
      now() - interval '9 days',
      now() - interval '2 days',
      'P1_alta',
      80.0,
      '{"signals":["madre_cabeza_hogar","seguridad_alimentaria","deadline_overdue"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000001',
      now() - interval '2 days'
    ),
    (
      '30000000-0000-0000-0000-000000000012',
      '20000000-0000-0000-0000-000000000012',
      'MED-20260418-000012',
      'synthetic-pqrs:012',
      'reclamo',
      'email',
      'in_review',
      'classified',
      'Propietario en Belen manifiesta que el recibo de impuesto predial refleja una deuda ya pagada. Adjunta soporte bancario y numero de referencia del pago.',
      'Solicita conciliacion del pago y correccion del estado de cuenta.',
      'Reclamo por pago predial no reflejado en estado de cuenta.',
      '[{"namespace":"tema","slug":"hacienda","confidence":0.94},{"namespace":"tramite","slug":"predial","confidence":0.89}]'::jsonb,
      'SHAC',
      16,
      '10000000-0000-0000-0000-000000000001',
      '{"hechos": true, "peticion": true, "contacto": true, "adjuntos": true}'::jsonb,
      true,
      false,
      0.13,
      now() - interval '8 days',
      now() + interval '3 days',
      'P2_media',
      60.0,
      '{"signals":["soporte_pago","tramite_financiero"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000001',
      now() - interval '12 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000013',
      '20000000-0000-0000-0000-000000000013',
      'MED-20260418-000013',
      'synthetic-pqrs:013',
      'queja',
      'web',
      'accepted',
      'classified',
      'La ciudadana reporta que el portal de pagos municipales muestra error al finalizar transacciones con tarjeta. Intento tres veces y recibio mensajes de timeout.',
      'Solicita revision de disponibilidad del portal y confirmacion de que no existan cargos duplicados.',
      'Queja por fallas intermitentes en portal de pagos municipales.',
      '[{"namespace":"tema","slug":"innovacion_digital","confidence":0.92},{"namespace":"canal","slug":"portal_web","confidence":0.9}]'::jsonb,
      'SIND',
      12,
      '10000000-0000-0000-0000-000000000003',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.09,
      now() - interval '1 day',
      now() + interval '7 days',
      'P2_media',
      54.0,
      '{"signals":["servicio_digital","posible_cargo"],"seed":true}'::jsonb,
      null,
      now() - interval '23 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000014',
      '20000000-0000-0000-0000-000000000014',
      'MED-20260418-000014',
      'synthetic-pqrs:014',
      'sugerencia',
      'web',
      'received',
      'classified',
      'Un ciudadano de Castilla sugiere actualizar en la pagina institucional los horarios de atencion de una sede descentralizada. Indica que varias personas llegaron fuera del horario real.',
      'Solicita validar y publicar horarios actualizados en la web y canales oficiales.',
      'Sugerencia para corregir horarios de atencion publicados en canales digitales.',
      '[{"namespace":"tema","slug":"comunicaciones","confidence":0.9},{"namespace":"canal","slug":"web","confidence":0.87}]'::jsonb,
      'SCOM',
      5,
      '10000000-0000-0000-0000-000000000001',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.03,
      now() - interval '2 hours',
      now() + interval '14 days',
      'P3_baja',
      35.0,
      '{"signals":["actualizacion_contenido","bajo_riesgo"],"seed":true}'::jsonb,
      null,
      now() - interval '2 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000015',
      '20000000-0000-0000-0000-000000000015',
      'MED-20260418-000015',
      'synthetic-pqrs:015',
      'queja',
      'verbal',
      'in_draft',
      'classified',
      'La usuaria manifiesta que en un punto de atencion Mas Cerca no recibio orientacion clara sobre un tramite y fue remitida entre ventanillas durante mas de una hora.',
      'Solicita respuesta sobre protocolo de atencion y medidas para evitar remisiones contradictorias.',
      'Queja por orientacion inconsistente en punto de atencion ciudadana.',
      '[{"namespace":"tema","slug":"servicio_ciudadano","confidence":0.94},{"namespace":"sentimiento","slug":"insatisfaccion","confidence":0.79}]'::jsonb,
      'SGHS',
      2,
      '10000000-0000-0000-0000-000000000001',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.1,
      now() - interval '3 days',
      now() + interval '6 days',
      'P2_media',
      52.0,
      '{"signals":["calidad_servicio","orientacion"],"seed":true}'::jsonb,
      null,
      now() - interval '8 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000016',
      '20000000-0000-0000-0000-000000000016',
      'MED-20260418-000016',
      'synthetic-pqrs:016',
      'reclamo',
      'mercurio_csv',
      'assigned',
      'classified',
      'Habitantes de una vereda de San Antonio de Prado reportan perdida de banca en una via rural despues de lluvias. El paso de vehiculos de abastecimiento esta restringido.',
      'Solicitan visita tecnica, manejo de aguas y programacion de reparacion prioritaria.',
      'Via rural con perdida de banca afecta abastecimiento en corregimiento.',
      '[{"namespace":"tema","slug":"corregimientos","confidence":0.93},{"namespace":"infraestructura","slug":"via_rural","confidence":0.9}]'::jsonb,
      'GCOR',
      80,
      '10000000-0000-0000-0000-000000000002',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.42,
      now() - interval '4 days',
      now() + interval '1 day',
      'P1_alta',
      83.0,
      '{"signals":["zona_rural","afectacion_abastecimiento"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000002',
      now() - interval '1 day'
    ),
    (
      '30000000-0000-0000-0000-000000000017',
      '20000000-0000-0000-0000-000000000017',
      'MED-20260418-000017',
      'synthetic-pqrs:017',
      'denuncia',
      'social_manual',
      'in_review',
      'classified',
      'Comerciantes del centro reportan ocupacion recurrente de accesos por ventas informales y conflictos verbales durante la noche. Indican afectacion al ingreso de clientes.',
      'Solicitan presencia institucional y mesa de concertacion para ordenar el espacio publico.',
      'Comerciantes del centro piden intervencion por conflictos de espacio publico.',
      '[{"namespace":"tema","slug":"centro","confidence":0.94},{"namespace":"tema","slug":"convivencia","confidence":0.85}]'::jsonb,
      'GCEN',
      10,
      '10000000-0000-0000-0000-000000000006',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.32,
      now() - interval '5 days',
      now() + interval '2 days',
      'P1_alta',
      74.0,
      '{"signals":["espacio_publico","conflicto_convivencia"],"seed":true}'::jsonb,
      '10000000-0000-0000-0000-000000000006',
      now() - interval '6 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000018',
      '20000000-0000-0000-0000-000000000018',
      'MED-20260418-000018',
      'synthetic-pqrs:018',
      'peticion',
      'web',
      'accepted',
      'classified',
      'Residentes de Guayabal informan que tres luminarias de un tramo peatonal permanecen apagadas hace dos semanas, lo que aumenta la percepcion de inseguridad en la noche.',
      'Solicitan diagnostico, reparacion de luminarias y respuesta sobre entidad competente si requiere traslado.',
      'Luminarias apagadas en tramo peatonal de Guayabal.',
      '[{"namespace":"tema","slug":"infraestructura","confidence":0.9},{"namespace":"infraestructura","slug":"luminaria","confidence":0.91}]'::jsonb,
      'SINF',
      15,
      '10000000-0000-0000-0000-000000000002',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.18,
      now() - interval '1 day',
      now() + interval '8 days',
      'P2_media',
      57.0,
      '{"signals":["luminarias","seguridad_percibida"],"seed":true}'::jsonb,
      null,
      now() - interval '21 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000019',
      '20000000-0000-0000-0000-000000000004',
      'MED-20260418-000019',
      'synthetic-pqrs:019',
      'reclamo',
      'web',
      'sent',
      'classified',
      'El ciudadano presenta oposicion a un comparendo de transito asociado a su documento aunque afirma no ser propietario del vehiculo. Adjunta copia de consulta historica.',
      'Solicita que se tramite la oposicion, se revise el registro y se informe la decision dentro del termino especial.',
      'Oposicion por comparendo asociado presuntamente a documento equivocado.',
      '[{"namespace":"tema","slug":"movilidad","confidence":0.92},{"namespace":"tramite","slug":"comparendo","confidence":0.9}]'::jsonb,
      'SMOV',
      11,
      '10000000-0000-0000-0000-000000000003',
      '{"hechos": true, "peticion": true, "contacto": true, "adjuntos": true}'::jsonb,
      true,
      false,
      0.07,
      now() - interval '4 days',
      now() + interval '1 day',
      'P1_alta',
      72.0,
      '{"signals":["comparendo","oposicion","plazo_5_dias","respuesta_lista"],"seed":true}'::jsonb,
      null,
      now() - interval '2 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000020',
      '20000000-0000-0000-0000-000000000009',
      'MED-20260418-000020',
      'synthetic-pqrs:020',
      'peticion',
      'email',
      'sent',
      'classified',
      'Vecinos de Buenos Aires solicitaron fumigacion preventiva por presencia de zancudos en zona cercana a una canalizacion. Reportaron varios casos de fiebre en la cuadra.',
      'Solicitaron programacion de visita de salud ambiental e informacion de autocuidado.',
      'Solicitud de visita de salud ambiental por presencia de zancudos.',
      '[{"namespace":"tema","slug":"salud_publica","confidence":0.93},{"namespace":"tema","slug":"vectores","confidence":0.88}]'::jsonb,
      'SSAL',
      9,
      '10000000-0000-0000-0000-000000000004',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.16,
      now() - interval '8 days',
      now() - interval '2 days',
      'P3_baja',
      40.0,
      '{"signals":["salud_ambiental","respuesta_enviada"],"seed":true}'::jsonb,
      null,
      now() - interval '3 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000021',
      '20000000-0000-0000-0000-000000000007',
      'MED-20260418-000021',
      'synthetic-pqrs:021',
      'peticion',
      'web',
      'closed',
      'classified',
      'La familia solicito cupo escolar para grado sexto en una institucion cercana a su residencia en Castilla. Indicaron traslado reciente de municipio.',
      'Solicitaron informacion de disponibilidad y pasos para formalizar matricula.',
      'Solicitud de cupo escolar por traslado familiar.',
      '[{"namespace":"tema","slug":"educacion","confidence":0.94},{"namespace":"tramite","slug":"cupo_escolar","confidence":0.91}]'::jsonb,
      'SEDU',
      5,
      '10000000-0000-0000-0000-000000000008',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.12,
      now() - interval '18 days',
      now() - interval '4 days',
      'P2_media',
      55.0,
      '{"signals":["cupo_escolar","caso_cerrado"],"seed":true}'::jsonb,
      null,
      now() - interval '9 days'
    ),
    (
      '30000000-0000-0000-0000-000000000022',
      '20000000-0000-0000-0000-000000000014',
      'MED-20260418-000022',
      'synthetic-pqrs:022',
      'peticion',
      'email',
      'transferred',
      'classified',
      'Ciudadano solicita reparacion de una fuga de acueducto en via publica. La descripcion indica que la competencia principal corresponde a empresa de servicios publicos.',
      'Pide traslado a la entidad competente e informacion del numero de seguimiento.',
      'Solicitud de traslado por fuga de acueducto en via publica.',
      '[{"namespace":"tema","slug":"traslado_competencia","confidence":0.92},{"namespace":"infraestructura","slug":"acueducto","confidence":0.89}]'::jsonb,
      'SGOB',
      5,
      '10000000-0000-0000-0000-000000000001',
      '{"hechos": true, "peticion": true, "contacto": true}'::jsonb,
      true,
      false,
      0.05,
      now() - interval '2 days',
      now() + interval '8 days',
      'P3_baja',
      33.0,
      '{"signals":["posible_traslado","servicios_publicos"],"seed":true}'::jsonb,
      null,
      now() - interval '1 day'
    ),
    (
      '30000000-0000-0000-0000-000000000023',
      null,
      'MED-20260418-000023',
      'synthetic-pqrs:023',
      'peticion',
      'web',
      'bounced_incomplete',
      'pending_human',
      'Mensaje anonimo indica presencia de basuras acumuladas en una esquina, pero no incluye direccion verificable ni datos de contacto.',
      'Solicita intervencion de limpieza, sin aportar ubicacion suficiente para asignar cuadrilla.',
      'PQR incompleta por falta de ubicacion verificable y contacto.',
      '[{"namespace":"tema","slug":"aseo","confidence":0.62},{"namespace":"calidad","slug":"incompleta","confidence":0.91}]'::jsonb,
      null,
      null,
      null,
      '{"hechos": true, "peticion": true, "contacto": false, "ubicacion": false}'::jsonb,
      true,
      true,
      0.02,
      now() - interval '4 hours',
      null,
      'P3_baja',
      20.0,
      '{"signals":["sin_contacto","sin_ubicacion"],"seed":true}'::jsonb,
      null,
      now() - interval '3 hours'
    ),
    (
      '30000000-0000-0000-0000-000000000024',
      '20000000-0000-0000-0000-000000000018',
      'MED-20260418-000024',
      'synthetic-pqrs:024',
      'queja',
      'social_manual',
      'rejected_disrespectful',
      'classified',
      'Publicacion capturada desde redes contiene insultos contra servidores publicos y no formula una solicitud concreta verificable. El mensaje fue preservado para trazabilidad.',
      'Se registra rechazo por lenguaje irrespetuoso y ausencia de peticion clara.',
      'Mensaje rechazado por lenguaje irrespetuoso y falta de solicitud concreta.',
      '[{"namespace":"sentimiento","slug":"irrespetuoso","confidence":0.96},{"namespace":"calidad","slug":"sin_peticion_clara","confidence":0.88}]'::jsonb,
      'SSEG',
      10,
      '10000000-0000-0000-0000-000000000006',
      '{"hechos": true, "peticion": false, "contacto": true, "respeto": false}'::jsonb,
      false,
      false,
      0.0,
      now() - interval '1 day',
      null,
      'P3_baja',
      10.0,
      '{"signals":["irrespetuoso","sin_peticion_clara"],"seed":true}'::jsonb,
      null,
      now() - interval '1 day'
    )
)
insert into public.pqr (
  id,
  tenant_id,
  radicado,
  source_hash,
  tipo,
  channel,
  status,
  classification_status,
  hechos,
  peticion,
  lead,
  discriminacion_tematica,
  raw_text,
  display_text,
  llm_text,
  citizen_id,
  secretaria_id,
  comuna_id,
  captured_by,
  estructura_minima,
  respeto_ok,
  anonimato,
  tutela_risk_score,
  issued_at,
  legal_deadline,
  priority_level,
  priority_score,
  priority_reason,
  priority_locked_by,
  priority_locked_at,
  created_at,
  updated_at
)
select
  sp.id::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  sp.radicado,
  sp.source_hash,
  sp.tipo::public.pqr_tipo,
  sp.channel::public.pqr_channel,
  sp.status::public.pqr_status,
  sp.classification_status,
  sp.hechos,
  sp.peticion,
  sp.lead,
  sp.discriminacion_tematica,
  sp.hechos || E'\n\nSolicitud: ' || sp.peticion,
  sp.hechos || E'\n\nSolicitud: ' || sp.peticion,
  sp.hechos || E'\n\nSolicitud: ' || sp.peticion,
  sp.citizen_id::uuid,
  s.id,
  c.id,
  sp.captured_by_id::uuid,
  sp.estructura_minima,
  sp.respeto_ok,
  sp.anonimato,
  sp.tutela_risk_score,
  sp.issued_at,
  sp.legal_deadline,
  sp.priority_level::public.priority_level,
  sp.priority_score,
  sp.priority_reason,
  sp.priority_locked_by_id::uuid,
  case
    when sp.priority_locked_by_id is null then null
    else sp.issued_at + interval '15 minutes'
  end,
  sp.issued_at,
  sp.updated_at
from seed_pqrs sp
left join public.secretarias s
  on s.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
 and s.codigo = sp.secretaria_codigo
left join public.comunas c
  on c.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
 and c.numero = sp.comuna_numero
on conflict do nothing;

-- =============================================================================
-- Timeline events
-- =============================================================================

insert into public.pqr_events (
  tenant_id,
  pqr_id,
  kind,
  actor_id,
  payload,
  created_at
)
select
  p.tenant_id,
  p.id,
  'received',
  p.captured_by,
  jsonb_build_object('seed', 'synthetic-pqrs', 'channel', p.channel, 'radicado', p.radicado),
  p.issued_at
from public.pqr p
where p.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  and p.source_hash like 'synthetic-pqrs:%'
  and not exists (
    select 1
    from public.pqr_events e
    where e.pqr_id = p.id
      and e.kind = 'received'
      and e.payload ->> 'seed' = 'synthetic-pqrs'
  );

insert into public.pqr_events (
  tenant_id,
  pqr_id,
  kind,
  actor_id,
  payload,
  created_at
)
select
  p.tenant_id,
  p.id,
  'classified',
  p.priority_locked_by,
  jsonb_build_object(
    'seed',
    'synthetic-pqrs',
    'tipo',
    p.tipo,
    'priority_level',
    p.priority_level,
    'classification_status',
    p.classification_status
  ),
  p.issued_at + interval '10 minutes'
from public.pqr p
where p.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  and p.source_hash like 'synthetic-pqrs:%'
  and p.classification_status = 'classified'
  and not exists (
    select 1
    from public.pqr_events e
    where e.pqr_id = p.id
      and e.kind = 'classified'
      and e.payload ->> 'seed' = 'synthetic-pqrs'
  );

insert into public.pqr_events (
  tenant_id,
  pqr_id,
  kind,
  actor_id,
  payload,
  created_at
)
select
  p.tenant_id,
  p.id,
  'assigned',
  p.captured_by,
  jsonb_build_object('seed', 'synthetic-pqrs', 'secretaria_id', p.secretaria_id),
  p.issued_at + interval '20 minutes'
from public.pqr p
where p.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  and p.source_hash like 'synthetic-pqrs:%'
  and p.secretaria_id is not null
  and p.status in ('assigned', 'in_draft', 'in_review', 'approved', 'sent', 'closed')
  and not exists (
    select 1
    from public.pqr_events e
    where e.pqr_id = p.id
      and e.kind = 'assigned'
      and e.payload ->> 'seed' = 'synthetic-pqrs'
  );

insert into public.pqr_events (
  tenant_id,
  pqr_id,
  kind,
  actor_id,
  payload,
  created_at
)
select
  p.tenant_id,
  p.id,
  'response_sent',
  p.captured_by,
  jsonb_build_object('seed', 'synthetic-pqrs', 'status', p.status),
  p.updated_at
from public.pqr p
where p.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  and p.source_hash like 'synthetic-pqrs:%'
  and p.status in ('sent', 'closed')
  and not exists (
    select 1
    from public.pqr_events e
    where e.pqr_id = p.id
      and e.kind = 'response_sent'
      and e.payload ->> 'seed' = 'synthetic-pqrs'
  );

-- =============================================================================
-- Draft/final responses
-- =============================================================================

with seed_responses (
  id,
  pqr_id,
  kind,
  body,
  citations,
  created_by,
  approved_by,
  approved_at,
  sent_at,
  created_at,
  updated_at
) as (
  values
    (
      '50000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003',
      'draft',
      'Se proyecta respuesta con activacion de ruta de seguridad, reserva de identidad de la peticionaria y orientacion para denuncia formal ante autoridad competente.',
      '[{"label":"Ley 1755 de 2015","type":"normativa"},{"label":"Ruta local de seguridad y convivencia","type":"procedimiento"}]'::jsonb,
      '10000000-0000-0000-0000-000000000006',
      null,
      null,
      null,
      now() - interval '1 day',
      now() - interval '3 hours'
    ),
    (
      '50000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000008',
      'draft',
      'La Secretaria de Desarrollo Economico informa requisitos de postulacion a ferias temporales, calendario de convocatorias y enlace de radicacion documental.',
      '[{"label":"Manual de aprovechamiento economico del espacio publico","type":"guia"}]'::jsonb,
      '10000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000005',
      now() - interval '9 hours',
      null,
      now() - interval '2 days',
      now() - interval '9 hours'
    ),
    (
      '50000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000019',
      'final',
      'Se verifico el registro del comparendo y se informo al ciudadano el canal para aportar documentos de impugnacion. No se encontraron cargos adicionales asociados al tramite revisado.',
      '[{"label":"Codigo Nacional de Transito","type":"normativa"},{"label":"Procedimiento de impugnacion","type":"tramite"}]'::jsonb,
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000003',
      now() - interval '3 hours',
      now() - interval '2 hours',
      now() - interval '1 day',
      now() - interval '2 hours'
    ),
    (
      '50000000-0000-0000-0000-000000000004',
      '30000000-0000-0000-0000-000000000020',
      'final',
      'Se programo visita de salud ambiental y se remitieron recomendaciones de eliminacion de criaderos, manejo de aguas estancadas y signos de alarma.',
      '[{"label":"Lineamientos de vigilancia de vectores","type":"protocolo"}]'::jsonb,
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000004',
      now() - interval '4 hours',
      now() - interval '3 hours',
      now() - interval '1 day',
      now() - interval '3 hours'
    ),
    (
      '50000000-0000-0000-0000-000000000005',
      '30000000-0000-0000-0000-000000000021',
      'final',
      'La solicitud fue cerrada despues de informar la institucion con cupo disponible, los documentos requeridos y la fecha de matricula.',
      '[{"label":"Ruta de matricula oficial","type":"tramite"}]'::jsonb,
      '10000000-0000-0000-0000-000000000008',
      '10000000-0000-0000-0000-000000000008',
      now() - interval '10 days',
      now() - interval '9 days',
      now() - interval '12 days',
      now() - interval '9 days'
    )
)
insert into public.responses (
  id,
  tenant_id,
  pqr_id,
  kind,
  body,
  citations,
  created_by,
  approved_by,
  approved_at,
  sent_at,
  created_at,
  updated_at
)
select
  sr.id::uuid,
  p.tenant_id,
  sr.pqr_id::uuid,
  sr.kind::public.response_kind,
  sr.body,
  sr.citations,
  sr.created_by::uuid,
  sr.approved_by::uuid,
  sr.approved_at,
  sr.sent_at,
  sr.created_at,
  sr.updated_at
from seed_responses sr
join public.pqr p on p.id = sr.pqr_id::uuid
on conflict (id) do update
set
  kind = excluded.kind,
  body = excluded.body,
  citations = excluded.citations,
  created_by = excluded.created_by,
  approved_by = excluded.approved_by,
  approved_at = excluded.approved_at,
  sent_at = excluded.sent_at,
  updated_at = excluded.updated_at
where
  public.responses.kind is distinct from excluded.kind
  or public.responses.body is distinct from excluded.body
  or public.responses.citations is distinct from excluded.citations
  or public.responses.created_by is distinct from excluded.created_by
  or public.responses.approved_by is distinct from excluded.approved_by
  or public.responses.approved_at is distinct from excluded.approved_at
  or public.responses.sent_at is distinct from excluded.sent_at
  or public.responses.updated_at is distinct from excluded.updated_at;

-- =============================================================================
-- Problem groups for clustering and operational triage
-- =============================================================================

insert into public.problem_groups (
  id,
  tenant_id,
  canonical_title,
  resumen,
  location,
  status,
  created_at,
  updated_at
)
values
  (
    '60000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Movilidad e infraestructura vial con riesgo operativo',
    'Casos relacionados con huecos, semaforos, vias rurales, luminarias y comparendos que afectan movilidad o seguridad vial.',
    '{"comunas":[11,14,15,80],"seed":true}'::jsonb,
    'open',
    now() - interval '2 days',
    now() - interval '2 hours'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Acceso oportuno a servicios de salud publica',
    'PQR sobre entrega de medicamentos, salud ambiental y situaciones que requieren respuesta sanitaria.',
    '{"comunas":[9,13],"seed":true}'::jsonb,
    'open',
    now() - interval '5 days',
    now() - interval '3 hours'
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Convivencia, seguridad y espacio publico en el centro',
    'Denuncias y quejas sobre amenazas, conflictos de convivencia y ocupacion de accesos comerciales.',
    '{"comunas":[10],"seed":true}'::jsonb,
    'open',
    now() - interval '4 days',
    now() - interval '3 hours'
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Poblacion vulnerable y apoyos sociales',
    'Solicitudes de hogares vulnerables, menores y apoyos sociales con necesidad de trazabilidad prioritaria.',
    '{"comunas":[1,6],"seed":true}'::jsonb,
    'open',
    now() - interval '6 days',
    now() - interval '1 day'
  )
on conflict (id) do update
set
  canonical_title = excluded.canonical_title,
  resumen = excluded.resumen,
  location = excluded.location,
  status = excluded.status,
  updated_at = excluded.updated_at
where
  public.problem_groups.canonical_title is distinct from excluded.canonical_title
  or public.problem_groups.resumen is distinct from excluded.resumen
  or public.problem_groups.location is distinct from excluded.location
  or public.problem_groups.status is distinct from excluded.status
  or public.problem_groups.updated_at is distinct from excluded.updated_at;

with seed_members (group_id, radicado, similarity_score) as (
  values
    ('60000000-0000-0000-0000-000000000001', 'MED-20260418-000004', 0.91),
    ('60000000-0000-0000-0000-000000000001', 'MED-20260418-000005', 0.78),
    ('60000000-0000-0000-0000-000000000001', 'MED-20260418-000016', 0.86),
    ('60000000-0000-0000-0000-000000000001', 'MED-20260418-000018', 0.74),
    ('60000000-0000-0000-0000-000000000001', 'MED-20260418-000019', 0.67),
    ('60000000-0000-0000-0000-000000000002', 'MED-20260418-000001', 0.89),
    ('60000000-0000-0000-0000-000000000002', 'MED-20260418-000020', 0.71),
    ('60000000-0000-0000-0000-000000000003', 'MED-20260418-000003', 0.88),
    ('60000000-0000-0000-0000-000000000003', 'MED-20260418-000017', 0.82),
    ('60000000-0000-0000-0000-000000000003', 'MED-20260418-000024', 0.59),
    ('60000000-0000-0000-0000-000000000004', 'MED-20260418-000007', 0.81),
    ('60000000-0000-0000-0000-000000000004', 'MED-20260418-000011', 0.84)
)
insert into public.pqr_problem_group_members (
  pqr_id,
  group_id,
  joined_at,
  similarity_score
)
select
  p.id,
  sm.group_id::uuid,
  now(),
  sm.similarity_score
from seed_members sm
join public.pqr p
  on p.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
 and p.radicado = sm.radicado
on conflict (pqr_id) do update
set
  group_id = excluded.group_id,
  similarity_score = excluded.similarity_score
where
  public.pqr_problem_group_members.group_id is distinct from excluded.group_id
  or public.pqr_problem_group_members.similarity_score is distinct from excluded.similarity_score;

-- =============================================================================
-- Rolling citizen memory
-- =============================================================================

insert into public.simple_memory (
  citizen_id,
  tenant_id,
  last_10_pqrs,
  open_tutelas,
  vulnerability_flags,
  updated_at
)
select
  c.id,
  c.tenant_id,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'radicado',
        p.radicado,
        'status',
        p.status,
        'priority_level',
        p.priority_level,
        'lead',
        p.lead,
        'issued_at',
        p.issued_at
      )
      order by p.issued_at desc
    ) filter (where p.id is not null),
    '[]'::jsonb
  ),
  count(*) filter (
    where p.tutela_risk_score >= 0.8
      and p.status::text not in ('sent', 'closed')
  )::int,
  c.vulnerability_flags,
  now()
from public.citizens c
left join public.pqr p
  on p.tenant_id = c.tenant_id
 and p.citizen_id = c.id
 and p.source_hash like 'synthetic-pqrs:%'
where c.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  and c.id between '20000000-0000-0000-0000-000000000001'::uuid
           and '20000000-0000-0000-0000-000000000018'::uuid
group by c.id, c.tenant_id, c.vulnerability_flags
on conflict (citizen_id, tenant_id) do update
set
  last_10_pqrs = excluded.last_10_pqrs,
  open_tutelas = excluded.open_tutelas,
  vulnerability_flags = excluded.vulnerability_flags,
  updated_at = excluded.updated_at
where
  public.simple_memory.last_10_pqrs is distinct from excluded.last_10_pqrs
  or public.simple_memory.open_tutelas is distinct from excluded.open_tutelas
  or public.simple_memory.vulnerability_flags is distinct from excluded.vulnerability_flags;

commit;
