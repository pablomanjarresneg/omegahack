# 00 — Local setup runbook

Reproducible setup for the OmegaHack monorepo. Target: a new contributor gets from zero to `pnpm dev` in under 10 minutes.

## 1. Prerequisites

- **Node** ≥ 20 (`node --version`)
- **pnpm** ≥ 10 (`pnpm --version`; install via `corepack enable pnpm`)
- **Supabase CLI** ≥ 2.90 (`brew install supabase/tap/supabase`)
- **Vercel CLI** (`pnpm add -g vercel@50.32.5`)
- **psql** (libpq) for verification (`brew install libpq && brew link --force libpq`)

## 2. Clone + install

```bash
git clone <repo-url> omegahack
cd omegahack
pnpm install
```

## 3. Supabase — link to remote project (no local stack)

```bash
supabase login                                          # one-time per machine
SUPABASE_DB_PASSWORD=<db-pwd> supabase link \
  --project-ref aaidfikktfbhxhlszdlq
```

- `supabase/config.toml` is committed.
- Migrations live in `supabase/migrations/`.

### Apply migrations to remote

```bash
SUPABASE_DB_PASSWORD=<db-pwd> pnpm db:push
```

### Regenerate TypeScript types

Run after any schema change:

```bash
pnpm db:types
git add packages/db/src/types.ts
```

## 4. Environment variables

```bash
cp .env.example .env
# Fill .env with real values (Supabase keys, pooler URLs, etc.).
```

Retrieve Supabase keys:

```bash
supabase projects api-keys --project-ref aaidfikktfbhxhlszdlq
```

Pooler connection (transaction mode, port 6543):

```
postgresql://postgres.aaidfikktfbhxhlszdlq:<db-pwd>@aws-1-us-east-1.pooler.supabase.com:6543/postgres
```

`DATABASE_URL_OPERATIONAL` and `DATABASE_URL_QA_READER` both use the **same** URL — `packages/db/src/supabase-client.ts` scopes per-pool via `SET ROLE` on every new connection.

Per-app `.env.example` files (under `apps/*/.env.example`) list the subset each app needs. Next.js only loads env from the app's own directory, so for local dev also:

```bash
cp apps/web/.env.example       apps/web/.env.local
cp apps/workbench/.env.example apps/workbench/.env.local
cp apps/secretaria/.env.example apps/secretaria/.env.local
# Fill each with values from the root .env.
```

## 5. Vercel — link monorepo apps

Already linked on this machine. For a fresh checkout on a different machine:

```bash
cd apps/web       && vercel link --yes --project omega-web       --scope pablos-projects-2ffaf62c
cd ../workbench   && vercel link --yes --project omega-workbench --scope pablos-projects-2ffaf62c
```

`apps/secretaria` is intentionally not Vercel-linked yet (Phase 0 scope).

To pull real env vars down locally (if you have Vercel access):

```bash
cd apps/web && vercel env pull .env.local
```

## 6. Develop

```bash
pnpm dev                   # runs all apps concurrently
# or run a single app:
pnpm --filter @omega/web       dev   # :3000
pnpm --filter @omega/workbench dev   # :3001
pnpm --filter @omega/secretaria dev  # :3002
```

## 7. Verify end-to-end

```bash
pnpm turbo run build            # all 3 apps + packages must succeed
pnpm -w typecheck               # strict TS, no errors
pnpm db:push --dry-run          # confirms linked + no drift
```

Role boundary smoke check:

```bash
psql "$DATABASE_URL_OPERATIONAL" -c "set role app_operational; \
  select has_schema_privilege('app_operational','qa_bank','USAGE');"
# → expect `f`
```

## 8. Scope deferred to later sessions

- GCP e2-micro VM + n8n + Caddy (Phase 5 prep).
- Sentry + Grafana Cloud project creation (Phase 11 wiring).
- 1Password vault `OmegaHack-Medellin` for shared secrets.
- GitHub branch protection on `main`.
