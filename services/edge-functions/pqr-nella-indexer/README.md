# pqr-nella-indexer Edge Function

Pushes PQR rows into the shared nella bucket (`omega-pqr-corpus`) via the nella MCP. Idempotent by PQR UUID — nella skips doc ids it has already seen, so the same call can safely run on every intake and on a backfill cron without producing duplicate entries.

## Invocación

```bash
# Index specific PQRs (e.g. right after intake)
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["<uuid>", "<uuid>"] }' \
  "$SUPABASE_URL/functions/v1/pqr-nella-indexer"

# Backfill everything with status in (accepted, assigned, in_draft,
# in_review, approved, sent, closed), newest first, limit 500.
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/functions/v1/pqr-nella-indexer"

# Incremental backfill since last run:
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "since": "2026-04-19T00:00:00Z", "limit": 100 }' \
  "$SUPABASE_URL/functions/v1/pqr-nella-indexer"
```

## Body

| Campo | Tipo | Default | Descripción |
| --- | --- | --- | --- |
| `ids` | `string[]` | — | Index exactly these PQR ids. Takes precedence over `since`/`limit`. |
| `since` | ISO 8601 | — | Index PQRs with `updated_at >= since`. |
| `limit` | `number` | `500` | Max rows per run (cap: 2000). |
| `bucket` | `string` | `omega-pqr-corpus` | Override the target bucket (tests only). |

## Respuestas

- `200` — `{ bucket, requested, indexed, skipped, errors[], duration_ms }`.
- `400` — body no es JSON válido.
- `401` — faltó el service-role bearer.
- `500` — falta env crítica (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- `503` — nella MCP no está configurado (`NELLA_MCP_ENDPOINT` / `NELLA_MCP_TOKEN` faltan).

## Side effects

- Inserta una fila en `public.pqr_events` con `kind = 'nella_index_run'` y el payload `{ bucket, requested, indexed, skipped, errors, duration_ms }` para observabilidad.

## Env vars

| Variable | Requerida | Propósito |
| --- | --- | --- |
| `SUPABASE_URL` | sí | Inyectada. |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Inyectada. |
| `NELLA_MCP_ENDPOINT` | sí | HTTP endpoint que acepta `{ tool, arguments }` y delega a nella MCP. |
| `NELLA_MCP_TOKEN` | sí | Bearer para el endpoint. |
| `NELLA_MCP_INDEX_TOOL` | no | Default `nella_index`. Cambiar si el MCP expone otro nombre. |
| `NELLA_MCP_SEARCH_TOOL` | no | Default `nella_search`. |
| `DEFAULT_TENANT_ID` | no | Tenant usado para insertar el evento `nella_index_run`. |

## Fuente de verdad del contenido

El renderer + la metadata son compartidos con `scripts/export-pqr-corpus.ts` vía `@omega/rag` (`packages/rag/src/pqr-renderer.ts`). Cambios al formato del doc deben hacerse ahí, nunca duplicar.

## Deploy

```bash
supabase functions deploy pqr-nella-indexer --project-ref <project-ref>
supabase secrets set NELLA_MCP_ENDPOINT="https://..." NELLA_MCP_TOKEN="nella_..." --project-ref <project-ref>
```
