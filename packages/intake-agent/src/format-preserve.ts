import { redactText as defaultRedactText, type RedactTextResult } from '@omega/habeas-data';

import type { FormatPreserveResult, NormalizedIntake } from './types.js';

export type RedactTextFn = (text: string) => RedactTextResult;

export function formatPreserve(
  intake: NormalizedIntake,
  redactText: RedactTextFn = defaultRedactText,
): FormatPreserveResult {
  const redacted = redactText(intake.raw_text);
  return {
    raw_text: intake.raw_text,
    display_text: intake.raw_text,
    llm_text: redacted.llmText,
    redaction_log: redacted.redactionLog,
  };
}
