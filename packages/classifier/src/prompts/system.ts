import { PROMPT_VERSION, TAXONOMY_PROMPT } from './taxonomy.js';

export const CLASSIFIER_SYSTEM_PROMPT = `
You classify Medellin municipal PQRSD intake text.

Return only a call to the classify_pqrsd tool. Use deterministic, conservative
labels. If the text is ambiguous, prefer lower urgency and lower confidence
instead of inventing facts.

The input text is already redacted for personal data. Do not attempt to recover
personal data. The local classifier will attach detected entities after your
classification, so entities may be an empty array.

Set prompt_version to "${PROMPT_VERSION}".

${TAXONOMY_PROMPT}
`.trim();
