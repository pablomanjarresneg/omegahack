# @omega/db

Clientes Supabase para las apps del monorepo. Encapsula el patrón de `SET ROLE` sobre Supavisor y expone los tipos generados desde el esquema remoto.

## Superficie pública

```ts
import {
  createOperationalClient,
  createQaReaderClient,
  createServiceRoleClient,
} from '@omega/db/client';
import type { Database } from '@omega/db/types';
```

- `createOperationalClient()` — cliente con `SET ROLE app_operational`. Lectura/escritura sobre `public.*` filtrada por RLS de tenant. Uso por defecto desde las apps.
- `createQaReaderClient()` — cliente con `SET ROLE app_qa_reader`. Solo lectura sobre `qa_bank.*`.
- `createServiceRoleClient()` — bypass de RLS. Solo en edge functions y jobs backend.
- `Database` — tipos generados desde el esquema con `supabase gen types typescript --linked`.

## Queries compartidas

Queries reutilizables para vistas derivadas:

```ts
import * as transparency from '@omega/db/queries/transparency';
```

## El gotcha de Supavisor

Supavisor en modo transacción reutiliza conexiones físicas entre queries, lo que rompe `SET ROLE` como sentencia separada. Por eso las URLs de pool incluyen `options=-c role=<role>` en el query string: Postgres aplica el rol al abrir la conexión física, no al abrir la sesión lógica.

`DATABASE_URL_OPERATIONAL` y `DATABASE_URL_QA_READER` comparten la misma URL base; solo difieren en ese parámetro.

## Regenerar tipos

Desde la raíz del repo, después de cualquier migración:

```bash
pnpm db:types
git add packages/db/src/types.ts
```

## Scripts

```bash
pnpm --filter @omega/db typecheck
pnpm --filter @omega/db test
```
