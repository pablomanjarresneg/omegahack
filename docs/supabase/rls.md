# Row Level Security

Supabase aplica RLS en cada tabla de negocio. Este documento describe los tres roles de aplicación y cómo se aíslan.

## Roles

### `app_operational`
El rol por defecto de las apps Next.js.

- Tiene `USAGE` sobre `public`. **No tiene** `USAGE` sobre `qa_bank`.
- Sus queries quedan filtradas por la política de tenant: solo ven filas donde `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid`.
- No puede hacer `INSERT` sobre `pqr_audit` (append-only vía trigger).

### `app_qa_reader`
Solo lectura sobre `qa_bank`.

- Tiene `USAGE` sobre `qa_bank`. **No tiene** `USAGE` sobre `public`.
- Se usa desde los componentes que recuperan ley/jurisprudencia para el RAG.

### `service_role`
Bypasea RLS. Solo se usa desde edge functions y jobs backend, nunca desde el bundle del cliente.

## Aplicación desde la app

`packages/db` expone tres fábricas:

```ts
import {
  createOperationalClient,
  createQaReaderClient,
  createServiceRoleClient,
} from '@omega/db/client';
```

Cada fábrica devuelve un cliente `@supabase/supabase-js` ya configurado con:

1. La URL + anon key correctas.
2. La cabecera JWT apropiada (cuando hay sesión).
3. Un pool Postgres directo con `options=-c role=<role>` para cuando se necesita `pg` crudo en vez del REST de PostgREST.

## El gotcha de Supavisor

El pooler de Supabase (Supavisor) en **modo transacción** reutiliza conexiones entre queries. Eso rompe el patrón clásico `SET ROLE app_operational;` al inicio de la sesión, porque la siguiente query puede llegar a una conexión física distinta que todavía está como `postgres`.

Solución aplicada: inyectamos el rol en el parámetro `options` del query string, lo que hace que Postgres ejecute `SET ROLE` **al establecer la conexión física**, no al abrir la sesión lógica. Esto sobrevive al reuse de conexiones porque cada conexión física se crea ya con el rol correcto.

Consecuencia: `DATABASE_URL_OPERATIONAL` y `DATABASE_URL_QA_READER` apuntan a la **misma URL base** pero con `options=-c role=app_operational` o `options=-c role=app_qa_reader`.

## Política general de tenant

Toda tabla protegida declara:

```sql
alter table public.<tabla> enable row level security;

create policy tenant_isolation on public.<tabla>
  for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

La JWT se emite con el claim `tenant_id` cuando el funcionario inicia sesión. Un usuario del tenant A jamás puede ver filas del tenant B, ni siquiera con `service_role` si la app expone el cliente equivocado.

## Política sobre `pqr_audit`

Append-only: solo `INSERT` permitido, y únicamente vía el trigger `audit_row()` (que corre como `SECURITY DEFINER`). Ningún rol de aplicación puede `UPDATE` ni `DELETE`.

## Aislamiento de `qa_bank`

El aislamiento es doble:

1. **A nivel de `GRANT`**: `app_operational` no tiene `USAGE` sobre el schema. Intentar `select from qa_bank.qa_chunks` con ese rol devuelve `permission denied for schema qa_bank` antes de siquiera evaluar RLS.
2. **A nivel de RLS**: las tablas de `qa_bank` también tienen políticas, pero son defensivas; el muro real es el grant.

## Storage

### Bucket `pqr-attachments`
- Policy `select / insert` por tenant: el path debe empezar con `tenants/<tenant_id>/`.
- Ciudadano autenticado solo puede subir a su propio `pqrs/<pqr_id>/`.

### Bucket `qa-corpus`
- Sin policies para anon ni authenticated. Solo `service_role` puede leer/escribir.
- La edge function `qa-ingest` autentica con `service_role` + un bearer propio (`QA_INGEST_ADMIN_KEY`) para que el dueño rote acceso sin tocar Supabase.

## Verificación

Smoke check rápido después de cualquier migración:

```bash
psql "$DATABASE_URL_OPERATIONAL" -c \
  "set role app_operational; \
   select has_schema_privilege('app_operational','qa_bank','USAGE');"
# → expect f
```

Suite completa:

```bash
pnpm test:rls
```

La suite carga PQRs de dos tenants distintos, verifica que un cliente del tenant A nunca ve filas del tenant B, y que `app_operational` no puede leer `qa_bank.*`. **Nunca desactivar RLS en una migración para que las pruebas pasen.**
