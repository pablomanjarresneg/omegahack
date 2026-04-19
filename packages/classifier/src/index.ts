import type { AttachmentInput, ClassificationResult } from './schemas.js';

export type {
  AnonimatoSignal,
  AttachmentInput,
  Classification,
  ClassificationFailure,
  ClassificationResult,
  DependenciaClassification,
  EntityKind,
  EstructuraMinima,
  ExtractedEntity,
  PqrTipo,
  RespetoSignal,
  SecretariaCode,
  UrgencyClassification,
  UrgencyLevel,
} from './schemas.js';
export { isClassification, parseClassification } from './schemas.js';

export interface ClassifyOptions {
  timeoutMs?: number;
  model?: string;
  now?: Date;
}

export async function classify(
  rawText: string,
  attachments: AttachmentInput[] = [],
  options: ClassifyOptions = {},
): Promise<ClassificationResult> {
  const { classifyWithClaude } = await import('./claude.js');
  return classifyWithClaude(rawText, attachments, options);
}
