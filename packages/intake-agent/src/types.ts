import type {
  AttachmentInput,
  Classification,
  ClassificationFailure,
} from '@omega/classifier/schemas';
import type { RedactionLogEntry } from '@omega/habeas-data';

export const INTAKE_SOURCE_CHANNELS = [
  'web',
  'email',
  'mercurio',
  'form',
  'phone',
  'whatsapp',
] as const;

export type IntakeSourceChannel = (typeof INTAKE_SOURCE_CHANNELS)[number];

export interface NormalizedIntake {
  source_channel: IntakeSourceChannel;
  citizen_name?: string | null;
  is_anonymous: boolean;
  document_id?: string | null;
  email?: string | null;
  phone?: string | null;
  subject: string;
  description: string;
  raw_text: string;
  attachments: AttachmentInput[];
  location_text?: string | null;
  consent_data: boolean;
  created_at: string;
}

export interface TenantContext {
  tenantId: string;
  tenantSlug?: string;
  defaultSecretariaCodigo?: string;
}

export interface FormatPreserveResult {
  raw_text: string;
  display_text: string;
  llm_text: string;
  redaction_log: RedactionLogEntry[];
}

export const INVALID_REASON_CODES = [
  'faltan_hechos',
  'falta_peticion',
  'irrespetuoso',
  'anonimo_sin_datos_contacto',
  'fuera_de_competencia_municipal',
] as const;

export type InvalidReasonCode = (typeof INVALID_REASON_CODES)[number];

export interface InvalidReason {
  code: InvalidReasonCode;
  message: string;
}

export interface IntakeValidity {
  valid: boolean;
  reasons: InvalidReason[];
}

export interface IntakeTag {
  namespace: string;
  slug: string;
  label: string;
  confidence: number;
}

export interface IntakeProblemGroup {
  id: string | null;
  action: 'attached' | 'created' | 'skipped';
  similarity_score: number | null;
}

export interface IntakeAgentResult {
  source_hash: string;
  tenant_id: string;
  status: 'accepted' | 'bounce' | 'pending_human';
  validity: IntakeValidity;
  resumen: string;
  formatted_original: FormatPreserveResult;
  tags: IntakeTag[];
  problem_group: IntakeProblemGroup;
  classification: Classification | ClassificationFailure;
  tokens_used: number;
  duration_ms: number;
}
