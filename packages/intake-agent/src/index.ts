export type {
  FormatPreserveResult,
  IntakeAgentResult,
  IntakeProblemGroup,
  IntakeSourceChannel,
  IntakeTag,
  IntakeValidity,
  InvalidReason,
  InvalidReasonCode,
  NormalizedIntake,
  TenantContext,
} from './types.js';

export { INVALID_REASON_CODES, INTAKE_SOURCE_CHANNELS } from './types.js';
export {
  buildIntakeAgentEvent,
  buildIntakeAgentEventPayload,
  type IntakeAgentEvent,
  type IntakeAgentEventPayload,
} from './events.js';
export { formatPreserve, type RedactTextFn } from './format-preserve.js';
export { generateSourceHash } from './hash.js';
export {
  createIntakeAgent,
  runIntakeAgent,
  type IntakeAgent,
  type IntakeAgentDependencies,
  type IntakeAgentRun,
  type IntakeClassifier,
  type IntakeClassificationInput,
  type IntakeProblemGrouper,
  type IntakeProblemGroupInput,
  type IntakeTagger,
  type IntakeTagInput,
} from './orchestrator.js';
export {
  generateLocalResumen,
  generateResumen,
  generateResumenWithClaudeStub,
  trimResumen,
  type ResumenGenerationResult,
  type ResumenGenerator,
  type ResumenInput,
} from './resumen.js';
export { RESUMEN_PROMPT_VERSION, RESUMEN_SYSTEM_PROMPT } from './prompts/resumen.js';
export { deriveInvalidReasons, deriveValidity } from './validity.js';
export {
  IntakeValidationError,
  getNormalizedIntakeIssues,
  isNormalizedIntake,
  validateNormalizedIntake,
  type ValidationIssue,
} from './validation.js';
