# Desarrollo

Guía operativa para trabajar en el monorepo día a día.

## Turborepo

Las tareas se definen en `turbo.json` y se heredan por cada paquete que las declare.

| Tarea | Qué hace | Cache |
| --- | --- | --- |
| `build` | Compila el paquete. Depende del `build` de sus dependencias internas. | Sí (`.next`, `dist`). |
| `dev` | Levanta servidor de desarrollo. | No. |
| `lint` | ESLint. | Sí. |
| `typecheck` | `tsc --noEmit`. | Sí. |
| `test` | `vitest run`. Depende de `^build`. | Sí (`coverage`). |

### Comandos útiles

```bash
pnpm dev                               # todos los apps
pnpm --filter @omega/workbench dev     # un solo paquete
pnpm --filter "./packages/*" test      # todos los paquetes de librería
pnpm --filter ...@omega/workbench build  # workbench y todas sus deps
turbo run build --affected             # solo lo que cambió respecto a main
```

## TypeScript

- Configs base en `packages/config-ts`: `base.json` para librerías, `nextjs.json` para apps.
- Cada app Next.js tiene un `tsconfig.typecheck.json` aparte para que `typecheck` no choque con el loader de Next.
- `tsconfig.base.json` del repo declara los alias `@omega/*` apuntando a los `src/` de cada paquete.

## Testing

- **Unitario**: `vitest run` por paquete. `test:watch` en desarrollo.
- **Property-based**: `packages/deadline-engine` usa `fast-check` con 10k iteraciones para invariantes (`subtract(add(d,n),n) === d`).
- **Golden fixtures**: `packages/deadline-engine/test/fixtures/golden.json` con 300+ casos deterministas; el generador regenera con `pnpm --filter @omega/deadline-engine generate:golden`.
- **Cobertura**: `pnpm --filter @omega/deadline-engine test:coverage` → 100% líneas.
- **RLS**: `pnpm test:rls` corre suite dedicada contra la BD remota. No apagar RLS en migraciones para hacerlo pasar.
- **Evaluaciones de clasificador**: `pnpm --filter @omega/classifier eval` corre `eval/run.ts` sobre un dataset de casos.

## ESLint

Configs compartidas en `packages/config-eslint`:

- `index.js` — base para librerías.
- `nextjs.js` — extiende con reglas de Next.

Las apps usan `next lint`; los paquetes todavía no tienen lint activo.

## Variables de entorno

Declaradas en `turbo.json` bajo `globalEnv`:

- `NODE_ENV`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL_OPERATIONAL`, `DATABASE_URL_QA_READER`
- `ANTHROPIC_API_KEY`
- `SENTRY_DSN`, `GRAFANA_CLOUD_INSTANCE_ID`
- `N8N_WEBHOOK_BASE_URL`

Cualquier envar que afecte la salida del build debe ir aquí para que el cache de Turbo invalide correctamente.

**Next.js solo lee** `.env.local` **desde el directorio de la propia app.** El `.env` raíz alimenta scripts del workspace (Supabase CLI, Vitest), no las apps. Copia a `apps/*/.env.local` lo que necesite cada una.

## Git

- `main` recibe todo trabajo de feature.
- Las ramas `mini_reto-*` son congeladas; el trabajo del reto ya entregado no bleedea a `main`.
- Los commits se hacen incrementales (uno por paso lógico), nunca agrupados.
- Nunca se añade `Co-Authored-By` a los commits.
- Nunca se fuerza-push a `main`.

## Base de datos

- Migraciones en `supabase/migrations/*.sql` son **locales y gitignoreadas**. Se generan con `supabase migration new <nombre>` o `supabase db diff`, y se aplican con `pnpm db:push`.
- Regenerar tipos tras cada cambio: `pnpm db:types`, commitea `packages/db/src/types.ts`.
- Verificar drift antes de push: `pnpm db:diff`.

## Edge Functions

Deno, no pnpm. Cada función tiene su propio `deno.json`.

```bash
cd services/edge-functions/reembed-pqr
deno task test

# Deploy manual:
supabase functions deploy reembed-pqr --project-ref <project-ref>
```

## Dónde vive qué

- Lógica del dominio de PQR → `packages/intake-agent`.
- Datos legales (plazos, festivos, Ley 1755) → `packages/deadline-engine`.
- Datos regulatorios de PII (Ley 1581/2012) → `packages/habeas-data`.
- Infra BD → `packages/db` + `supabase/*`.
- Routing y UI pública → `apps/web`.
- Routing y UI interna → `apps/workbench`, `apps/secretaria`.
- Jobs largos o con secretos → `services/edge-functions/*` o n8n.

## Estándares de estilo

- Español en UI y prompts; inglés en código y tipos.
- Sin comentarios que describan QUÉ hace el código (los nombres lo dicen); los comentarios solo existen para explicar PORQUÉ cuando no es obvio.
- Sin emojis en código ni en docs salvo si los pide el producto.
- Sin etiquetas de fase en commits, archivos o prosa pública.
