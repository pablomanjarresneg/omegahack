export const PQR_TIPOS = [
  'peticion',
  'queja',
  'reclamo',
  'oposicion',
  'sugerencia',
  'denuncia',
] as const;

export const SECRETARIA_CODES = [
  'DESP',
  'SGOB',
  'SHAC',
  'SSAL',
  'SEDU',
  'SMOV',
  'SMAM',
  'SINF',
  'SSEG',
  'SDE',
  'SCUL',
  'SJUV',
  'SMUJ',
  'SPDH',
  'SPAR',
  'SGHS',
  'SSUM',
  'SEVC',
  'SINC',
  'SCOM',
  'SIND',
  'DAP',
  'DAGRD',
  'GCEN',
  'GCOR',
  'UAEBC',
] as const;

export const URGENCY_LEVELS = ['baja', 'media', 'alta', 'critica'] as const;

export const ENTITY_KINDS = [
  'cedula',
  'direccion',
  'telefono',
  'email',
  'nombre',
  'placa',
  'nit',
] as const;

export type PqrTipo = (typeof PQR_TIPOS)[number];
export type SecretariaCode = (typeof SECRETARIA_CODES)[number];
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface AttachmentInput {
  filename: string;
  url?: string;
  mime_type?: string;
  size_bytes?: number;
  text?: string;
}

export interface ExtractedEntity {
  kind: EntityKind;
  value: string;
  confidence: number;
  sensitive: true;
  start?: number;
  end?: number;
}

export interface EstructuraMinima {
  hechos_ok: boolean;
  peticion_ok: boolean;
  direccion_ok: boolean;
  fecha_ok: boolean;
}

export interface RespetoSignal {
  ok: boolean;
  is_offensive: boolean;
  reason: string | null;
}

export interface AnonimatoSignal {
  is_anonymous: boolean;
  has_contact_data: boolean;
  public_response_route: boolean;
}

export interface DependenciaClassification {
  codigo: SecretariaCode;
  nombre: string;
  confidence: number;
  fuera_de_competencia_municipal: boolean;
  reasoning: string;
}

export interface UrgencyClassification {
  level: UrgencyLevel;
  tutela_risk_score: number;
  rationale: string;
}

export interface Classification {
  tipo: PqrTipo;
  dependencia: DependenciaClassification;
  urgencia: UrgencyClassification;
  entities: ExtractedEntity[];
  estructura_minima: EstructuraMinima;
  respeto: RespetoSignal;
  anonimato: AnonimatoSignal;
  discriminacion_tematica: string[];
  confidence: number;
  prompt_version: string;
}

export interface ClassificationFailure {
  status: 'pending_human';
  reason: 'claude_unavailable' | 'timeout' | 'invalid_model_output';
  message: string;
  raw_response?: unknown;
}

export type ClassificationResult = Classification | ClassificationFailure;

export function isClassification(value: ClassificationResult): value is Classification {
  return !('status' in value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(
  value: unknown,
  options: T,
): value is T[number] {
  return typeof value === 'string' && options.includes(value);
}

function numberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`classification.${key} must be a boolean`);
  }
  return value;
}

function parseEntities(value: unknown): ExtractedEntity[] {
  if (!Array.isArray(value)) throw new Error('classification.entities must be an array');
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`classification.entities[${index}] must be an object`);
    if (!isOneOf(item.kind, ENTITY_KINDS)) {
      throw new Error(`classification.entities[${index}].kind is invalid`);
    }
    if (typeof item.value !== 'string' || item.value.trim() === '') {
      throw new Error(`classification.entities[${index}].value must be a non-empty string`);
    }
    if (!numberInRange(item.confidence, 0, 1)) {
      throw new Error(`classification.entities[${index}].confidence must be between 0 and 1`);
    }
    return {
      kind: item.kind,
      value: item.value,
      confidence: item.confidence,
      sensitive: true,
      start: typeof item.start === 'number' ? item.start : undefined,
      end: typeof item.end === 'number' ? item.end : undefined,
    };
  });
}

export function parseClassification(value: unknown): Classification {
  if (!isRecord(value)) throw new Error('classification must be an object');

  if (!isOneOf(value.tipo, PQR_TIPOS)) throw new Error('classification.tipo is invalid');
  if (!isRecord(value.dependencia)) {
    throw new Error('classification.dependencia must be an object');
  }
  const dependencia = value.dependencia;
  if (!isOneOf(dependencia.codigo, SECRETARIA_CODES)) {
    throw new Error('classification.dependencia.codigo is invalid');
  }
  if (typeof dependencia.nombre !== 'string') {
    throw new Error('classification.dependencia.nombre must be a string');
  }
  if (!numberInRange(dependencia.confidence, 0, 1)) {
    throw new Error('classification.dependencia.confidence must be between 0 and 1');
  }
  if (typeof dependencia.fuera_de_competencia_municipal !== 'boolean') {
    throw new Error('classification.dependencia.fuera_de_competencia_municipal must be a boolean');
  }
  if (typeof dependencia.reasoning !== 'string') {
    throw new Error('classification.dependencia.reasoning must be a string');
  }

  if (!isRecord(value.urgencia)) throw new Error('classification.urgencia must be an object');
  const urgencia = value.urgencia;
  if (!isOneOf(urgencia.level, URGENCY_LEVELS)) {
    throw new Error('classification.urgencia.level is invalid');
  }
  if (!numberInRange(urgencia.tutela_risk_score, 0, 1)) {
    throw new Error('classification.urgencia.tutela_risk_score must be between 0 and 1');
  }
  if (typeof urgencia.rationale !== 'string') {
    throw new Error('classification.urgencia.rationale must be a string');
  }

  if (!isRecord(value.estructura_minima)) {
    throw new Error('classification.estructura_minima must be an object');
  }
  const estructura = value.estructura_minima;

  if (!isRecord(value.respeto)) throw new Error('classification.respeto must be an object');
  const respeto = value.respeto;

  if (!isRecord(value.anonimato)) throw new Error('classification.anonimato must be an object');
  const anonimato = value.anonimato;

  if (!Array.isArray(value.discriminacion_tematica)) {
    throw new Error('classification.discriminacion_tematica must be an array');
  }
  const discriminacion = value.discriminacion_tematica.map((tag, index) => {
    if (typeof tag !== 'string') {
      throw new Error(`classification.discriminacion_tematica[${index}] must be a string`);
    }
    return tag;
  });

  if (!numberInRange(value.confidence, 0, 1)) {
    throw new Error('classification.confidence must be between 0 and 1');
  }
  if (typeof value.prompt_version !== 'string' || value.prompt_version.trim() === '') {
    throw new Error('classification.prompt_version must be a non-empty string');
  }

  return {
    tipo: value.tipo,
    dependencia: {
      codigo: dependencia.codigo,
      nombre: dependencia.nombre,
      confidence: dependencia.confidence,
      fuera_de_competencia_municipal: dependencia.fuera_de_competencia_municipal,
      reasoning: dependencia.reasoning,
    },
    urgencia: {
      level: urgencia.level,
      tutela_risk_score: urgencia.tutela_risk_score,
      rationale: urgencia.rationale,
    },
    entities: parseEntities(value.entities),
    estructura_minima: {
      hechos_ok: requireBoolean(estructura, 'hechos_ok'),
      peticion_ok: requireBoolean(estructura, 'peticion_ok'),
      direccion_ok: requireBoolean(estructura, 'direccion_ok'),
      fecha_ok: requireBoolean(estructura, 'fecha_ok'),
    },
    respeto: {
      ok: requireBoolean(respeto, 'ok'),
      is_offensive: requireBoolean(respeto, 'is_offensive'),
      reason: typeof respeto.reason === 'string' ? respeto.reason : null,
    },
    anonimato: {
      is_anonymous: requireBoolean(anonimato, 'is_anonymous'),
      has_contact_data: requireBoolean(anonimato, 'has_contact_data'),
      public_response_route: requireBoolean(anonimato, 'public_response_route'),
    },
    discriminacion_tematica: discriminacion,
    confidence: value.confidence,
    prompt_version: value.prompt_version,
  };
}
