# OmegaHack

Plataforma multi-agente de PQRSD para la Alcaldía de Medellín. Ingesta casos ciudadanos (petición, queja, reclamo, oposición, sugerencia, denuncia), los valida bajo el Art. 16 de la Ley 1755/2015, los clasifica por secretaría y territorio, calcula plazos legales, detecta problemas recurrentes y entrega todo a un workbench de jurídica.

## Entregable del Mini Reto Valor

El deck del reto vive en [`retos/mini_reto-valor/`](retos/mini_reto-valor/) — incluye el [Reto de Valor.pdf](retos/mini_reto-valor/Reto%20de%20Valor.pdf) y un workflow de n8n (`workflow.json`) que implementa el intake end-to-end.

## Arranque rápido

```bash
pnpm install
cp .env.example .env           # completar con los secretos reales
pnpm dev                       # levanta web, workbench y secretaria
```

Detalle paso a paso: [`docs/setup.md`](docs/setup.md).

## Layout del monorepo

| Ruta | Qué vive ahí |
| --- | --- |
| `apps/web` | Sitio público para el ciudadano + `/transparencia` + endpoints `/api/*`. Next.js, puerto 3000. |
| `apps/workbench` | Consola de jurídica. Bandeja, colas, auditoría, grupos de problemas. Next.js, puerto 3001. |
| `apps/secretaria` | Vista por secretaría. Next.js, puerto 3002. |
| `packages/classifier` | Clasificador de PQR con Claude — tipo, secretaría, territorio, tags, señales. |
| `packages/db` | Clientes Supabase con `SET ROLE` y tipos generados del esquema. |
| `packages/deadline-engine` | Motor de plazos hábiles colombianos (Ley Emiliani + suspensiones). Sin dependencias de red. |
| `packages/habeas-data` | Redacción y clasificación de PII según Ley 1581/2012. |
| `packages/intake-agent` | Orquestador: validez → clasificación → tags → problem-group. |
| `packages/problem-groups` | Agrupación de PQRs por similitud + tags + comuna. |
| `packages/rag` | Chunking, embeddings Azure (1024-dim) y búsqueda vectorial / FTS. |
| `packages/search` | Búsqueda de PQRs (vector + FTS + filtros). |
| `packages/tags` | Taxonomía de tags y filtros de cola. |
| `packages/config-ts`, `packages/config-eslint` | Configs base compartidas. |
| `services/edge-functions` | Funciones Deno desplegadas en Supabase (`intake-agent`, `qa-ingest`, `reembed-pqr`). |
| `supabase/` | Config + seed. Migraciones se aplican con `supabase db push` (no versionadas en git). |
| `fixtures/` | Taxonomías, festivos, secretarías, comunas. |
| `retos/mini_reto-valor/` | Entregable del reto (PDF + workflow n8n). |
| `docs/` | Documentación pública de la plataforma. |

## Stack

- **Runtime**: Node 20+, pnpm 10+, Turborepo, TypeScript estricto.
- **Frontend**: Next.js 14 (App Router), React 18, Tailwind.
- **Backend**: Supabase (Postgres + pgvector + RLS + Storage + Edge Functions + cron).
- **IA**: Anthropic Claude (clasificador), Azure `nella-embeddings` (vectores), Google Gemini (versión n8n del intake).
- **Automatización**: n8n (host externo) — ver [`docs/n8n.md`](docs/n8n.md).
- **Testing**: Vitest + fast-check (property tests) + RLS tests con `psql`.

## Documentación

- [Arquitectura](docs/arquitectura.md) — flujo de datos y límites de confianza.
- [Setup](docs/setup.md) — instalación desde cero.
- [Desarrollo](docs/desarrollo.md) — comandos turbo, filtros, testing, env.
- [Supabase](docs/supabase/README.md) — esquema, RLS, edge functions.
- [n8n](docs/n8n.md) — integración y workflow de intake.

Cada `apps/*` y `packages/*` tiene su propio README con superficie pública y dependencias.

## Scripts raíz

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Levanta los tres apps en paralelo. |
| `pnpm build` | Build de todos los paquetes + apps. |
| `pnpm test` | Suite de vitest vía turbo. |
| `pnpm test:rls` | Pruebas de Row Level Security contra la BD remota. |
| `pnpm typecheck` | TypeScript estricto en todo el workspace. |
| `pnpm db:push` | Aplica migraciones locales al proyecto Supabase enlazado. |
| `pnpm db:types` | Regenera `packages/db/src/types.ts` desde el esquema remoto. |
| `pnpm db:diff` | Diff del esquema local vs remoto. |

## Licencia

Proyecto interno — sin licencia pública.
