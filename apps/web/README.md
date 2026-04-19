# @omega/web

Sitio público para ciudadanos y portal de transparencia. Next.js 14 (App Router) en el puerto **3000**.

## Responsabilidades

- Home pública — información de la plataforma y link al workbench de jurídica.
- `/transparencia` — dashboard público con agregados por comuna, secretaría y tendencia mensual. Consume las vistas `public.transparency_*` (k-anonymity ≥ 5 aplicado en la BD).
- `/api/*` — route handlers para captura de PQRs desde el formulario público y endpoints auxiliares.

## Rutas

```
app/
  layout.tsx
  page.tsx                         # home
  transparencia/                   # dashboard público
  api/                             # route handlers (POST intake, GET salud)
```

## Dependencias

- `@omega/db` — cliente Supabase con `SET ROLE app_operational` para lecturas server-side.
- `@supabase/supabase-js` — cliente desde el navegador donde se necesita.
- `leaflet` + `react-leaflet` — mapa de densidad por comuna.
- `recharts` — gráficos del dashboard de transparencia.

## Variables de entorno

Ver `apps/web/.env.example`. El bundle del cliente solo recibe las variables con prefijo `NEXT_PUBLIC_`.

## Comandos

```bash
pnpm --filter @omega/web dev           # http://localhost:3000
pnpm --filter @omega/web build
pnpm --filter @omega/web typecheck
```

## Despliegue

Proyecto Vercel: `omega-web`. Se deploya desde `main`; las PRs generan preview deployments automáticos.
