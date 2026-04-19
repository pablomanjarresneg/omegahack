import { createHash } from 'node:crypto';

import type { NormalizedIntake } from './types.js';

export function generateSourceHash(intake: NormalizedIntake): string {
  const hashInput = [
    intake.raw_text,
    intake.created_at,
    intake.email ?? '',
    intake.document_id ?? '',
    intake.phone ?? '',
  ].join('|');

  return createHash('sha256').update(hashInput, 'utf8').digest('hex');
}
