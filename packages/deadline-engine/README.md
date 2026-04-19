# @omega/deadline-engine

Motor de plazos hábiles colombianos. Cero dependencias de runtime. 100% offline. Suite con 393 tests (incluidos 10.000 iteraciones de property test) y 100% cobertura de líneas.

## Superficie pública

```ts
import {
  computeDeadline,
  computeProgress,
  extend,
  PLAZOS,
  isBusinessDay,
  addBusinessDays,
  subtractBusinessDays,
  isHoliday,
  loadHolidays,
  applyEmiliani,
  computeEasterSunday,
  isSuspended,
} from '@omega/deadline-engine';

import type {
  DeadlineResult,
  ProgressResult,
  ExtensionResult,
  ExtensionAuditEvent,
  PqrSnapshot,
  PlazoType,
  PlazoDefinition,
  Suspension,
  TenantConfig,
  DeadlineUnit,
  ProgressStatus,
} from '@omega/deadline-engine';
```

## Qué resuelve

- **Días hábiles colombianos** — excluye sábados, domingos y festivos. Aplica Ley Emiliani (festivos movibles saltan al lunes siguiente).
- **Plazos Ley 1755/2015** — `peticion_general` (15), `queja` (15), `reclamo` (15), `informacion` (10), `consulta` (30), `inter_autoridades` (10), `salud_priority` (variable 3–8), `traslado_por_competencia` (5), `post_tutela` (48h de reloj), `oposicion` (5).
- **Suspensiones por tenant** — estructura `{from, to, reason}` que extiende el plazo mientras esté activa.
- **Prórroga legal** — `extend()` valida que la prórroga no exceda `2×` el plazo original y emite el payload del evento de auditoría.
- **Zona horaria** — toda aritmética se normaliza a `America/Bogota` (UTC-5 sin DST).

## Convención clave

`deadlineAt = addBusinessDays(issuedAt, N, holidays, suspensiones)` — el día 1 es el primer día hábil **estrictamente después** de `issuedAt`.

## Testing

```bash
pnpm --filter @omega/deadline-engine test
pnpm --filter @omega/deadline-engine test:coverage      # 100% líneas
pnpm --filter @omega/deadline-engine generate:golden    # regenera fixtures deterministas
```

Fixtures viven en `test/fixtures/golden.json` (300+ casos). Property tests (`test/property.test.ts`) validan `subtractBusinessDays(addBusinessDays(d, n), n) === d` con 10k iteraciones vía `fast-check`.

## Restricción de imports

El paquete impone (vía `test/import-purity.test.ts`) que los archivos de `src/` solo importen con rutas relativas o desde `./fixtures/*.json`. Esto garantiza que se pueda copiar a cualquier runtime sin arrastrar árbol de dependencias.
