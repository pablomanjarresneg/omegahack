import { describe, expect, it } from 'vitest';

import { generateSourceHash } from '../src/index.js';
import { makeIntake } from './fixtures.js';

describe('generateSourceHash', () => {
  it('is stable for identical normalized source identity fields', () => {
    const intake = makeIntake();

    expect(generateSourceHash(intake)).toBe(generateSourceHash({ ...intake }));
    expect(generateSourceHash(intake)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when raw source text changes', () => {
    const intake = makeIntake();

    expect(generateSourceHash(intake)).not.toBe(
      generateSourceHash({ ...intake, raw_text: `${intake.raw_text} extra` }),
    );
  });
});
