# n8n

n8n es el host externo de automatización. Hoy cumple dos roles:

1. **Pipeline de intake público** — el workflow `Los Compilados — Intake Agent v3.2.4` recibe PQRSD desde el portal landing (`apps/landing/src/routes/portal.radicar.tsx`), las clasifica con Gemini, las persiste en Supabase e indexa en nella. Es la ruta crítica del hackathon.
2. **Backfill programado** — rama Schedule Trigger del mismo workflow (cada 30 min) reindexa PQRs a nella sin tocar el portal.

## Host

n8n corre en `https://pablomanjarres.app.n8n.cloud` (cloud gestionado; no se versiona desde el repo). El workflow vive allí; el SDK file en `.private/n8n/intake-agent-v3.2.4.sdk.ts` es la fuente de verdad para re-crearlo si se pierde.

Contrato de env:

- `N8N_WEBHOOK_BASE_URL` — base pública del host (ej. `https://pablomanjarres.app.n8n.cloud/webhook`).
- En el landing app (Vite): `VITE_N8N_WEBHOOK_BASE_URL`. Cuando está vacío, el portal radica en modo demo (sin pegarle a n8n).

## Workflow: Los Compilados — Intake Agent v3.2.4

- **ID**: `GzOHz6hxBOJygMU9`
- **URL**: `https://pablomanjarres.app.n8n.cloud/workflow/GzOHz6hxBOJygMU9`
- **Webhook**: `POST /webhook/pqrs/intake` — lo que consume el landing.
- **Nodos**: 43 (webhook + manualTrigger + scheduleTrigger, 2 agentes Gemini con parser estructurado, ramas 200/201/400/422).

### Ramas

1. **201 accepted** (camino feliz): `Unificar Entradas → Extraer Payload → Validar Esquema → Computar Identidad → Format Preserve → Chequear Duplicado → Agente Validez (Gemini) → Aplicar Compuertas → Agente Clasificador (Gemini) → Buscar Secretaría + Buscar Comuna → Motor Prioridad → Armar Fila PQR → Insertar PQR → **Indexar en Nella** → Emitir Evento Intake → Responder 201`.
2. **400 schema_rejected**: `Validar Esquema` falla → `Registrar Esquema Invalido → Responder 400`.
3. **422 bounced_incomplete**: compuertas Art. 16 fallan → `Generar Razon Rebote → Armar Fila Rebote → Insertar PQR Rebote → Emitir Evento Rebote → Responder 422`.
4. **200 duplicate**: `source_hash` repetido → `Responder 200 Duplicado`.
5. **Schedule backfill** (cada 30 min): `Disparador Nella Backfill → Backfill Nella (HTTP a pqr-nella-indexer) → Registrar Evento Backfill`.

### Motor de Prioridad y Plazo

- `P0_critica` (score 90-95): vulnerabilidad explícita, `SSAL` + urgencia, `DAGRD`, tutela ≥ 0.7.
- `P1_alta` (score 75): `SSEG`, `SSAL`, denuncia, tutela ≥ 0.5.
- `P2_media` (score 55): `SINF`/`SMOV`/`SMAM`/`SGOB`, reclamo, queja.
- `P3_baja` (score 25-30): resto.
- Plazo en días hábiles sobre `issued_at`: P0 = 1, P1 = 5, P2 = 15, P3 = 30.

### Respuesta 201 (contrato con el landing)

```json
{
  "ok": true,
  "stage": "accepted",
  "pqr_id": "<uuid>",
  "radicado": "MED-YYYYMMDD-XXXXXX",
  "status": "received",
  "priority_level": "P2_media",
  "priority_score": 55,
  "secretaria_id": "<uuid>",
  "lead": "Resumen corto",
  "legal_deadline": "ISO8601"
}
```

El campo `priority_level` sale como enum de BD (`P0_critica`…); si el landing necesita forma corta debe derivarla (`P2_media → P2`).

### Contrato con la BD

- `public.pqr` — una fila por caso (o por rebote).
- `public.pqr_events` — `kind = intake_agent_run | intake_agent_bounce | intake_agent_schema_reject | nella_index_run`.

Tenant hardcoded en demo (`00000000-0000-0000-0000-000000000001`).

### Credenciales y secrets

En la UI de n8n:

- **Supabase account** — service-role de Supabase (URL + key).
- **Google Gemini(PaLM) Api account 2** — API key de Google AI Studio.
- En Settings → Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (los HTTP Request nodes de `Indexar en Nella` y `Backfill Nella` las leen via `$env.*`).

En Supabase:

```bash
supabase secrets set \
  NELLA_MCP_ENDPOINT="https://mcp.getnella.dev/sse" \
  NELLA_MCP_TOKEN="nella_..."
```

El edge function `pqr-nella-indexer` es el único código del repo que toca el token de nella — n8n nunca lo ve.

## Cuándo usar `packages/intake-agent` vs n8n

| Caso | Usar |
| --- | --- |
| Intake desde el portal landing / canales externos. | **n8n (v3.2.4)** — es la ruta crítica. |
| Intake disparado desde una ruta server-side de Next.js (futuro). | `packages/intake-agent` + edge function `intake-agent`. |
| Probar el pipeline sin credenciales externas. | edge function `intake-agent` — reusa stubs del repo. |

Ambas rutas convergen en la misma BD (`public.pqr`, `public.pqr_events`).

## Extensiones futuras

- Pull desde la API pública de PQRSD de Medellín → n8n cron → webhook del intake.
- Notificaciones al ciudadano (SMS/correo) al aceptar o rebotar un caso.
- Ingesta masiva Mercurio CSV → n8n `split in batches` → webhook del intake.
