import type { Classification } from '@omega/classifier/schemas';
import type { NormalizedIntake } from '../src/index.js';

export function makeIntake(overrides: Partial<NormalizedIntake> = {}): NormalizedIntake {
  return {
    source_channel: 'web',
    citizen_name: 'Ana Perez',
    is_anonymous: false,
    document_id: '12345678',
    email: 'ana@example.com',
    phone: '3001234567',
    subject: 'Alumbrado publico',
    description: 'Solicito revisar una luminaria apagada en el barrio.',
    raw_text: 'Solicito revisar una luminaria apagada en el barrio. CC 12345678',
    attachments: [],
    location_text: 'Barrio Centro',
    consent_data: true,
    created_at: '2026-04-19T10:00:00.000Z',
    ...overrides,
  };
}

export function makeClassification(): Classification {
  return {
    tipo: 'peticion',
    dependencia: {
      codigo: 'SGOB',
      nombre: 'Secretaria de Gobierno',
      confidence: 0.88,
      fuera_de_competencia_municipal: false,
      reasoning: 'La solicitud corresponde a gestion municipal.',
    },
    urgencia: {
      level: 'media',
      tutela_risk_score: 0.25,
      rationale: 'No se evidencia riesgo critico inmediato.',
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
    discriminacion_tematica: ['servicios-publicos'],
    confidence: 0.91,
    prompt_version: 'classifier-test-v1',
  };
}
