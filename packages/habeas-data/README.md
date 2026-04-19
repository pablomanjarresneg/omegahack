# @omega/habeas-data

Redacción y clasificación de PII según Ley 1581/2012 (habeas data colombiano). Sin dependencias externas.

## Superficie pública

```ts
import { classifyField, redactText, SENSITIVITY_LEVELS } from '@omega/habeas-data';
import type {
  FieldClassification,
  FieldName,
  RedactionLogEntry,
  RedactTextResult,
  SensitivityLevel,
} from '@omega/habeas-data/types';
```

## Niveles de sensibilidad

```ts
const SENSITIVITY_LEVELS = ['public', 'semiprivate', 'private', 'sensitive'] as const;
```

- `public` — nombre de funcionario, dependencia, etc.
- `semiprivate` — datos que requieren contexto de tenencia (comuna, barrio).
- `private` — nombre civil del ciudadano, email personal, dirección.
- `sensitive` — categoría especial: salud, orientación política, pertenencia étnica, etc. Requiere consentimiento explícito.

## Uso típico

```ts
const { redacted, log } = redactText(rawText);
// redacted: texto con patrones PII reemplazados por tokens ([EMAIL], [PHONE], [DOC], [DIRECCION])
// log: RedactionLogEntry[] — qué se redactó, tipo, y posición
```

`classifyField(name)` devuelve `{ sensitivity, rationale }` para un campo nombrado, útil al decidir qué enviar al LLM y qué no.

## Dónde se usa

- `packages/intake-agent` lo llama antes de pasar `llm_text` al clasificador.
- `apps/workbench` lo usa para decidir qué mostrar en `display_text` vs `raw_text` al funcionario.

## Tests

```bash
pnpm --filter @omega/habeas-data test
```
