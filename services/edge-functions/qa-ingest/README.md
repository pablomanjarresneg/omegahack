# qa-ingest

Supabase edge function that ingests a markdown document from the `qa-corpus`
Storage bucket into the `qa_bank.*` tables. Heading-aware chunks + 1024-dim
Azure `nella-embeddings`.

## Invocation

```bash
curl -X POST \
  -H "Authorization: Bearer $QA_INGEST_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "uuid-of-an-existing-qa_sources-row",
    "storagePath": "leyes/1755-2015.md"
  }' \
  "$SUPABASE_URL/functions/v1/qa-ingest"
```

## Required env vars

| Name | Purpose |
| ---- | ------- |
| `SUPABASE_URL` | target Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for writes to `qa_bank.*` |
| `QA_INGEST_ADMIN_KEY` | outer bearer auth — rotate without touching Supabase |
| `AZURE_EMBEDDINGS_ENDPOINT` | Azure `nella-embeddings` deployment URL |
| `AZURE_EMBEDDINGS_KEY` | Azure API key |

## Tests

```sh
deno task test
```

The canonical chunking tests live in `packages/rag/test/chunking.test.ts`; the
sibling test here verifies the hand-ported copy still runs on Deno.
