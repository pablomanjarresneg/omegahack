import { describe, expect, it } from 'vitest';

import {
  IntakeValidationError,
  getNormalizedIntakeIssues,
  validateNormalizedIntake,
} from '../src/index.js';
import { makeIntake } from './fixtures.js';

describe('validateNormalizedIntake', () => {
  it('accepts the NormalizedIntake contract', () => {
    const intake = makeIntake();

    expect(validateNormalizedIntake(intake)).toBe(intake);
    expect(getNormalizedIntakeIssues(intake)).toEqual([]);
  });

  it('rejects malformed shape with path-specific issues', () => {
    const invalid = {
      ...makeIntake(),
      source_channel: 'fax',
      raw_text: 123,
      attachments: [{ filename: '', size_bytes: -1, extra: true }],
      unexpected: true,
    };

    expect(() => validateNormalizedIntake(invalid)).toThrow(IntakeValidationError);
    expect(getNormalizedIntakeIssues(invalid).map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'source_channel',
        'raw_text',
        'attachments[0].filename',
        'attachments[0].size_bytes',
        'attachments[0].extra',
        'unexpected',
      ]),
    );
  });

  it('rejects anonymous intake without an email or phone contact method', () => {
    const invalid = makeIntake({
      citizen_name: null,
      is_anonymous: true,
      document_id: null,
      email: null,
      phone: null,
    });

    expect(() => validateNormalizedIntake(invalid)).toThrow(IntakeValidationError);
    expect(getNormalizedIntakeIssues(invalid)).toContainEqual({
      path: 'email',
      message: 'anonymous submissions require an email or phone contact method',
    });
  });

  it('accepts anonymous intake with a phone contact method', () => {
    const intake = makeIntake({
      citizen_name: null,
      is_anonymous: true,
      document_id: null,
      email: null,
      phone: '3001234567',
    });

    expect(validateNormalizedIntake(intake)).toBe(intake);
  });
});
