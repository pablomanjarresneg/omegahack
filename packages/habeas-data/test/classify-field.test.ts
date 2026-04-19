import { describe, expect, it } from 'vitest';
import { classifyField } from '../src/field-classification';
import type { FieldName } from '../src/types';

interface Expectation {
  fieldName: FieldName;
  level: string;
  token: string;
}

const EXPECTATIONS: readonly Expectation[] = [
  { fieldName: 'cedula', level: 'private', token: '[CED]' },
  { fieldName: 'email', level: 'private', token: '[EMAIL]' },
  { fieldName: 'telefono', level: 'private', token: '[TEL]' },
  { fieldName: 'direccion', level: 'private', token: '[DIR]' },
  { fieldName: 'nit', level: 'semiprivate', token: '[NIT]' },
  { fieldName: 'placa', level: 'private', token: '[PLACA]' },
  { fieldName: 'nombre', level: 'public', token: '[NOMBRE]' },
  { fieldName: 'salud', level: 'sensitive', token: '[SALUD]' },
  { fieldName: 'biometrico', level: 'sensitive', token: '[BIO]' },
  { fieldName: 'orientacion_sexual', level: 'sensitive', token: '[ORIENTACION]' },
  { fieldName: 'religion', level: 'sensitive', token: '[RELIGION]' },
  { fieldName: 'opinion_politica', level: 'sensitive', token: '[POLITICA]' },
  { fieldName: 'menor_edad', level: 'sensitive', token: '[MENOR]' },
  { fieldName: 'victima_conflicto', level: 'sensitive', token: '[VICTIMA]' },
  { fieldName: 'estado_civil', level: 'semiprivate', token: '[ESTADO_CIVIL]' },
  { fieldName: 'patrimonio', level: 'semiprivate', token: '[PATRIMONIO]' },
  { fieldName: 'profesion', level: 'public', token: '[PROFESION]' },
];

describe('classifyField — sensitivity levels', () => {
  for (const exp of EXPECTATIONS) {
    it(`${exp.fieldName} is ${exp.level}`, () => {
      const result = classifyField({ fieldName: exp.fieldName, value: 'x' });
      expect(result.sensitivityLevel).toBe(exp.level);
    });
  }
});

describe('classifyField — redaction tokens', () => {
  for (const exp of EXPECTATIONS) {
    it(`${exp.fieldName} redacts to ${exp.token}`, () => {
      const result = classifyField({ fieldName: exp.fieldName, value: 'x' });
      expect(result.redacted).toBe(exp.token);
    });
  }
});

describe('classifyField — rationales', () => {
  for (const exp of EXPECTATIONS) {
    it(`${exp.fieldName} has non-empty Spanish rationale mentioning Ley 1581`, () => {
      const result = classifyField({ fieldName: exp.fieldName, value: 'x' });
      expect(result.rationale.length).toBeGreaterThan(10);
      expect(result.rationale).toMatch(/Ley 1581/);
    });
  }

  it('rationales contain at least one Spanish-specific hint', () => {
    // Spot-check: must not be English. Presence of accented characters or
    // Spanish articles is enough to prove we did not paste English copy.
    const r = classifyField({ fieldName: 'cedula', value: '123' }).rationale;
    expect(r).toMatch(/[áéíóúñ]|\b(la|el|de|un|una|con|bajo|datos)\b/i);
  });
});

describe('classifyField — matched flag', () => {
  it('returns matched=true for a known field', () => {
    const r = classifyField({ fieldName: 'email', value: 'a@b.co' });
    expect(r.matched).toBe(true);
  });

  it('returns matched=false for unknown field', () => {
    const r = classifyField({ fieldName: 'unknown', value: 'x' });
    expect(r.matched).toBe(false);
  });
});

describe('classifyField — unknown fallback', () => {
  it('classifies unknown as private by default', () => {
    const r = classifyField({ fieldName: 'unknown', value: 'x' });
    expect(r.sensitivityLevel).toBe('private');
    expect(r.redacted).toBe('[REDACT]');
    expect(r.rationale).toMatch(/desconocido/i);
    expect(r.rationale).toMatch(/privado/i);
  });

  it('preserves fieldName=unknown in the result', () => {
    const r = classifyField({ fieldName: 'unknown', value: 'x' });
    expect(r.fieldName).toBe('unknown');
  });
});

describe('classifyField — raw_text', () => {
  it('raw_text classified as private with [RAW] token', () => {
    const r = classifyField({ fieldName: 'raw_text', value: 'free form' });
    expect(r.sensitivityLevel).toBe('private');
    expect(r.redacted).toBe('[RAW]');
    expect(r.matched).toBe(true);
  });
});

describe('classifyField — fieldName echoed', () => {
  for (const exp of EXPECTATIONS) {
    it(`${exp.fieldName} echoes the field name`, () => {
      const result = classifyField({ fieldName: exp.fieldName, value: 'v' });
      expect(result.fieldName).toBe(exp.fieldName);
    });
  }
});
