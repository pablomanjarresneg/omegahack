import { describe, expect, test } from 'vitest';

import { parseClassification } from '../src/schemas';

const baseClassification = {
  tipo: 'oposicion',
  dependencia: {
    codigo: 'SMOV',
    nombre: 'Secretaria de Movilidad',
    confidence: 0.88,
    fuera_de_competencia_municipal: false,
    reasoning: 'La oposicion se dirige contra una decision de movilidad.',
  },
  urgencia: {
    level: 'media',
    tutela_risk_score: 0.2,
    rationale: 'Requiere respuesta dentro del termino especial.',
  },
  entities: [],
  estructura_minima: {
    hechos_ok: true,
    peticion_ok: true,
    direccion_ok: true,
    fecha_ok: true,
  },
  respeto: {
    ok: true,
    is_offensive: false,
    reason: null,
  },
  anonimato: {
    is_anonymous: false,
    has_contact_data: true,
    public_response_route: false,
  },
  discriminacion_tematica: ['tramite:oposicion', 'tema:movilidad'],
  confidence: 0.9,
  prompt_version: 'classifier-v1.1.0',
};

describe('parseClassification', () => {
  test('accepts oposicion as a PQR type', () => {
    const parsed = parseClassification(baseClassification);
    expect(parsed.tipo).toBe('oposicion');
  });

  test('rejects out-of-range confidence', () => {
    expect(() =>
      parseClassification({
        ...baseClassification,
        confidence: 1.2,
      }),
    ).toThrow(/confidence/);
  });
});
