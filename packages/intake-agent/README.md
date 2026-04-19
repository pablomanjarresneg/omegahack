# @omega/intake-agent

Orquestador del intake de PQRSD. Recibe un `NormalizedIntake` y devuelve un `IntakeAgentRun` con validez, clasificación, tags, resumen y problem-group asignado.

## Superficie pública

```ts
import {
  createIntakeAgent,
  runIntakeAgent,
  buildIntakeAgentEvent,
  buildIntakeAgentEventPayload,
  formatPreserve,
  generateSourceHash,
  deriveValidity,
  deriveInvalidReasons,
  generateResumen,
  generateLocalResumen,
  trimResumen,
  validateNormalizedIntake,
  isNormalizedIntake,
  getNormalizedIntakeIssues,
  IntakeValidationError,
  INVALID_REASON_CODES,
  INTAKE_SOURCE_CHANNELS,
  RESUMEN_PROMPT_VERSION,
  RESUMEN_SYSTEM_PROMPT,
} from '@omega/intake-agent';
```

Tipos: `NormalizedIntake`, `TenantContext`, `IntakeAgentRun`, `IntakeAgentResult`, `IntakeValidity`, `IntakeClassifier`, `IntakeProblemGrouper`, `IntakeTagger`, `IntakeAgentEvent`, `IntakeAgentEventPayload`, `FormatPreserveResult`, `ResumenInput`, `ResumenGenerationResult`, etc.

## Pipeline

```
NormalizedIntake
    │
    ▼
validateNormalizedIntake    ── falla → IntakeValidationError
    │
    ▼
generateSourceHash          ── (para idempotencia)
    │
    ▼
formatPreserve              ── produce raw / display / llm
    │
    ▼
deriveValidity              ── Art. 16 Ley 1755/2015
    │  si falla
    └──▶ deriveInvalidReasons ──▶ IntakeAgentRun { bounced: true }
    │
    ▼
classifier (inyectado)      ── @omega/classifier en el callsite
    │
    ▼
tagger (inyectado)          ── @omega/tags
    │
    ▼
problemGrouper (inyectado)  ── @omega/problem-groups
    │
    ▼
generateResumen             ── resumen de caso
    │
    ▼
IntakeAgentRun { accepted: true, classification, tags, problemGroup, resumen, events[] }
```

## Inyección de dependencias

`createIntakeAgent(deps)` recibe los colaboradores para permitir que tests no toquen red ni BD:

```ts
interface IntakeAgentDependencies {
  classifier: IntakeClassifier;
  tagger: IntakeTagger;
  problemGrouper: IntakeProblemGrouper;
  resumenGenerator?: ResumenGenerator;
  now?: () => Date;
}
```

## Dependencias de workspace

- `@omega/classifier`
- `@omega/db`
- `@omega/habeas-data`
- `@omega/problem-groups`
- `@omega/tags`

## Tests

```bash
pnpm --filter @omega/intake-agent test
```
