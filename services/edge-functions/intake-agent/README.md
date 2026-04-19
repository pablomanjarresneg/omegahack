# intake-agent Edge Function

Expone `@omega/intake-agent` como HTTP POST. Recibe un `NormalizedIntake`, resuelve el tenant, corre el pipeline completo (validez + clasificación + tags + problem-group + resumen) y devuelve el `IntakeAgentRun`.

## Invocación

```bash
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "intake": { ... },
    "tenant": {
      "tenantId": "00000000-0000-0000-0000-000000000001",
      "tenantSlug": "alcaldia-medellin",
      "defaultSecretariaCodigo": "DESP"
    }
  }' \
  "$SUPABASE_URL/functions/v1/intake-agent"
```

Formas alternativas de pasar el tenant:

- `tenant_id` y `tenant_slug` a nivel raíz del body.
- Header `x-tenant-id`.
- Env var `DEFAULT_TENANT_ID` (para entornos single-tenant).

Si el `body` no trae clave `intake`, el resto del body se interpreta como el intake completo (envelope implícito).

## Respuestas

- `200` — `IntakeAgentRun` con `{ accepted: true, classification, tags, problemGroup, resumen, events[] }` o `{ bounced: true, invalidReasons[] }`.
- `400 IntakeValidationError` — payload malformado. Body: `{ error, issues: ValidationIssue[] }`.
- `400` — `tenantId is required` cuando no se pudo resolver.
- `405` — método distinto de POST.
- `500 intake-agent failed` — error no esperado; el detalle queda en logs.

## Env vars

| Variable | Requerida | Propósito |
| --- | --- | --- |
| `SUPABASE_URL` | sí | Inyectada. |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Inyectada; para escribir a `public.*`. |
| `DEFAULT_TENANT_ID` | no | Fallback cuando el body no trae tenant. |
| `ANTHROPIC_API_KEY` | sí (si el clasificador real se usa) | Claude. |

## Dependencias del pipeline

El handler delega en `packages/intake-agent/src/index.ts` — Deno importa TypeScript directo por ruta relativa. Cambios en los paquetes se reflejan al re-desplegar.

## Deploy

```bash
supabase functions deploy intake-agent --project-ref <project-ref>
supabase secrets set ANTHROPIC_API_KEY="..." DEFAULT_TENANT_ID="..."
```
