import { describe, expect, test } from 'vitest';

import { extractEntities } from '../src/claude.js';

describe('extractEntities', () => {
  test('extracts local PII entities with offsets', () => {
    const entities = extractEntities(
      'Soy Maria Perez con CC 1020304050, celular 3001234567, correo maria@example.com, ' +
        'vivo en Cra 45 # 12-34 y la placa ABC-123.',
    );

    expect(entities.map((entity) => entity.kind)).toEqual(
      expect.arrayContaining(['nombre', 'cedula', 'telefono', 'email', 'direccion', 'placa']),
    );
    expect(entities.find((entity) => entity.kind === 'email')?.value).toBe('maria@example.com');
    expect(entities.every((entity) => entity.sensitive)).toBe(true);
    expect(entities.find((entity) => entity.kind === 'cedula')?.start).toEqual(expect.any(Number));
  });
});
