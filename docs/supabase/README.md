# Supabase

Supabase aloja todo el estado de OmegaHack: Postgres + pgvector, RLS, Storage, Edge Functions y cron. No corremos una base local; el monorepo se enlaza al proyecto remoto con el CLI.

## Contenido de esta carpeta

- [`esquema.md`](esquema.md) — tablas y vistas por dominio.
- [`rls.md`](rls.md) — modelo de roles y Row Level Security.
- [`edge-functions.md`](edge-functions.md) — catálogo de las funciones Deno.

## Flujo de migraciones

`supabase/migrations/*.sql` **está gitignoreado por diseño**. Los archivos viven en la máquina de quien autora el cambio y se aplican al remoto con:

```bash
SUPABASE_DB_PASSWORD=<db-pwd> pnpm db:push
```

Consecuencias prácticas:

- La **fuente de verdad del esquema es el proyecto Supabase enlazado**, no la carpeta `supabase/migrations`.
- Para ver qué está aplicado: `supabase db diff` o `supabase migration list`.
- Para generar una migración nueva: `supabase migration new <nombre>` (o `supabase db diff -f <nombre>` tras cambios por dashboard).
- Los tipos TypeScript (`packages/db/src/types.ts`) se regeneran desde el remoto: `pnpm db:types`.

Nunca usar el MCP `apply_migration`, ni el dashboard SQL Editor, ni `psql` directo para DDL. Todo DDL pasa por el CLI.

## Capas del esquema

| Capa | Schemas / tablas | Responsabilidad |
| --- | --- | --- |
| Tenants | `public.tenants` | Raíz del grafo multi-tenant. |
| Catálogos | `public.comunas`, `public.secretarias`, `public.functionaries`, `public.citizens`, `public.holidays` | Datos de referencia. Comunas/secretarías/holidays se regeneran con `scripts/gen-reference-data-migration.mjs` desde `fixtures/*.json`. |
| Núcleo PQR | `public.pqr`, `public.pqr_events`, `public.responses`, `public.attachments`, `public.pqr_clusters` | Caso ciudadano + historial + respuestas + adjuntos. |
| Auditoría | `public.pqr_audit` | Append-only. Triggers `audit_row()` en cada tabla protegida. |
| Indexación | `public.pqr_embeddings`, `public.pqr_embedding_jobs` | 1024-dim vectores + cola drainada por `reembed-pqr`. |
| Tags | `public.tags`, `public.pqr_tags` | Taxonomía namespaced. |
| Agrupación | `public.problem_groups`, `public.pqr_problem_group_members` | Clustering de PQRs recurrentes. |
| Memoria | `public.simple_memory` | Contexto rolling por ciudadano inyectado al prompt del clasificador. |
| Transparencia | Vistas `public.transparency_*` | Agregados públicos consumidos por `apps/web/transparencia`. |
| Q&A corpus | `qa_bank.qa_sources`, `qa_documents`, `qa_chunks`, `qa_embeddings`, `qa_feedback` | Ley, jurisprudencia y conocimiento indexado. Aislado por `GRANT`. |

## Buckets de Storage

Creados en bootstrap:

- `pqr-attachments` — adjuntos sube-por-ciudadano. RLS por tenant.
- `qa-corpus` — fuentes del Q&A (markdown). Sin acceso anon/auth; solo service-role.

## Cron (`pg_cron` + `net.http_post`)

- `reembed-pqr-drain` cada minuto → dispara la edge function `reembed-pqr`.

Más jobs se agregan aquí conforme el pipeline los necesite.

## Extensiones habilitadas

`pgcrypto`, `vector` (pgvector), `pg_cron`, `pg_net`. Ver `bootstrap.sql` en el proyecto linkeado.
