# n8n

n8n es el host externo de automatización. Hoy cumple dos roles:

1. **Implementación paralela del intake** — `retos/mini_reto-valor/workflow.json` contiene el mismo pipeline que `packages/intake-agent`, expresado como workflow de n8n con agentes Gemini. Es el artefacto que corre el demo del Mini Reto Valor.
2. **Gancho para integraciones futuras** — la variable `N8N_WEBHOOK_BASE_URL` en `turbo.json` reserva el contrato para que cualquier app pueda disparar webhooks hacia el host n8n sin hardcodear URL.

No hay una librería del repo que llame a n8n todavía. El workflow vive auto-contenido: entra HTTP, sale HTTP, y toca Supabase vía sus propias credenciales.

## Host

n8n corre fuera del monorepo (host externo, deferido — típicamente un VM con Caddy de reverse proxy). Nadie del equipo gestiona n8n desde el repo; el `.json` exportado es la fuente de verdad que se importa al host.

Contrato de env:

- `N8N_WEBHOOK_BASE_URL` — base pública del host (ej. `https://n8n.example.com/webhook`). Cuando una app quiera disparar un workflow, compone `${N8N_WEBHOOK_BASE_URL}/<webhook-id>`.

## Workflow: Los Compilados — Intake Agent

Archivo: `retos/mini_reto-valor/workflow.json`.

Trigger: webhook `POST /webhook/8276ff9e-89e2-4aa9-98ad-002cb61fe776` o disparador manual con semilla de prueba.

### Nodos (visión lineal)

1. **Webhook PQRS Intake / Disparador Manual → Unificar Entradas** — permite correr con o sin webhook.
2. **Extraer Payload** — normaliza los campos del envelope (`source_channel`, `citizen_name`, `is_anonymous`, `document_id`, `email`, `phone`, `subject`, `description`, `raw_text`, `attachments`, `location_text`, `consent_data`, `created_at`).
3. **Validar Esquema NormalizedIntake** — rechaza si falta algo o si `consent_data !== true` (Ley 1581/2012).
4. **¿Esquema Válido?** — branch:
   - `false` → **Rechazo por Esquema** (sale con `ok: false`, `stage: schema_rejected`).
   - `true` → continúa.
5. **Computar Identidad** — genera `radicado MED-YYYYMMDD-XXXXXX` + `source_hash` SHA-256 para idempotencia. Mapea `source_channel → pqr.channel`.
6. **Format Preserve (raw/display/llm)** — produce las tres vistas del texto con redacción de PII (email, teléfono, documento, dirección).
7. **Agente Validez (Gemini)** — devuelve `{hechos, peticion, lead, respeto_ok, is_offensive, estructura_minima, tutela_risk_score, missing_fields}`.
8. **Aplicar Compuertas** — gate combinado Art. 16 Ley 1755/2015: `hechos_ok ∧ peticion_ok ∧ respeto_ok ∧ anonimato_ok`.
9. **¿Es Válido?** — branch:
   - `false` → **Generar Razón de Rebote → Armar Fila Rebote → Insertar PQR Rebote → Emitir Evento Rebote → Respuesta Rebote**. Taxonomía fija: `faltan_hechos`, `falta_peticion`, `irrespetuoso`, `anonimo_sin_datos_contacto`, `fuera_de_competencia_municipal`.
   - `true` → continúa.
10. **Agente Clasificador (Gemini)** — devuelve `{tipo, secretaria_codigo, comuna_numero, comuna_tipo, barrio, discriminacion_tematica, reasoning}`.
11. **Buscar Secretaría / Buscar Comuna** — lookups en Supabase para resolver `secretaria_id` y `comuna_id`.
12. **Motor de Prioridad y Plazo** — reglas:
    - `P0_critica` (score ≥ 90): vulnerabilidad explícita, `SSAL` + urgencia, `DAGRD`, tutela_risk ≥ 0.7.
    - `P1_alta` (score 75): `SSEG`, `SSAL`, denuncia, tutela_risk ≥ 0.5.
    - `P2_media` (score 55): `SINF`/`SMOV`/`SMAM`/`SGOB`, reclamo, queja.
    - `P3_baja` (score 30): resto.
    - Plazo en días hábiles sobre `issued_at`: oposición = 5, P0 = 1, P1 = 5, P2 = 15, P3 = 30.
13. **Armar Fila PQR → Insertar PQR → Emitir Evento Intake → Respuesta OK** — persiste y emite evento `intake_agent_run`.

### Contrato con la BD

El workflow escribe en las mismas tablas que `packages/intake-agent`:

- `public.pqr` — una fila por caso (o por rebote).
- `public.pqr_events` — `kind = intake_agent_run` o `kind = intake_agent_bounce` con payload JSON.

Tenant hardcoded en la versión del reto (`00000000-0000-0000-0000-000000000001`). En producción lo parametriza el webhook o el header `x-tenant-id`.

### Credenciales que el workflow espera

- **Google Gemini(PaLM)** — para los dos agentes (validez y clasificador).
- **Supabase** — cuenta con service-role para los nodos `supabase.getAll / create`.

Ambas se configuran en la UI del host n8n, no en el JSON.

## Cuándo usar `packages/intake-agent` vs n8n

| Caso | Usar |
| --- | --- |
| Intake disparado desde una ruta server-side de Next.js. | `packages/intake-agent` + edge function `intake-agent`. |
| Intake desde canales externos (form público, correo a webhook, cola Mercurio). | n8n. |
| Demo del Mini Reto Valor. | n8n (`workflow.json`). |
| Probar el pipeline end-to-end sin credenciales externas. | edge function `intake-agent` — reusa stubs del repo. |

Ambas rutas convergen en el mismo estado de BD, así que un operador puede correr cualquiera según la ergonomía del canal.

## Extensiones futuras

- Pull desde la API pública de PQRSD de Medellín → n8n cron → webhook del intake.
- Notificaciones al ciudadano (SMS/correo) al aceptar o rebotar un caso.
- Ingesta masiva Mercurio CSV → n8n `split in batches` → workflow.

Hasta entonces, el host n8n queda como dependencia externa documentada, no como componente crítico del monorepo.
