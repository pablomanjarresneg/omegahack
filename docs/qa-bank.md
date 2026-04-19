# Q&A bank — schema, ingestion, and guarantees

The Q&A bank is the knowledge substrate that powers the workbench's
**Similar cases** and **Applicable normativa** panels, and the RAG retriever
that the response-drafting pipeline leans on.

It lives in its own Postgres schema, `qa_bank`, behind a dedicated
least-privilege role — `app_operational` (the application's default role)
cannot see it at all.

## Dimension choice: 1024

Every vector column in `qa_bank` is `vector(1024)`. This is **not a choice** —
it's a constraint imposed by the existing Azure `nella-embeddings`
deployment that `public.pqr_embeddings` already uses
(`services/edge-functions/reembed-pqr/embed.ts:10`). Mixing 1024-dim and
1536-dim vectors in the same RAG path would silently degrade quality; we
pin `qa_bank` to 1024 to guarantee the query and candidate vectors come
from the same model.

## Schema

All tables are defined in `supabase/migrations/20260419110000_qa_schema.sql`.

| Table | PK | Purpose |
| ----- | -- | ------- |
| `qa_bank.qa_sources` | `id` | Canonical registry of corpus sources: leyes, decretos, canonical responses, internal memos. |
| `qa_bank.qa_documents` | `id` | One row per ingested artifact (PDF→md, markdown, etc.). `tenant_id` nullable: NULL = corpus-wide; non-NULL = tenant-scoped internal memo. |
| `qa_bank.qa_chunks` | `id` | Heading-aware splits of a document. `heading_path` is a `text[]` tracking H1→H6 ancestry. |
| `qa_bank.qa_embeddings` | `chunk_id` | 1024-dim vector per chunk, indexed `ivfflat (vector_cosine_ops)` with `lists=100`. |
| `qa_bank.qa_feedback` | `id` | Thumbs-up/down on retrieved chunks per PQR. Drives future re-ranking. |

## Ingestion flow

Ingestion is single-pathed through the `qa-ingest` edge function
(`services/edge-functions/qa-ingest/`):

```
    caller ──(admin bearer)──▶  qa-ingest
                                     │
                                     ├─▶  storage.download('qa-corpus/...')
                                     │
                                     ├─▶  chunkMarkdown()   (heading-aware, ~800 tokens, 100 overlap)
                                     │
                                     ├─▶  Azure nella-embeddings  (1024-dim)
                                     │
                                     └─▶  insert into qa_documents, qa_chunks, qa_embeddings
```

Writes use the Supabase service-role key (bypasses RLS). The admin bearer
key (`QA_INGEST_ADMIN_KEY`) is the outer auth — rotate it independently of
the service-role key.

The chunker is duplicated between `packages/rag/src/chunking.ts` (Node,
canonical + tested) and `services/edge-functions/qa-ingest/chunking.ts`
(Deno, hand-synced). The canonical Vitest suite covers both implementations
since the logic is identical.

## Retrieval and the fallback chain

See `docs/nella-indexing.md` for the nella → pgvector → FTS fallback chain.
Summary:

1. **nella MCP (hybrid)** — tries the managed vector+keyword index first.
   2.5-second timeout race; any error, timeout, or empty response falls
   through.
2. **pgvector** — `qa_bank.qa_embeddings` cosine similarity against the
   query vector (embedded via the same Azure `nella-embeddings` deployment).
3. **FTS** — `to_tsvector('spanish', text)` against `qa_chunks.text` as a
   pure-keyword safety net.

## RLS invariants

Enforced by `supabase/migrations/20260419110100_qa_rls.sql` and re-asserted
on every migration apply via a `do $$` block.

- `app_operational` has **no** `USAGE` on the `qa_bank` schema and **no**
  `SELECT` on any `qa_bank.*` table.
- `app_qa_reader` has `USAGE` on the `qa_bank` schema and `SELECT` on every
  `qa_bank.*` table.
- RLS is **enabled** on all five `qa_bank` tables.
- `app_qa_reader` has a `SELECT` policy allowing reads of every row.
- No `INSERT / UPDATE / DELETE` policies exist — writes require service-role
  (which bypasses RLS).

Cross-schema isolation is tested in
`tests/rls/cross-schema-isolation.test.ts`. Add a new assertion there any
time you introduce a new table — the test programmatically discovers all
`qa_bank.*` base tables so one assertion covers all of them.

## Storage bucket

The `qa-corpus` bucket (`supabase/migrations/20260418170000_bootstrap.sql:82-84`)
is private. Policies added in
`supabase/migrations/20260419110200_qa_storage.sql`:

- `app_qa_reader` gets `SELECT` on any object in the `qa-corpus` bucket
  (for signed-URL issuance).
- `app_operational` is explicitly denied for `SELECT / INSERT / UPDATE /
  DELETE` via restrictive policies — belt-and-suspenders on top of not
  having a permissive policy in the first place.
- Writes continue to require the service-role key.

## Corpus manifest

`fixtures/qa-corpus/manifest.json` lists the canonical sources the Q&A bank
expects. PDFs / full texts are NEVER committed to git (copyright, redaction
concerns) — the manifest is just a map of `id → storagePath` for operators
and CI.

## Env var summary

| Name | Where |
| ---- | ----- |
| `DATABASE_URL_QA_READER` | Server-side `app_qa_reader` connection string |
| `AZURE_EMBEDDINGS_ENDPOINT` / `AZURE_EMBEDDINGS_KEY` | Shared with reembed-pqr |
| `QA_INGEST_ADMIN_KEY` | Outer bearer auth for qa-ingest edge function |
| `NELLA_MCP_ENDPOINT` / `NELLA_MCP_TOKEN` | Optional — enables nella hop |
