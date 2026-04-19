# Nella indexing for the PQR corpus

The `@omega/rag` retriever uses **nella MCP** as its preferred index, with a
safety net that falls back to `pgvector` and finally Postgres FTS if nella
is unavailable. This doc explains how to install nella locally, rebuild the
index, and how the fallback chain is wired.

## Install & auth

```bash
# macOS
brew install nella

# One-time authentication — writes to ~/.config/nella/credentials.json
nella auth login
```

The retriever in production expects two environment variables:

| Name | Purpose |
| ---- | ------- |
| `NELLA_MCP_ENDPOINT` | URL of the nella MCP server (e.g., `https://nella.example.com/mcp`) |
| `NELLA_MCP_TOKEN` | Bearer token for nella MCP |

When either is missing, the nella hop is skipped silently and the retriever
runs pgvector → FTS only. This keeps dev loops fast without nella set up.

## Rebuilding the index

```bash
# One-shot: export fresh PQR corpus with PII redaction, then reindex.
./scripts/nella-reindex.sh

# Or, if you already exported and just want to reindex:
nella index --workspace ./fixtures/pqr-corpus --force
```

`scripts/nella-reindex.sh` calls:

1. `scripts/export-pqr-corpus.ts` — pulls the latest PQRs from Supabase and
   redacts PII via `@omega/habeas-data` before writing markdown to
   `fixtures/pqr-corpus/<pqr_id>.md`.
2. `scripts/verify-nella-index.ts` — greps the export for cédula / email /
   phone leaks; fails the reindex if any hit survives redaction.
3. `nella index --workspace ./fixtures/pqr-corpus --force` — rebuilds the
   nella workspace.

The reindex deliberately does NOT run in CI. Live `nella index` is a
manual step once `nella auth login` has been completed.

## Fallback chain

```
                ┌────────────────────────────────────────────┐
                │          packages/rag — nellaSearch        │
                └──────────────┬─────────────────────────────┘
                               │
                               ▼
                  ┌───────────────────────────┐
                  │  hop 1: nella MCP         │
                  │  mode = "hybrid"          │
                  │  Promise.race(2500ms)     │
                  └──┬────────────────────────┘
                     │
           timeout   │   auth err   │   empty result
           ────────┐ │ ┌───────────┐│┌───────────┐
                   ▼ ▼ ▼           ▼▼▼
                  ┌───────────────────────────┐
                  │  hop 2: pgvector          │
                  │  qa_bank.qa_embeddings    │
                  │  embedding <=> query_vec  │
                  └──┬────────────────────────┘
                     │
             error   │   empty result
            ─────────▼──────────────
                  ┌───────────────────────────┐
                  │  hop 3: FTS (keyword)     │
                  │  to_tsvector('spanish')   │
                  │  @@ plainto_tsquery(…)    │
                  └──┬────────────────────────┘
                     │
                     ▼
              RetrievedChunk[]  (uniform shape, `source` field tagged)
```

Every hop emits a telemetry event of shape
`{ source, latency_ms, error, result_count }` — wire a `telemetry` callback
into `nellaSearch` to surface this in logs/metrics.

## Troubleshooting

- **`nella: command not found`** — `brew install nella` (or your package
  manager's equivalent). Check `which nella`.
- **`nella auth: not logged in`** — run `nella auth login`. Token lives in
  `~/.config/nella/credentials.json`.
- **Retriever always returns FTS results** — likely both nella and pgvector
  hops are failing. Check:
  - `NELLA_MCP_ENDPOINT` / `NELLA_MCP_TOKEN` env vars
  - Azure embeddings creds (`AZURE_EMBEDDINGS_ENDPOINT` / `AZURE_EMBEDDINGS_KEY`)
  - Connection to `DATABASE_URL_QA_READER`
- **`verify-nella-index` fails with a cédula / email hit** — a redaction
  pattern is missing. Update `packages/habeas-data/src/redact-text.ts` and
  add a test under `packages/habeas-data/test/redact-text.test.ts` before
  rerunning the reindex.

## Why three stages?

- **nella** gives us hybrid search quality without us managing the index.
- **pgvector** is our ground truth — always available when the database
  is, and perfectly deterministic.
- **FTS** is the "never break the UI" fallback. Slower and less semantically
  accurate, but it cannot silently return nothing; a corpus with any
  relevant keyword at all produces at least one result.
