import type { Classification, ClassificationFailure } from '@omega/classifier/schemas';

import type { FormatPreserveResult, NormalizedIntake, TenantContext } from './types.js';

const MAX_RESUMEN_LENGTH = 280;

export interface ResumenInput {
  intake: NormalizedIntake;
  formatted: FormatPreserveResult;
  classification: Classification | ClassificationFailure;
  context: TenantContext;
}

export interface ResumenGenerationResult {
  resumen: string;
  tokens_used: number;
}

export type ResumenGenerator = (
  input: ResumenInput,
) => Promise<string | Partial<ResumenGenerationResult> | null | undefined>;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function trimResumen(text: string, maxLength = MAX_RESUMEN_LENGTH): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 3) return normalized.slice(0, maxLength);

  const hardLimit = maxLength - 3;
  const slice = normalized.slice(0, hardLimit + 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cutAt = lastSpace >= Math.floor(maxLength * 0.6) ? lastSpace : hardLimit;
  return `${normalized.slice(0, cutAt).trimEnd()}...`;
}

export function generateLocalResumen(input: ResumenInput): string {
  const subject = normalizeWhitespace(input.intake.subject);
  const body = normalizeWhitespace(input.formatted.llm_text || input.intake.description);
  const base = subject && body && !body.toLowerCase().startsWith(subject.toLowerCase())
    ? `${subject}: ${body}`
    : body || subject || 'PQR recibida sin texto procesable.';
  return trimResumen(base);
}

export async function generateResumen(
  input: ResumenInput,
  generator?: ResumenGenerator,
): Promise<ResumenGenerationResult> {
  if (generator) {
    const generated = await generator(input);
    const resumen = typeof generated === 'string' ? generated : generated?.resumen;
    if (typeof resumen === 'string' && resumen.trim() !== '') {
      return {
        resumen: trimResumen(resumen),
        tokens_used: typeof generated === 'object' && generated?.tokens_used
          ? generated.tokens_used
          : 0,
      };
    }
  }

  return {
    resumen: generateLocalResumen(input),
    tokens_used: 0,
  };
}

export async function generateResumenWithClaudeStub(): Promise<null> {
  return null;
}
