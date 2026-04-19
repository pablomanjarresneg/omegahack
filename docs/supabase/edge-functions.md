# Edge Functions

Funciones Deno desplegadas en Supabase. Viven en `services/edge-functions/` en el repo y se despliegan con:

```bash
supabase functions deploy <nombre> --project-ref <project-ref>
```

Todas corren con `SUPABASE_SERVICE_ROLE_KEY` inyectado por el runtime y autentican al caller con un bearer propio antes de tocar la BD.

## Catálogo

| Función | Trigger | Entrada | Salida | Estado |
| --- | --- | --- | --- | --- |
| `intake-agent` | POST manual | Envelope con `intake` + `tenant` | `IntakeAgentRun` (validez + clasificación + problem group) | En uso |
| `qa-ingest` | POST manual desde pipeline QA | `{ sourceId, storagePath }` | Conteos de chunks ingestados | En uso |
| `reembed-pqr` | Cron cada minuto | `{}` | `{ processed, succeeded, failed, batch_size }` | En uso |

## `intake-agent`

Orquesta `packages/intake-agent` desde Deno. Recibe un `NormalizedIntake` y devuelve un `IntakeAgentRun` con la clasificación, validez, tags y grupo de problema asignado. El trabajo pesado está delegado al paquete de TypeScript; el handler Deno solo hace envelope + tenant resolution + dispatch.

Entrada:

```json
{
  "intake": { ... },       // NormalizedIntake
  "tenant": {
    "tenantId": "uuid",
    "tenantSlug": "alcaldia-medellin",
    "defaultSecretariaCodigo": "DESP"
  }
}
```

Alternativa: pasar `tenant_id` / `tenant_slug` a nivel raíz, o bien en header `x-tenant-id`.

Errores:
- `400 IntakeValidationError` con `issues[]` si el payload no cumple el esquema.
- `500 intake-agent failed` cuando revienta cualquier dependencia.

## `qa-ingest`

Ingesta un documento markdown del bucket `qa-corpus` al schema `qa_bank`. Chunking consciente de encabezados + embeddings 1024-dim vía Azure `nella-embeddings`.

Invocación:

```bash
curl -X POST \
  -H "Authorization: Bearer $QA_INGEST_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": "uuid", "storagePath": "leyes/1755-2015.md"}' \
  "$SUPABASE_URL/functions/v1/qa-ingest"
```

Env vars requeridas:

| Variable | Para qué |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto. |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrituras en `qa_bank.*`. |
| `QA_INGEST_ADMIN_KEY` | Bearer outer — rotable sin tocar Supabase. |
| `AZURE_EMBEDDINGS_ENDPOINT` | URL del deployment Azure. |
| `AZURE_EMBEDDINGS_KEY` | API key. |

Tests: `cd services/edge-functions/qa-ingest && deno task test`.

El chunking canónico vive en `packages/rag/test/chunking.test.ts`; el test hermano aquí solo verifica que la copia portada a Deno sigue funcionando.

## `reembed-pqr`

Drena `public.pqr_embedding_jobs` y escribe 1024-dim embeddings por PQR en `public.pqr_embeddings` para tres kinds: `full`, `lead`, `peticion`. Corre cada minuto vía `pg_cron`.

Autentica dos veces:
1. El proxy de Supabase valida el JWT si está activado.
2. El handler exige `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.

Env vars:

| Variable | Requerida | Default | Propósito |
| --- | --- | --- | --- |
| `SUPABASE_URL` | sí | inyectada | URL del proyecto. |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | inyectada | Auth + escrituras. |
| `AZURE_EMBEDDINGS_ENDPOINT` | no | vacío | Si vacío → stub determinístico. |
| `AZURE_EMBEDDINGS_KEY` | no | vacío | API key Azure. |
| `EMBEDDING_MODEL_VERSION` | no | `stub-deterministic-v1` | Se guarda en `pqr_embeddings.model_version`. |
| `REEMBED_BATCH_SIZE` | no | `10` | Máximo de jobs por invocación. |

Stub determinístico: cuando no hay creds Azure, la función usa un embedding SHA-256-seeded + mulberry32 + Box–Muller + L2-normalizado. Mismo input → mismo vector, suficiente para exercise end-to-end del pipeline intake → embed → search en dev y CI.

Cómo funciona por dentro:

1. `public.drain_reembed_batch(batch_size)` (SECURITY DEFINER RPC) lockea hasta `REEMBED_BATCH_SIZE` rows con `FOR UPDATE SKIP LOCKED` y las marca `running`.
2. Para cada job: carga `pqr.hechos|peticion|lead`, arma tres payloads (`full = hechos+peticion+lead`, `lead`, `peticion`), embebe cada uno, hace upsert en `pqr_embeddings` con `onConflict = pqr_id,kind,model_version`.
3. En éxito → marca `done`. En fallo → incrementa `attempt_count`, guarda `last_error`, y marca `failed` cuando `attempt_count >= 3`; si no, la devuelve a `queued`.

Schedule en `pg_cron`:

```sql
select cron.schedule(
  'reembed-pqr-drain',
  '* * * * *',
  $$
    select net.http_post(
      url     := 'https://<project-ref>.supabase.co/functions/v1/reembed-pqr',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type',  'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

Tests locales: `cd services/edge-functions/reembed-pqr && deno task test` — ejercitan solo el stub embedding; no tocan red ni BD.
