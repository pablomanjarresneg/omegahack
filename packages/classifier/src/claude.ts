import { redactText, type FieldName } from '@omega/habeas-data';

import { CLASSIFIER_SYSTEM_PROMPT } from './prompts/system.js';
import { PROMPT_VERSION, SECRETARIA_NAMES } from './prompts/taxonomy.js';
import {
  ENTITY_KINDS,
  PQR_TIPOS,
  SECRETARIA_CODES,
  URGENCY_LEVELS,
  parseClassification,
  type AttachmentInput,
  type Classification,
  type ClassificationFailure,
  type ClassificationResult,
  type EntityKind,
  type ExtractedEntity,
  type PqrTipo,
  type SecretariaCode,
  type UrgencyLevel,
} from './schemas.js';
import type { ClassifyOptions } from './index.js';

const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
const DEFAULT_TIMEOUT_MS = 20_000;
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const CLASSIFY_TOOL_NAME = 'classify_pqrsd';

const FIELD_TO_ENTITY: Partial<Record<FieldName, EntityKind>> = {
  cedula: 'cedula',
  direccion: 'direccion',
  telefono: 'telefono',
  email: 'email',
  nombre: 'nombre',
  placa: 'placa',
  nit: 'nit',
};

const NAME_WORD = String.raw`\p{Lu}[\p{L}'.-]{1,}`;
const NAME_PATTERN_SOURCES = [
  String.raw`\b(?:[Ss]oy|[Mm]i nombre es|[Mm]e llamo|[Nn]ombre:)\s+(${NAME_WORD}(?:\s+${NAME_WORD}){0,3})\b`,
  String.raw`\b(?:[Aa]tentamente|[Cc]ordialmente),?\s+(${NAME_WORD}(?:\s+${NAME_WORD}){0,3})\b`,
] as const;

const CLASSIFICATION_TOOL = {
  name: CLASSIFY_TOOL_NAME,
  description: 'Classify a Medellin municipal PQRSD intake message.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'tipo',
      'dependencia',
      'urgencia',
      'entities',
      'estructura_minima',
      'respeto',
      'anonimato',
      'discriminacion_tematica',
      'confidence',
      'prompt_version',
    ],
    properties: {
      tipo: { type: 'string', enum: PQR_TIPOS },
      dependencia: {
        type: 'object',
        additionalProperties: false,
        required: [
          'codigo',
          'nombre',
          'confidence',
          'fuera_de_competencia_municipal',
          'reasoning',
        ],
        properties: {
          codigo: { type: 'string', enum: SECRETARIA_CODES },
          nombre: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          fuera_de_competencia_municipal: { type: 'boolean' },
          reasoning: { type: 'string' },
        },
      },
      urgencia: {
        type: 'object',
        additionalProperties: false,
        required: ['level', 'tutela_risk_score', 'rationale'],
        properties: {
          level: { type: 'string', enum: URGENCY_LEVELS },
          tutela_risk_score: { type: 'number', minimum: 0, maximum: 1 },
          rationale: { type: 'string' },
        },
      },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'value', 'confidence', 'sensitive'],
          properties: {
            kind: { type: 'string', enum: ENTITY_KINDS },
            value: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            sensitive: { type: 'boolean', const: true },
            start: { type: 'number' },
            end: { type: 'number' },
          },
        },
      },
      estructura_minima: {
        type: 'object',
        additionalProperties: false,
        required: ['hechos_ok', 'peticion_ok', 'direccion_ok', 'fecha_ok'],
        properties: {
          hechos_ok: { type: 'boolean' },
          peticion_ok: { type: 'boolean' },
          direccion_ok: { type: 'boolean' },
          fecha_ok: { type: 'boolean' },
        },
      },
      respeto: {
        type: 'object',
        additionalProperties: false,
        required: ['ok', 'is_offensive', 'reason'],
        properties: {
          ok: { type: 'boolean' },
          is_offensive: { type: 'boolean' },
          reason: { type: ['string', 'null'] },
        },
      },
      anonimato: {
        type: 'object',
        additionalProperties: false,
        required: ['is_anonymous', 'has_contact_data', 'public_response_route'],
        properties: {
          is_anonymous: { type: 'boolean' },
          has_contact_data: { type: 'boolean' },
          public_response_route: { type: 'boolean' },
        },
      },
      discriminacion_tematica: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      prompt_version: { type: 'string' },
    },
  },
};

interface DependencyRule {
  codigo: SecretariaCode;
  tags: readonly string[];
  keywords: readonly string[];
}

const DEPENDENCY_RULES: readonly DependencyRule[] = [
  {
    codigo: 'SMOV',
    tags: ['movilidad'],
    keywords: ['movilidad', 'transito', 'trafico', 'comparendo', 'semaforo', 'taxi', 'bus', 'parqueadero', 'placa', 'accidente vial', 'via cerrada'],
  },
  {
    codigo: 'SSAL',
    tags: ['salud'],
    keywords: ['salud', 'hospital', 'urgencias', 'ambulancia', 'vacuna', 'eps', 'sisb', 'dengue', 'medico', 'paciente'],
  },
  {
    codigo: 'SEDU',
    tags: ['educacion'],
    keywords: ['educacion', 'colegio', 'escuela', 'matricula', 'docente', 'estudiante', 'rector', 'jornada escolar'],
  },
  {
    codigo: 'SMAM',
    tags: ['ambiente'],
    keywords: ['arbol', 'quebrada', 'contaminacion', 'ruido', 'residuos', 'escombros', 'animal', 'ambiental', 'aire', 'agua'],
  },
  {
    codigo: 'SINF',
    tags: ['infraestructura'],
    keywords: ['hueco', 'anden', 'puente', 'obra', 'malla vial', 'calzada', 'carretera', 'via', 'infraestructura', 'luminaria'],
  },
  {
    codigo: 'SSEG',
    tags: ['seguridad'],
    keywords: ['seguridad', 'convivencia', 'amenaza', 'rina', 'hurto', 'vendedor informal', 'espacio publico', 'policia', 'violencia'],
  },
  {
    codigo: 'SHAC',
    tags: ['hacienda'],
    keywords: ['impuesto', 'predial', 'hacienda', 'industria y comercio', 'cobro', 'factura', 'pago', 'tesoreria'],
  },
  {
    codigo: 'DAGRD',
    tags: ['riesgo'],
    keywords: ['derrumbe', 'inundacion', 'deslizamiento', 'emergencia', 'riesgo estructural', 'talud', 'grieta', 'evacuacion'],
  },
  {
    codigo: 'DAP',
    tags: ['planeacion'],
    keywords: ['planeacion', 'pot', 'uso del suelo', 'licencia urbanistica', 'catastro', 'urbanismo', 'predio'],
  },
  {
    codigo: 'SIND',
    tags: ['inclusion'],
    keywords: ['discapacidad', 'adulto mayor', 'habitante de calle', 'familia', 'infancia', 'social', 'subsidio'],
  },
  {
    codigo: 'UAEBC',
    tags: ['buen_comienzo'],
    keywords: ['buen comienzo', 'primera infancia', 'jardin infantil', 'nino', 'menor'],
  },
  {
    codigo: 'SGHS',
    tags: ['servicio_ciudadano'],
    keywords: ['funcionario', 'servidor publico', 'atencion al ciudadano', 'ventanilla', 'maltrato', 'tramite'],
  },
];

const TIPO_RULES: readonly { tipo: PqrTipo; keywords: readonly string[] }[] = [
  { tipo: 'oposicion', keywords: ['oposicion', 'me opongo', 'impugno', 'recurso contra', 'revocar decision', 'acto administrativo', 'sancion', 'comparendo'] },
  { tipo: 'denuncia', keywords: ['denuncio', 'denuncia', 'corrupcion', 'soborno', 'ilegal', 'delito', 'irregularidad grave'] },
  { tipo: 'reclamo', keywords: ['reclamo', 'cobro indebido', 'devolucion', 'compensacion', 'factura', 'perjuicio', 'dano'] },
  { tipo: 'queja', keywords: ['queja', 'maltrato', 'mala atencion', 'demora', 'no me han respondido', 'incumplimiento'] },
  { tipo: 'sugerencia', keywords: ['sugiero', 'sugerencia', 'propongo', 'recomiendo', 'mejorar', 'propuesta'] },
];

const CRITICAL_URGENCY = [
  'tutela',
  'desacato',
  'riesgo de muerte',
  'amenaza de muerte',
  'urgencia vital',
  'incendio',
  'derrumbe',
  'inundacion',
  'fuga de gas',
  'menor en riesgo',
] as const;

const HIGH_URGENCY = [
  'salud',
  'hospital',
  'discapacidad',
  'adulto mayor',
  'embarazo',
  'violencia',
  'amenaza',
  'sin agua',
  'sin energia',
  'accidente',
] as const;

const OFFENSIVE_WORDS = ['idiota', 'corrupto de mierda', 'malparido', 'hijueputa', 'imbecil'] as const;
const OUTSIDE_COMPETENCE = ['gobernacion', 'fiscalia', 'juzgado', 'banco', 'empresa privada', 'eps', 'policia nacional', 'curaduria'] as const;

export async function classifyWithClaude(
  rawText: string,
  attachments: AttachmentInput[] = [],
  options: ClassifyOptions = {},
): Promise<ClassificationResult> {
  const apiKey = readEnv('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return classifyHeuristically(rawText, attachments, options);
  }

  const controller = new AbortController();
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(readEnv('ANTHROPIC_API_URL') ?? ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(buildClaudeRequest(rawText, attachments, options)),
    });

    if (response.status >= 500) {
      return failure('claude_unavailable', `Claude returned HTTP ${response.status}`, {
        status: response.status,
        body: await safeResponseText(response),
      });
    }

    if (!response.ok) {
      return failure('claude_unavailable', `Claude request failed with HTTP ${response.status}`, {
        status: response.status,
        body: await safeResponseText(response),
      });
    }

    let body: unknown;
    try {
      body = await readResponseJson(response);
      const modelClassification = extractClaudeClassification(body);
      const parsed = parseClassification(modelClassification);
      return attachLocalEntities(parsed, rawText, attachments);
    } catch (error) {
      return failure('invalid_model_output', `Claude returned invalid classification: ${errorMessage(error)}`, body);
    }
  } catch (error) {
    if (isAbortError(error)) {
      return failure('timeout', `Claude request exceeded ${timeoutMs}ms`);
    }
    return failure('claude_unavailable', `Claude request failed: ${errorMessage(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function classifyHeuristically(
  rawText: string,
  attachments: AttachmentInput[] = [],
  _options: ClassifyOptions = {},
): Classification {
  const text = buildClassifierText(rawText, attachments);
  const normalized = normalize(text);
  const entities = extractEntities(rawText, attachments);
  const tipo = inferTipo(normalized);
  const dependencia = inferDependencia(normalized);
  const urgencia = inferUrgency(normalized);
  const respeto = inferRespeto(normalized);
  const anonimato = inferAnonimato(normalized, entities);

  return parseClassification({
    tipo,
    dependencia,
    urgencia,
    entities,
    estructura_minima: inferStructure(normalized, entities, tipo),
    respeto,
    anonimato,
    discriminacion_tematica: inferTags(normalized, dependencia.codigo, dependencia.fuera_de_competencia_municipal),
    confidence: dependencia.confidence < 0.65 ? 0.62 : 0.72,
    prompt_version: PROMPT_VERSION,
  });
}

export function extractEntities(rawText: string, attachments: AttachmentInput[] = []): ExtractedEntity[] {
  const text = buildClassifierText(rawText, attachments);
  const entities: ExtractedEntity[] = [];
  const { redactionLog } = redactText(text);

  for (const item of redactionLog) {
    const kind = FIELD_TO_ENTITY[item.fieldName];
    if (!kind) continue;
    entities.push({
      kind,
      value: item.match,
      confidence: confidenceForEntity(kind),
      sensitive: true,
      start: item.offset,
      end: item.offset + item.match.length,
    });
  }

  for (const entity of extractNameEntities(text, entities)) {
    entities.push(entity);
  }

  return mergeEntities(entities);
}

function buildClaudeRequest(
  rawText: string,
  attachments: AttachmentInput[],
  options: ClassifyOptions,
): Record<string, unknown> {
  const text = buildClassifierText(rawText, attachments);
  const redactedText = redactForModel(text);

  return {
    model: options.model ?? readEnv('ANTHROPIC_MODEL') ?? DEFAULT_MODEL,
    max_tokens: 1800,
    temperature: 0,
    system: CLASSIFIER_SYSTEM_PROMPT,
    tools: [CLASSIFICATION_TOOL],
    tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
    messages: [
      {
        role: 'user',
        content: [
          `Current date: ${(options.now ?? new Date()).toISOString().slice(0, 10)}`,
          'Classify this redacted PQRSD intake text.',
          'Return the full schema through the tool. Use entities: [] if unsure.',
          '',
          redactedText || '(empty)',
        ].join('\n'),
      },
    ],
  };
}

function buildClassifierText(rawText: string, attachments: AttachmentInput[]): string {
  const parts = [rawText.trim()];
  for (const attachment of attachments) {
    if (attachment.text?.trim()) {
      parts.push(`Attachment ${attachment.filename}:\n${attachment.text.trim()}`);
    }
  }
  return parts.filter((part) => part.length > 0).join('\n\n');
}

function redactForModel(text: string): string {
  let output = redactText(text).llmText;
  for (const source of NAME_PATTERN_SOURCES) {
    const re = new RegExp(source, 'gu');
    output = output.replace(re, (match: string, name: string) => match.replace(name, '[NOMBRE]'));
  }
  return output;
}

function extractNameEntities(text: string, existing: readonly ExtractedEntity[]): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  for (const source of NAME_PATTERN_SOURCES) {
    const re = new RegExp(source, 'gu');
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const value = match[1];
      if (!value) continue;
      const relativeStart = match[0].indexOf(value);
      const start = match.index + relativeStart;
      const end = start + value.length;
      if (!overlapsAny(start, end, existing) && !overlapsAny(start, end, entities)) {
        entities.push({ kind: 'nombre', value, confidence: 0.72, sensitive: true, start, end });
      }
      if (match[0].length === 0) re.lastIndex++;
    }
  }
  return entities;
}

function attachLocalEntities(
  classification: Classification,
  rawText: string,
  attachments: AttachmentInput[],
): Classification {
  const localEntities = extractEntities(rawText, attachments);
  const modelEntities = classification.entities.filter((entity) => !isRedactionToken(entity.value));
  return parseClassification({
    ...classification,
    entities: mergeEntities([...localEntities, ...modelEntities]),
  });
}

function inferTipo(normalized: string): PqrTipo {
  for (const rule of TIPO_RULES) {
    if (containsAny(normalized, rule.keywords)) return rule.tipo;
  }
  return 'peticion';
}

function inferDependencia(normalized: string): Classification['dependencia'] {
  let best: { rule: DependencyRule; hits: string[] } | null = null;

  for (const rule of DEPENDENCY_RULES) {
    const hits = rule.keywords.filter((keyword) => normalized.includes(normalize(keyword)));
    if (!best || hits.length > best.hits.length) {
      best = { rule, hits };
    }
  }

  const selected = best && best.hits.length > 0 ? best : null;
  const codigo = selected?.rule.codigo ?? 'SGOB';
  const outside = containsAny(normalized, OUTSIDE_COMPETENCE);
  const confidence = selected ? clamp(0.55 + selected.hits.length * 0.11, 0, outside ? 0.78 : 0.92) : 0.52;
  const hitText = selected ? selected.hits.slice(0, 4).join(', ') : 'general intake';

  return {
    codigo,
    nombre: SECRETARIA_NAMES[codigo],
    confidence,
    fuera_de_competencia_municipal: outside,
    reasoning: outside
      ? `Matched ${hitText}; possible non-municipal competence.`
      : `Matched ${hitText}.`,
  };
}

function inferUrgency(normalized: string): Classification['urgencia'] {
  if (containsAny(normalized, CRITICAL_URGENCY)) {
    return urgency('critica', 0.92, 'Critical risk or tutela indicator found.');
  }
  if (containsAny(normalized, HIGH_URGENCY)) {
    return urgency('alta', 0.72, 'High impact or vulnerable population indicator found.');
  }
  if (containsAny(normalized, ['no me han respondido', 'desde hace', 'reitero', 'demora', 'sin respuesta'])) {
    return urgency('media', 0.42, 'Delay or repeated request indicator found.');
  }
  return urgency('baja', 0.12, 'No urgent risk indicators found.');
}

function urgency(level: UrgencyLevel, tutelaRiskScore: number, rationale: string): Classification['urgencia'] {
  return { level, tutela_risk_score: tutelaRiskScore, rationale };
}

function inferStructure(
  normalized: string,
  entities: readonly ExtractedEntity[],
  tipo: PqrTipo,
): Classification['estructura_minima'] {
  return {
    hechos_ok: normalized.split(/\s+/).filter(Boolean).length >= 8,
    peticion_ok:
      tipo === 'sugerencia' ||
      containsAny(normalized, ['solicito', 'pido', 'requiero', 'necesito', 'exijo', 'quiero', 'por favor', 'me opongo']),
    direccion_ok:
      entities.some((entity) => entity.kind === 'direccion') ||
      containsAny(normalized, ['barrio', 'comuna', 'sector', 'vereda', 'corregimiento', 'calle', 'carrera']),
    fecha_ok:
      /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(normalized) ||
      containsAny(normalized, ['hoy', 'ayer', 'desde', 'hace', 'el dia']),
  };
}

function inferRespeto(normalized: string): Classification['respeto'] {
  const offensive = containsAny(normalized, OFFENSIVE_WORDS);
  return {
    ok: !offensive,
    is_offensive: offensive,
    reason: offensive ? 'Contains offensive language.' : null,
  };
}

function inferAnonimato(normalized: string, entities: readonly ExtractedEntity[]): Classification['anonimato'] {
  const hasContactData = entities.some((entity) =>
    entity.kind === 'email' || entity.kind === 'telefono' || entity.kind === 'direccion'
  );
  const hasName = entities.some((entity) => entity.kind === 'nombre');
  const asksAnonymity = containsAny(normalized, ['anonimo', 'anonima', 'reserva de identidad', 'sin revelar mi nombre']);
  const isAnonymous = asksAnonymity || (!hasName && !hasContactData);
  return {
    is_anonymous: isAnonymous,
    has_contact_data: hasContactData,
    public_response_route: isAnonymous && !hasContactData,
  };
}

function inferTags(normalized: string, codigo: SecretariaCode, outside: boolean): string[] {
  const tags = new Set<string>();
  for (const rule of DEPENDENCY_RULES) {
    if (containsAny(normalized, rule.keywords)) {
      for (const tag of rule.tags) tags.add(tag);
    }
  }
  if (outside) tags.add('fuera_competencia');
  if (tags.size === 0) tags.add(codigo.toLowerCase());
  return [...tags].sort();
}

function extractClaudeClassification(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    throw new Error('missing content array');
  }

  for (const block of value.content) {
    if (
      isRecord(block) &&
      block.type === 'tool_use' &&
      block.name === CLASSIFY_TOOL_NAME &&
      'input' in block
    ) {
      return block.input;
    }
  }

  const text = value.content
    .filter((block): block is { type: string; text: string } => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (text) return parseJsonObject(text);
  throw new Error('missing tool_use input');
}

function parseJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('missing JSON object');
  return JSON.parse(candidate.slice(start, end + 1));
}

async function readResponseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) throw new Error('empty response body');
  return JSON.parse(text);
}

async function safeResponseText(response: Response): Promise<string | null> {
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function failure(
  reason: ClassificationFailure['reason'],
  message: string,
  rawResponse?: unknown,
): ClassificationFailure {
  return {
    status: 'pending_human',
    reason,
    message,
    raw_response: rawResponse,
  };
}

function readEnv(name: string): string | undefined {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  return value?.trim() ? value : undefined;
}

function resolveTimeoutMs(option: number | undefined): number {
  const envTimeout = Number(readEnv('ANTHROPIC_TIMEOUT_MS'));
  const value = option ?? (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function containsAny(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => text.includes(normalize(needle)));
}

function confidenceForEntity(kind: EntityKind): number {
  if (kind === 'nombre') return 0.72;
  if (kind === 'direccion') return 0.9;
  return 0.98;
}

function isRedactionToken(value: string): boolean {
  return /^\[[A-Z_]+\]$/.test(value.trim());
}

function mergeEntities(entities: readonly ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Set<string>();
  const merged: ExtractedEntity[] = [];

  for (const entity of entities) {
    const key =
      typeof entity.start === 'number' && typeof entity.end === 'number'
        ? `${entity.kind}:${entity.start}:${entity.end}`
        : `${entity.kind}:${normalize(entity.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entity);
  }

  return merged.sort((a, b) => (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER));
}

function overlapsAny(start: number, end: number, entities: readonly ExtractedEntity[]): boolean {
  return entities.some((entity) => {
    if (typeof entity.start !== 'number' || typeof entity.end !== 'number') return false;
    return start < entity.end && end > entity.start;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
