# services/edge-functions

Funciones Deno desplegadas como Supabase Edge Functions. Cada subcarpeta es una función independiente con su propio `deno.json`.

## Catálogo

| Función | Trigger | Documentación |
| --- | --- | --- |
| [`intake-agent`](intake-agent/README.md) | POST manual o webhook | Orquesta `@omega/intake-agent` sobre Deno. |
| [`pqr-nella-indexer`](pqr-nella-indexer/README.md) | POST desde intake + cron n8n | Indexa PQRs en el bucket compartido `omega-pqr-corpus` (idempotente). |
| [`qa-ingest`](qa-ingest/README.md) | POST manual | Ingesta markdown del bucket `qa-corpus` al schema `qa_bank`. |
| [`reembed-pqr`](reembed-pqr/README.md) | Cron cada minuto | Drena `pqr_embedding_jobs` y persiste embeddings 1024-dim. |

Ver panorama completo en [`docs/supabase/edge-functions.md`](../../docs/supabase/edge-functions.md).

## Despliegue

```bash
supabase functions deploy <nombre> --project-ref <project-ref>

# Secrets (solo los no inyectados por Supabase):
supabase secrets set KEY=value --project-ref <project-ref>
```

Supabase inyecta automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; cualquier otro secreto se setea con `supabase secrets set`.

## Desarrollo local

Cada función corre con Deno:

```bash
cd services/edge-functions/<nombre>
deno task test
deno task dev           # cuando esté definido
```

No se ejecutan bajo pnpm / turbo porque son runtime Deno, no Node.

## Convenciones

- Handlers autentican al caller con un bearer propio antes de tocar la BD, incluso cuando el proxy de Supabase ya validó el JWT.
- Tipos compartidos se importan por ruta relativa desde `packages/*/src/*.ts` (Deno lee TS directo).
- Tests pequeños y sin red (stubs, fixtures). Los tests con dependencia externa viven en el paquete de Node equivalente (ej. `packages/rag/test/chunking.test.ts`).
