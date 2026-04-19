# reembed-pqr Edge Function

Drains `public.pqr_embedding_jobs` and writes 1024-dim embeddings for each PQR
into `public.pqr_embeddings` (kinds: `full`, `lead`, `peticion`). Invoked on a
cron schedule. The public URL stays behind Supabase auth, and the handler
additionally requires a `Bearer <service-role-key>` header.

## Layout

```
services/edge-functions/reembed-pqr/
  index.ts                       # Deno handler + queue drain
  embed.ts                       # Azure + deterministic stub embedding
  deno.json                      # Deno config + task aliases
  deterministic-embed.test.ts    # Unit tests for the stub embedding
```

## Environment variables

| Var                         | Required | Default                   | Purpose                                             |
| --------------------------- | -------- | ------------------------- | --------------------------------------------------- |
| `SUPABASE_URL`              | yes      | (injected by Supabase)    | Project URL                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | (injected by Supabase)    | Used both to auth the caller and to sign DB writes  |
| `AZURE_EMBEDDINGS_ENDPOINT` | no       | _(empty)_                 | Azure `nella-embeddings` URL. Absent → stub path    |
| `AZURE_EMBEDDINGS_KEY`      | no       | _(empty)_                 | Azure API key                                       |
| `EMBEDDING_MODEL_VERSION`   | no       | `stub-deterministic-v1`   | Stored on `pqr_embeddings.model_version`            |
| `REEMBED_BATCH_SIZE`        | no       | `10`                      | Max jobs drained per invocation                     |

> When `AZURE_EMBEDDINGS_ENDPOINT` / `AZURE_EMBEDDINGS_KEY` are unset the
> function ships a **deterministic stub embedding** (SHA-256-seeded mulberry32
> PRNG → Box–Muller → L2-normalized), so the entire intake → embed → search
> pipeline can be exercised end-to-end in dev and CI without external
> credentials. Same input always produces the same 1024-dim unit vector.

## Deploy

```sh
# From repo root:
supabase functions deploy reembed-pqr \
  --project-ref aaidfikktfbhxhlszdlq \
  --no-verify-jwt=false

# Set secrets (only Azure creds + model version — Supabase injects the rest):
supabase secrets set \
  AZURE_EMBEDDINGS_ENDPOINT="https://...azure.com/openai/deployments/nella-embeddings/embeddings?api-version=2024-02-15-preview" \
  AZURE_EMBEDDINGS_KEY="..." \
  EMBEDDING_MODEL_VERSION="nella-embeddings-v1" \
  REEMBED_BATCH_SIZE="10"
```

## Invoke manually

```sh
# Grab the service-role key and project ref from `.env`, then:
curl -X POST \
  "https://<project-ref>.supabase.co/functions/v1/reembed-pqr" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Expected response:

```json
{ "processed": 3, "succeeded": 3, "failed": 0, "batch_size": 10 }
```

## Schedule (Supabase cron)

Create a `pg_cron` job that POSTs to the function URL every minute:

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

## Local tests

```sh
cd services/edge-functions/reembed-pqr
deno task test
```

The test file only exercises `deterministicEmbed` — it has no network/DB
dependency, so it runs in seconds in CI.

## How it works

1. Authenticates the caller by comparing the `Authorization: Bearer …` header
   against `SUPABASE_SERVICE_ROLE_KEY`.
2. Calls `public.drain_reembed_batch(batch_size)` (SECURITY DEFINER RPC) to
   atomically lock up to `REEMBED_BATCH_SIZE` `queued` rows via
   `FOR UPDATE SKIP LOCKED` and flip them to `running`.
3. For each job: loads `pqr.hechos|peticion|lead`, builds three payload
   strings (`full = hechos + peticion + lead`, `lead`, `peticion`), embeds
   each, and upserts into `pqr_embeddings` with
   `onConflict: 'pqr_id,kind,model_version'`.
4. On success → marks job `done`. On failure → increments `attempt_count`,
   stores `last_error`, and marks the job `failed` once `attempt_count >= 3`
   (otherwise re-queues to `queued` for another pass).
