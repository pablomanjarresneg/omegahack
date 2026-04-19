# @omega/secretaria

App dedicada al flujo de una secretaría (dependencia de la alcaldía). Next.js 14 en el puerto **3002**.

## Responsabilidades

- Panel por secretaría: casos asignados, métricas propias, cumplimiento de plazos.
- Asignación a funcionarios internos de la secretaría.
- Redacción y aprobación de respuestas dentro del alcance de la secretaría.

Conceptualmente es un subconjunto del workbench, pero se mantiene aparte para que una secretaría pueda operar con scoping estricto (solo sus casos, sus funcionarios, sus KPIs).

## Dependencias

- `@omega/db` — cliente Supabase operacional.
- `@omega/deadline-engine` — plazos.
- `lucide-react`, `clsx`.

## Variables de entorno

Ver `apps/secretaria/.env.example`.

## Comandos

```bash
pnpm --filter @omega/secretaria dev       # http://localhost:3002
pnpm --filter @omega/secretaria build
pnpm --filter @omega/secretaria typecheck
```

## Despliegue

**No enlazada a Vercel por decisión.** Se desplegará cuando la estrategia de hosting por secretaría esté definida.
