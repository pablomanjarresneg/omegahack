/**
 * Sensitivity levels defined by Ley 1581/2012 (Colombia, Habeas Data).
 *
 * - `public`: datos de acceso público (nombre en contextos públicos, profesión,
 *   registros públicos).
 * - `semiprivate`: datos semiprivados (estado civil, datos financieros básicos,
 *   patrimonio) — requieren consentimiento o una finalidad legítima.
 * - `private`: datos privados (cédula, dirección personal, teléfono personal,
 *   email personal, placa) — sólo pueden tratarse con consentimiento.
 * - `sensitive`: datos sensibles (salud, biométricos, orientación sexual,
 *   religión, opinión política, condición de víctima, datos de menores) —
 *   protección reforzada (art. 6 Ley 1581).
 */
export type SensitivityLevel = 'public' | 'semiprivate' | 'private' | 'sensitive';

/**
 * Canonical field names the redactor and classifier know about. `raw_text` is
 * used when the input is free-form text (for auditing) and `unknown` is the
 * explicit fallback for callers that pass an unrecognized field.
 */
export type FieldName =
  | 'cedula'
  | 'email'
  | 'telefono'
  | 'nombre'
  | 'direccion'
  | 'nit'
  | 'placa'
  | 'salud'
  | 'biometrico'
  | 'orientacion_sexual'
  | 'religion'
  | 'opinion_politica'
  | 'menor_edad'
  | 'victima_conflicto'
  | 'estado_civil'
  | 'patrimonio'
  | 'profesion'
  | 'raw_text'
  | 'unknown';

export interface FieldClassification {
  fieldName: FieldName;
  sensitivityLevel: SensitivityLevel;
  /** Placeholder to substitute the raw value with, e.g. `'[CED]'`. */
  redacted: string;
  /** Short Spanish-language rationale referencing Ley 1581 where applicable. */
  rationale: string;
  /** Whether the input was recognized as this field. */
  matched: boolean;
}

export interface RedactionLogEntry {
  fieldName: FieldName;
  match: string;
  replacement: string;
  offset: number;
}

export interface RedactTextResult {
  llmText: string;
  redactionLog: RedactionLogEntry[];
}
