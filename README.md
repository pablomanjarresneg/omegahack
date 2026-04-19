# OmegaHack

Plataforma multiagente para gestion de PQRSD de la Alcaldia de Medellin.

Este repositorio es un monorepo con:
- aplicaciones web para atencion ciudadana y operacion interna,
- paquetes TypeScript de dominio (clasificacion, plazos, RAG, privacidad, busqueda),
- edge functions en Supabase para procesos backend,
- integracion con n8n para intake publico y automatizaciones.

Actualizado segun el estado del codigo al **2026-04-19**.

## Arquitectura en 30 segundos

1. El ciudadano radica una PQRSD (portal web y/o webhook de n8n).
2. El intake agent valida, deduplica, clasifica y asigna prioridad/plazo legal.
3. Se persiste en Supabase Postgres (con RLS por tenant).
4. Se indexa para busqueda semantica (pgvector + nella como capa preferida).
5. Los equipos internos operan desde Workbench y Secretaria.

## Estructura del monorepo

```text
.
|- apps/
|  |- landing/      # Portal ciudadano (TanStack Start + Vite)
|  |- web/          # Front publico Next.js
|  |- workbench/    # Consola interna juridica Next.js
|  '- secretaria/   # Vista operativa por dependencia Next.js
|- packages/
|  |- classifier/
|  |- db/
|  |- deadline-engine/
|  |- habeas-data/
|  |- intake-agent/
|  |- problem-groups/
|  |- rag/
|  |- search/
|  |- tags/
|  |- config-eslint/
|  '- config-ts/
|- services/
|  '- edge-functions/
|     |- intake-agent/
|     |- pqr-nella-indexer/
|     |- qa-ingest/
|     '- reembed-pqr/
|- supabase/
|- docs/
|- tests/
|  '- rls/
|- scripts/
`- fixtures/
```

## Apps

| App | Stack | Proposito | Comando |
| --- | --- | --- | --- |
| `@omega/landing` | TanStack Start + Vite + React 19 | Portal ciudadano y radicacion PQRSD (incluye modo demo si no hay webhook) | `pnpm --filter @omega/landing dev` |
| `@omega/web` | Next.js 14 + React 18 | Front web publico/transparencia | `pnpm --filter @omega/web dev` (puerto 3000) |
| `@omega/workbench` | Next.js 14 + React 18 | Consola interna (cola juridica, operacion) | `pnpm --filter @omega/workbench dev` (puerto 3001) |
| `@omega/secretaria` | Next.js 14 + React 18 | Vista sectorial por secretaria | `pnpm --filter @omega/secretaria dev` (puerto 3002) |

## Paquetes clave

| Paquete | Responsabilidad |
| --- | --- |
| `@omega/intake-agent` | Pipeline de ingesta: validacion, deduplicacion, bounce rules, clasificacion y eventos. |
| `@omega/classifier` | Clasificacion semantica (tipo PQR, secretaria, comuna, tags, senales auxiliares). |
| `@omega/deadline-engine` | Calculo de plazos habiles Colombia (Ley 1755, Emiliani, suspensiones). |
| `@omega/habeas-data` | Redaccion y controles de PII para cumplimiento de datos personales. |
| `@omega/problem-groups` | Agrupacion de casos similares por embedding + contexto. |
| `@omega/rag` | Chunking, retrieval hibrido (nella/pgvector/FTS) y renderer de corpus. |
| `@omega/search` | Busqueda y filtros de PQRs. |
| `@omega/db` | Fabrica de clientes operativos con roles (`app_operational`, `app_qa_reader`, `service_role`). |
| `@omega/tags` | Taxonomias y utilidades de etiquetado. |

## Requisitos

- Node.js >= 20
- pnpm >= 10
- Supabase CLI >= 2.90
- (Opcional) Deno para pruebas locales de edge functions

## Setup rapido

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/workbench/.env.example apps/workbench/.env.local
cp apps/secretaria/.env.example apps/secretaria/.env.local
```

Notas:
- `apps/landing` usa `envDir` en la raiz, por lo que lee variables desde `.env`.
- Para conectar landing con n8n debes definir `VITE_N8N_WEBHOOK_BASE_URL` en `.env`.
- Si esa variable no existe, landing radica en modo demo local.

### 3. Enlazar Supabase remoto

```bash
supabase login
SUPABASE_DB_PASSWORD=<db-pwd> supabase link --project-ref <project-ref>
```

### 4. Sincronizar esquema/tipos

```bash
pnpm db:push
pnpm db:types
pnpm db:diff
```

## Desarrollo

### Levantar todo

```bash
pnpm dev
```

### Levantar solo un app

```bash
pnpm --filter @omega/landing dev
pnpm --filter @omega/web dev
pnpm --filter @omega/workbench dev
pnpm --filter @omega/secretaria dev
```

## Calidad y pruebas

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:rls
```

Comandos utiles por paquete:
- `pnpm --filter @omega/classifier eval`
- `pnpm --filter @omega/deadline-engine test:coverage`
- `pnpm --filter @omega/deadline-engine generate:golden`

## Edge functions (Supabase)

Funciones actuales:
- `intake-agent`
- `pqr-nella-indexer`
- `qa-ingest`
- `reembed-pqr`

Deploy:

```bash
supabase functions deploy intake-agent --project-ref <project-ref>
supabase functions deploy pqr-nella-indexer --project-ref <project-ref>
supabase functions deploy qa-ingest --project-ref <project-ref>
supabase functions deploy reembed-pqr --project-ref <project-ref>
```

Pruebas locales disponibles:

```bash
cd services/edge-functions/qa-ingest && deno task test
cd services/edge-functions/reembed-pqr && deno task test
```

## n8n y pipeline de intake

- El webhook principal del intake vive en n8n (`POST /webhook/pqrs/intake`).
- Landing envia a ese webhook cuando `VITE_N8N_WEBHOOK_BASE_URL` esta configurado.
- El workflow persiste en Supabase y puede disparar indexacion nella.

Referencia operacional: [docs/n8n.md](docs/n8n.md)

## Seguridad y datos

- Modelo multi-tenant con RLS estricto por `tenant_id`.
- Separacion de roles de BD:
  - `app_operational`: negocio diario (`public.*`)
  - `app_qa_reader`: solo lectura de `qa_bank.*`
  - `service_role`: procesos backend (edge functions/jobs)
- `qa_bank` esta aislado por grants + RLS.

Referencias:
- [docs/supabase/rls.md](docs/supabase/rls.md)
- [docs/qa-bank.md](docs/qa-bank.md)

## CI

GitHub Actions ejecuta:
- instalacion con `pnpm install --frozen-lockfile`
- `typecheck`
- `lint`
- `build`

Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)

## Documentacion recomendada

- [docs/setup.md](docs/setup.md)
- [docs/arquitectura.md](docs/arquitectura.md)
- [docs/desarrollo.md](docs/desarrollo.md)
- [docs/n8n.md](docs/n8n.md)
- [docs/nella-indexing.md](docs/nella-indexing.md)
- [docs/qa-bank.md](docs/qa-bank.md)
- [docs/supabase/README.md](docs/supabase/README.md)

## Notas para colaboradores

- Usa `pnpm` (no npm/yarn) para mantener lockfile consistente.
- Evita hardcodear secretos; usa `.env` y secrets de Supabase/n8n.
- Si cambias esquema de BD, actualiza tipos con `pnpm db:types`.
- Si agregas una tabla sensible, valida cobertura de RLS y pruebas en `tests/rls`.

## Uso de IAs
Para el desarrollo de esta solución únicamente utilizamos herramientas gratuitas y APIs gratuitas disponibles para estudiantes. La inteligencia artificial fue empleada como apoyo para optimizar procesos, organizar información y fortalecer la propuesta, sin recurrir a servicios pagos ni a infraestructuras de alto costo. Esto permitió construir una alternativa funcional, accesible y viable dentro de un entorno académico.
