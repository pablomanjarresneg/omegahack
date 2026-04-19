export type {
  FieldClassification,
  FieldName,
  RedactionLogEntry,
  RedactTextResult,
  SensitivityLevel,
} from './types';
export { classifyField } from './field-classification';
export { redactText } from './redact-text';

/**
 * Enumerated sensitivity levels (Ley 1581/2012) exported as a runtime constant
 * for consumers that want to iterate or validate against the full set.
 */
export const SENSITIVITY_LEVELS = [
  'public',
  'semiprivate',
  'private',
  'sensitive',
] as const;
