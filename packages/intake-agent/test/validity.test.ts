import { describe, expect, it } from 'vitest';

import { deriveInvalidReasons, deriveValidity } from '../src/index.js';
import { makeClassification } from './fixtures.js';

describe('deriveInvalidReasons', () => {
  it('maps classifier validity flags to canonical invalid reason codes', () => {
    const classification = makeClassification();
    classification.estructura_minima.hechos_ok = false;
    classification.estructura_minima.peticion_ok = false;
    classification.respeto.ok = false;
    classification.respeto.is_offensive = true;
    classification.anonimato.is_anonymous = true;
    classification.anonimato.has_contact_data = false;
    classification.anonimato.public_response_route = true;
    classification.dependencia.fuera_de_competencia_municipal = true;

    expect(deriveInvalidReasons(classification).map((reason) => reason.code)).toEqual([
      'faltan_hechos',
      'falta_peticion',
      'irrespetuoso',
      'anonimo_sin_datos_contacto',
      'fuera_de_competencia_municipal',
    ]);
  });

  it('treats classifier failures as pending human rather than invalid reasons', () => {
    expect(
      deriveValidity({
        status: 'pending_human',
        reason: 'timeout',
        message: 'Classifier timed out',
      }),
    ).toEqual({ valid: false, reasons: [] });
  });
});
