# Setup

Runbook reproducible para levantar el monorepo desde cero. Objetivo: un contribuyente nuevo llega a `pnpm dev` en menos de 10 minutos.

## 1. Prerrequisitos

- **Node** ≥ 20 (`node --version`).
- **pnpm** ≥ 10 (`corepack enable pnpm && corepack prepare pnpm@latest --activate`).
- **Supabase CLI** ≥ 2.90 (`brew install supabase/tap/supabase`).
- **Vercel CLI** (`pnpm add -g vercel`) — solo si vas a desplegar.
- **psql** (`brew install libpq && brew link --force libpq`) — solo para verificar RLS.

## 2. Clonar e instalar

```bash
git clone <repo-url> omegahack
cd omegahack
pnpm install
```

## 3. Enlazar Supabase

El monorepo no arranca una base local; trabaja contra el proyecto Supabase remoto.

```bash
supabase login                                         # una vez por máquina
SUPABASE_DB_PASSWORD=<db-pwd> supabase link \
  --project-ref <project-ref>
```

Reemplaza `<project-ref>` por el ID del proyecto. `supabase/config.toml` ya está versionado.

### Aplicar migraciones al remoto

Las migraciones viven en `supabase/migrations/` como archivos locales **no versionados en git** (ver `.gitignore`). El flujo oficial es:

```bash
SUPABASE_DB_PASSWORD=<db-pwd> pnpm db:push
```

Nunca apliques migraciones por otra vía (dashboard, MCP, SQL directo). El CLI es la única fuente de verdad.

### Datos sintéticos de demo

`supabase/config.toml` carga `supabase/seed.sql` durante `supabase db reset`. Para aplicar el mismo seed sobre un remoto ya migrado:

```bash
supabase db query --linked --file supabase/seed.sql
```

### Regenerar tipos TypeScript

Tras cada cambio de esquema:

```bash
pnpm db:types
git add packages/db/src/types.ts
```

## 4. Variables de entorno

```bash
cp .env.example .env
```

Completa con valores reales. Las claves de Supabase se obtienen con:

```bash
supabase projects api-keys --project-ref <project-ref>
```

La URL del pooler (modo transacción, puerto 6543) tiene la forma:

```
postgresql://postgres.<project-ref>:<db-pwd>@<pooler-host>:6543/postgres
```

`DATABASE_URL_OPERATIONAL` y `DATABASE_URL_QA_READER` **usan la misma URL**. El cliente en `packages/db/src/supabase-client.ts` ejecuta `SET ROLE` en cada nueva conexión para aislar los dos perfiles.

### Envs por app

Next.js solo carga variables desde el directorio de la propia app. Para dev local:

```bash
cp apps/web/.env.example       apps/web/.env.local
cp apps/workbench/.env.example apps/workbench/.env.local
cp apps/secretaria/.env.example apps/secretaria/.env.local
```

Completa cada `.env.local` con el subconjunto que requiera la app.

## 5. Enlazar Vercel (opcional)

Solo si vas a desplegar desde tu máquina:

```bash
cd apps/web       && vercel link --yes --project <omega-web-project>
cd ../workbench   && vercel link --yes --project <omega-workbench-project>
```

`apps/secretaria` no está enlazada a Vercel por decisión.

Para bajar variables reales desde Vercel:

```bash
cd apps/web && vercel env pull .env.local
```

## 6. Desarrollar

```bash
pnpm dev                               # los tres apps en paralelo
# o un solo app:
pnpm --filter @omega/web       dev     # http://localhost:3000
pnpm --filter @omega/workbench dev     # http://localhost:3001
pnpm --filter @omega/secretaria dev    # http://localhost:3002
```

## 7. Verificación end-to-end

```bash
pnpm build                      # todos los paquetes y apps deben compilar
pnpm typecheck                  # TypeScript estricto sin errores
pnpm test                       # vitest en todo el workspace
pnpm db:diff                    # confirma que local y remoto no divergen
```

Smoke-check de límites de rol:

```bash
psql "$DATABASE_URL_OPERATIONAL" \
  -c "set role app_operational; select has_schema_privilege('app_operational','qa_bank','USAGE');"
# → espera f (falso)
```

## 8. Problemas frecuentes

- **`SET ROLE` falla al conectar por Supavisor**: el pooler en modo transacción no persiste `SET ROLE` entre queries. `packages/db` resuelve esto inyectando `options=-c role=<role>` en la URL. Si escribes scripts nuevos, reusa las fábricas de `@omega/db`.
- **Tipos desincronizados**: ejecuta `pnpm db:types` y commitea `packages/db/src/types.ts`.
- **`supabase db push` se niega con drift**: corre `pnpm db:diff` para ver qué cambió, y regenera migración si es necesario.
