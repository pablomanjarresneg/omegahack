# @omega/workbench

Consola interna de jurídica. Es donde los funcionarios procesan casos, revisan colas, investigan grupos de problemas y auditan cambios. Next.js 14 (App Router) en el puerto **3001**.

## Responsabilidades

- Revisar casos individuales y redactar respuestas (`/pqr/[id]`).
- Trabajar colas filtradas por secretaría, estado y prioridad (`/queue`, `/bandeja`).
- Navegar grupos de problemas recurrentes (`/grupos`).
- Ver la auditoría append-only (`/auditoria`).
- Vista sectorial para administración (`/alcaldia`).

## Rutas

```
app/
  layout.tsx
  page.tsx                         # redirect a /queue o /bandeja
  pqr/[id]/page.tsx                # detalle de un PQR — hechos, petición, respuestas, eventos, tags
  bandeja/                         # casos asignados al funcionario actual
  queue/                           # cola global filtrable
  grupos/                          # problem groups
  auditoria/                       # pqr_audit viewer
  alcaldia/                        # KPI y vista por secretaría
```

## Dependencias

- `@omega/db` — cliente Supabase operacional.
- `@omega/deadline-engine` — cálculo de progreso de plazo y riesgo en vivo.
- `@supabase/ssr` — sesión funcionaria vía cookies en SSR.
- `lucide-react` — iconografía.
- `clsx` — composición de classes.

## Notificaciones

`apps/workbench/src/lib/citizen-notifications.ts` compone los mensajes que se envían al ciudadano en cada cambio de estado. El envío real pasa por canales externos (correo / SMS / n8n).

## Variables de entorno

Ver `apps/workbench/.env.example`. Requiere Supabase URL/keys y — cuando está habilitado — un token para la integración saliente de notificaciones.

## Comandos

```bash
pnpm --filter @omega/workbench dev       # http://localhost:3001
pnpm --filter @omega/workbench build
pnpm --filter @omega/workbench typecheck
```

## Despliegue

Proyecto Vercel: `omega-workbench`. Protegido con auth (solo funcionarios con JWT que lleva `tenant_id` + `role`).
