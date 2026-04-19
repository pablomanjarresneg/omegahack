import type { Classification, ClassificationFailure } from '@omega/classifier/schemas';

import type { IntakeValidity, InvalidReason, InvalidReasonCode } from './types.js';

const INVALID_REASON_MESSAGES: Record<InvalidReasonCode, string> = {
  faltan_hechos: 'Faltan hechos verificables para tramitar la PQR.',
  falta_peticion: 'Falta una peticion clara del ciudadano.',
  irrespetuoso: 'El texto contiene lenguaje irrespetuoso u ofensivo.',
  anonimo_sin_datos_contacto: 'La solicitud anonima no incluye email ni telefono de contacto.',
  fuera_de_competencia_municipal: 'La solicitud esta fuera de la competencia municipal.',
};

function isClassification(
  classification: Classification | ClassificationFailure,
): classification is Classification {
  return !('status' in classification);
}

function reason(code: InvalidReasonCode): InvalidReason {
  return {
    code,
    message: INVALID_REASON_MESSAGES[code],
  };
}

export function deriveInvalidReasons(
  classification: Classification | ClassificationFailure,
): InvalidReason[] {
  if (!isClassification(classification)) {
    return [];
  }

  const reasons: InvalidReason[] = [];
  if (!classification.estructura_minima.hechos_ok) {
    reasons.push(reason('faltan_hechos'));
  }
  if (!classification.estructura_minima.peticion_ok) {
    reasons.push(reason('falta_peticion'));
  }
  if (!classification.respeto.ok || classification.respeto.is_offensive) {
    reasons.push(reason('irrespetuoso'));
  }
  if (
    classification.anonimato.is_anonymous &&
    !classification.anonimato.has_contact_data
  ) {
    reasons.push(reason('anonimo_sin_datos_contacto'));
  }
  if (classification.dependencia.fuera_de_competencia_municipal) {
    reasons.push(reason('fuera_de_competencia_municipal'));
  }

  return reasons;
}

export function deriveValidity(
  classification: Classification | ClassificationFailure,
): IntakeValidity {
  if (!isClassification(classification)) {
    return {
      valid: false,
      reasons: [],
    };
  }

  const reasons = deriveInvalidReasons(classification);
  return {
    valid: reasons.length === 0,
    reasons,
  };
}
