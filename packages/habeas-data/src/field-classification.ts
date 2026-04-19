import type { FieldClassification, FieldName, SensitivityLevel } from './types';

interface TableEntry {
  sensitivityLevel: SensitivityLevel;
  redacted: string;
  rationale: string;
}

/**
 * Static classification table. Every non-fallback `FieldName` must have an
 * entry here — TypeScript enforces it through the `Record` type below.
 */
const CLASSIFICATION_TABLE: Record<
  Exclude<FieldName, 'unknown'>,
  TableEntry
> = {
  cedula: {
    sensitivityLevel: 'private',
    redacted: '[CED]',
    rationale:
      'La cédula de ciudadanía es un dato privado bajo la Ley 1581 de 2012 y sólo puede tratarse con consentimiento previo.',
  },
  email: {
    sensitivityLevel: 'private',
    redacted: '[EMAIL]',
    rationale:
      'El correo electrónico personal es un dato privado según la Ley 1581 de 2012 y requiere autorización del titular.',
  },
  telefono: {
    sensitivityLevel: 'private',
    redacted: '[TEL]',
    rationale:
      'El número telefónico personal es un dato privado bajo la Ley 1581 de 2012.',
  },
  direccion: {
    sensitivityLevel: 'private',
    redacted: '[DIR]',
    rationale:
      'La dirección de residencia es un dato privado protegido por la Ley 1581 de 2012.',
  },
  nit: {
    sensitivityLevel: 'semiprivate',
    redacted: '[NIT]',
    rationale:
      'El NIT de una persona jurídica se considera dato semiprivado bajo la Ley 1581 de 2012: es de interés comercial pero no totalmente público.',
  },
  placa: {
    sensitivityLevel: 'private',
    redacted: '[PLACA]',
    rationale:
      'La placa vehicular asociada a un titular es un dato privado bajo la Ley 1581 de 2012 por permitir la identificación indirecta del propietario.',
  },
  nombre: {
    sensitivityLevel: 'public',
    redacted: '[NOMBRE]',
    rationale:
      'El nombre es, en la mayoría de contextos, un dato público conforme a la Ley 1581 de 2012, pero se redacta para trazabilidad.',
  },
  salud: {
    sensitivityLevel: 'sensitive',
    redacted: '[SALUD]',
    rationale:
      'Los datos de salud son sensibles bajo el art. 5 de la Ley 1581 de 2012 y requieren protección reforzada.',
  },
  biometrico: {
    sensitivityLevel: 'sensitive',
    redacted: '[BIO]',
    rationale:
      'Los datos biométricos son sensibles según la Ley 1581 de 2012 y su tratamiento está restringido.',
  },
  orientacion_sexual: {
    sensitivityLevel: 'sensitive',
    redacted: '[ORIENTACION]',
    rationale:
      'La orientación sexual es un dato sensible conforme al art. 5 de la Ley 1581 de 2012.',
  },
  religion: {
    sensitivityLevel: 'sensitive',
    redacted: '[RELIGION]',
    rationale:
      'Las convicciones religiosas son datos sensibles bajo la Ley 1581 de 2012 y no pueden tratarse sin autorización expresa.',
  },
  opinion_politica: {
    sensitivityLevel: 'sensitive',
    redacted: '[POLITICA]',
    rationale:
      'Las opiniones políticas son datos sensibles según la Ley 1581 de 2012 y gozan de protección reforzada.',
  },
  menor_edad: {
    sensitivityLevel: 'sensitive',
    redacted: '[MENOR]',
    rationale:
      'Los datos de menores de edad reciben protección reforzada bajo la Ley 1581 de 2012 y deben tratarse con especial cuidado.',
  },
  victima_conflicto: {
    sensitivityLevel: 'sensitive',
    redacted: '[VICTIMA]',
    rationale:
      'La condición de víctima del conflicto es un dato sensible bajo la Ley 1581 de 2012 y la Ley 1448 de 2011.',
  },
  estado_civil: {
    sensitivityLevel: 'semiprivate',
    redacted: '[ESTADO_CIVIL]',
    rationale:
      'El estado civil es un dato semiprivado bajo la Ley 1581 de 2012.',
  },
  patrimonio: {
    sensitivityLevel: 'semiprivate',
    redacted: '[PATRIMONIO]',
    rationale:
      'El patrimonio es un dato semiprivado bajo la Ley 1581 de 2012 y su tratamiento requiere finalidad legítima.',
  },
  profesion: {
    sensitivityLevel: 'public',
    redacted: '[PROFESION]',
    rationale:
      'La profesión u oficio es considerada dato público bajo la Ley 1581 de 2012.',
  },
  raw_text: {
    sensitivityLevel: 'private',
    redacted: '[RAW]',
    rationale:
      'Texto libre sin clasificar: se trata como dato privado por defecto bajo la Ley 1581 de 2012 hasta que se identifique su contenido.',
  },
};

const UNKNOWN_ENTRY: FieldClassification = {
  fieldName: 'unknown',
  sensitivityLevel: 'private',
  redacted: '[REDACT]',
  rationale:
    'Campo desconocido — se asume privado por defecto conforme al principio de minimización de datos de la Ley 1581 de 2012.',
  matched: false,
};

/**
 * Classifies a single labelled field. The lookup is a static table — no regex
 * on `fieldName`. Unknown field names fall back to `private` / `[REDACT]`.
 */
export function classifyField(input: {
  fieldName: FieldName;
  value: string;
}): FieldClassification {
  const { fieldName } = input;
  if (fieldName === 'unknown') {
    return { ...UNKNOWN_ENTRY };
  }
  const entry = CLASSIFICATION_TABLE[fieldName];
  /* c8 ignore next 3 -- unreachable: the `Record` type ensures every non-unknown
     FieldName has an entry, and callers are type-checked at the boundary. */
  if (!entry) {
    return { ...UNKNOWN_ENTRY };
  }
  return {
    fieldName,
    sensitivityLevel: entry.sensitivityLevel,
    redacted: entry.redacted,
    rationale: entry.rationale,
    matched: true,
  };
}
