import { describe, expect, test } from 'vitest';

import { classifyHeuristically } from '../src/claude.js';

describe('classifyHeuristically', () => {
  test('routes opposition about a traffic decision to mobility', () => {
    const result = classifyHeuristically(
      'Me opongo al comparendo de transito impuesto a la placa ABC-123. ' +
        'Solicito revocar decision y revisar las camaras del sector Laureles.',
    );

    expect(result.tipo).toBe('oposicion');
    expect(result.dependencia.codigo).toBe('SMOV');
    expect(result.entities.some((entity) => entity.kind === 'placa')).toBe(true);
    expect(result.estructura_minima.peticion_ok).toBe(true);
  });

  test('detects critical health and tutela risk', () => {
    const result = classifyHeuristically(
      'Solicito atencion urgente de salud para adulto mayor. Hay tutela y riesgo de muerte desde ayer.',
    );

    expect(result.dependencia.codigo).toBe('SSAL');
    expect(result.urgencia.level).toBe('critica');
    expect(result.urgencia.tutela_risk_score).toBeGreaterThan(0.8);
  });
});
