import { INTAKE_SOURCE_CHANNELS, type NormalizedIntake } from './types.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

export class IntakeValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid NormalizedIntake: ${issues.map((issue) => issue.path).join(', ')}`);
    this.name = 'IntakeValidationError';
    this.issues = issues;
  }
}

const NORMALIZED_INTAKE_KEYS = [
  'source_channel',
  'citizen_name',
  'is_anonymous',
  'document_id',
  'email',
  'phone',
  'subject',
  'description',
  'raw_text',
  'attachments',
  'location_text',
  'consent_data',
  'created_at',
] as const;

const ATTACHMENT_KEYS = ['filename', 'url', 'mime_type', 'size_bytes', 'text'] as const;

const CHANNELS = new Set<string>(INTAKE_SOURCE_CHANNELS);
const NORMALIZED_INTAKE_KEY_SET = new Set<string>(NORMALIZED_INTAKE_KEYS);
const ATTACHMENT_KEY_SET = new Set<string>(ATTACHMENT_KEYS);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addIssue(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function validateRequiredString(
  record: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
): void {
  if (typeof record[key] !== 'string') {
    addIssue(issues, key, 'must be a string');
  }
}

function validateRequiredBoolean(
  record: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
): void {
  if (typeof record[key] !== 'boolean') {
    addIssue(issues, key, 'must be a boolean');
  }
}

function validateNullableString(
  record: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
): void {
  const value = record[key];
  if (value !== undefined && value !== null && typeof value !== 'string') {
    addIssue(issues, key, 'must be a string or null');
  }
}

function validateAttachments(value: unknown, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    addIssue(issues, 'attachments', 'must be an array');
    return;
  }

  value.forEach((attachment, index) => {
    const base = `attachments[${index}]`;
    if (!isRecord(attachment)) {
      addIssue(issues, base, 'must be an object');
      return;
    }

    for (const key of Object.keys(attachment)) {
      if (!ATTACHMENT_KEY_SET.has(key)) {
        addIssue(issues, `${base}.${key}`, 'is not allowed');
      }
    }

    if (typeof attachment.filename !== 'string' || attachment.filename.trim() === '') {
      addIssue(issues, `${base}.filename`, 'must be a non-empty string');
    }
    if (attachment.url !== undefined && typeof attachment.url !== 'string') {
      addIssue(issues, `${base}.url`, 'must be a string');
    }
    if (attachment.mime_type !== undefined && typeof attachment.mime_type !== 'string') {
      addIssue(issues, `${base}.mime_type`, 'must be a string');
    }
    if (attachment.text !== undefined && typeof attachment.text !== 'string') {
      addIssue(issues, `${base}.text`, 'must be a string');
    }
    const sizeBytes = attachment.size_bytes;
    if (
      sizeBytes !== undefined &&
      (typeof sizeBytes !== 'number' || !Number.isInteger(sizeBytes) || sizeBytes < 0)
    ) {
      addIssue(issues, `${base}.size_bytes`, 'must be a non-negative integer');
    }
  });
}

export function getNormalizedIntakeIssues(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return [{ path: '$', message: 'must be an object' }];
  }

  for (const key of Object.keys(value)) {
    if (!NORMALIZED_INTAKE_KEY_SET.has(key)) {
      addIssue(issues, key, 'is not allowed');
    }
  }

  if (typeof value.source_channel !== 'string' || !CHANNELS.has(value.source_channel)) {
    addIssue(issues, 'source_channel', 'is not a supported intake source channel');
  }
  validateRequiredBoolean(value, 'is_anonymous', issues);
  validateRequiredString(value, 'subject', issues);
  validateRequiredString(value, 'description', issues);
  validateRequiredString(value, 'raw_text', issues);
  validateRequiredBoolean(value, 'consent_data', issues);
  validateRequiredString(value, 'created_at', issues);

  validateNullableString(value, 'citizen_name', issues);
  validateNullableString(value, 'document_id', issues);
  validateNullableString(value, 'email', issues);
  validateNullableString(value, 'phone', issues);
  validateNullableString(value, 'location_text', issues);

  if (typeof value.email === 'string' && !EMAIL_RE.test(value.email)) {
    addIssue(issues, 'email', 'must be a valid email address');
  }
  if (typeof value.created_at === 'string' && Number.isNaN(Date.parse(value.created_at))) {
    addIssue(issues, 'created_at', 'must be a valid date-time string');
  }

  validateAttachments(value.attachments, issues);

  return issues;
}

export function validateNormalizedIntake(value: unknown): NormalizedIntake {
  const issues = getNormalizedIntakeIssues(value);
  if (issues.length > 0) {
    throw new IntakeValidationError(issues);
  }
  return value as NormalizedIntake;
}

export function isNormalizedIntake(value: unknown): value is NormalizedIntake {
  return getNormalizedIntakeIssues(value).length === 0;
}
