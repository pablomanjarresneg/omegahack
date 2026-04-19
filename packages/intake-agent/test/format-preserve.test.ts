import { describe, expect, it } from 'vitest';

import { formatPreserve } from '../src/index.js';
import { makeIntake } from './fixtures.js';

describe('formatPreserve', () => {
  it('keeps raw and display text byte-identical while redacting the LLM copy', () => {
    const raw = 'Linea 1\r\nCC 12345678 correo ana@example.com celular 3001234567';
    const result = formatPreserve(makeIntake({ raw_text: raw }));

    expect(result.raw_text).toBe(raw);
    expect(result.display_text).toBe(raw);
    expect(result.llm_text).not.toContain('12345678');
    expect(result.llm_text).not.toContain('ana@example.com');
    expect(result.llm_text).not.toContain('3001234567');
    expect(result.redaction_log.map((entry) => entry.replacement)).toEqual(
      expect.arrayContaining(['[CED]', '[EMAIL]', '[TEL]']),
    );
  });
});
