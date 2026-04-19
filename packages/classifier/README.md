# @omega/classifier

Clasificador de PQRs con Claude. Recibe texto crudo (ya sin PII) + adjuntos opcionales y devuelve una clasificación estructurada: tipo, secretaría competente, comuna, tags temáticos y señales auxiliares.

## Superficie pública

```ts
import { classify } from '@omega/classifier';
import { parseClassification, isClassification } from '@omega/classifier/schemas';

const result = await classify(rawText, attachments, { timeoutMs: 15_000 });
```

Tipos exportados: `Classification`, `ClassificationResult`, `ClassificationFailure`, `DependenciaClassification`, `UrgencyClassification`, `EstructuraMinima`, `ExtractedEntity`, `EntityKind`, `PqrTipo`, `SecretariaCode`, `AnonimatoSignal`, `RespetoSignal`, `UrgencyLevel`.

## Qué devuelve

- `tipo`: `peticion` · `queja` · `reclamo` · `oposicion` · `sugerencia` · `denuncia`.
- `secretaria_codigo`: uno de los 26 códigos oficiales (DESP, SGOB, SHAC, SSAL, SEDU, SMOV, SMAM, SINF, SSEG, ...).
- `comuna_numero` + `comuna_tipo` — 1–16 comunas o 50/60/70/80/90 corregimientos.
- `discriminacion_tematica` — tags namespaced (`tema:*`, `subtema:*`, `ubicacion:*`, `actor:*`, `vulnerabilidad:*`, `sentimiento:*`).
- `estructura_minima` — `{hechos_ok, peticion_ok, lugar_ok, fecha_ok}`.
- Señales: `respeto_ok`, `is_offensive`, `tutela_risk_score`, `anonimato_ok`.

## Dependencias

- `@omega/habeas-data` — se usa en el eval harness para verificar que no se filtra PII al prompt.
- `@anthropic-ai/sdk` cargada perezosamente por `./claude.js` para no cargarla en paths que no clasifican.

## Scripts

```bash
pnpm --filter @omega/classifier test
pnpm --filter @omega/classifier eval          # tsx eval/run.ts sobre el dataset
```

## Nota

El clasificador solo decide; no escribe en BD. La persistencia la hace `@omega/intake-agent` en el paso siguiente del pipeline.
