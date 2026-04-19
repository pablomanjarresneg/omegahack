export type PlazoType =
  | 'peticion_general'
  | 'queja'
  | 'reclamo'
  | 'informacion'
  | 'consulta'
  | 'inter_autoridades'
  | 'salud_priority'
  | 'traslado_por_competencia'
  | 'post_tutela';

export type HolidaysByYear = Record<string, readonly string[]>;

export interface Suspension {
  readonly from: string;
  readonly to: string;
  readonly reason: string;
}

export interface TenantConfig {
  readonly suspensiones?: readonly Suspension[];
  readonly saludPriorityDays?: number;
}

export type DeadlineUnit = 'business_days' | 'clock_hours';

export interface DeadlineResult {
  readonly deadlineAt: Date;
  readonly issuedAt: Date;
  readonly plazoType: PlazoType;
  readonly unit: DeadlineUnit;
  readonly amount: number;
  readonly holidaysSkipped: readonly string[];
  readonly suspensionsApplied: readonly Suspension[];
}

export type ProgressStatus = 'on_track' | 'at_risk' | 'overdue';

export interface ProgressResult {
  readonly elapsed: number;
  readonly remaining: number;
  readonly total: number;
  readonly unit: DeadlineUnit;
  readonly percentUsed: number;
  readonly status: ProgressStatus;
}

export interface PqrSnapshot {
  readonly issuedAt: Date | string;
  readonly plazoType: PlazoType;
  readonly deadlineAt: Date | string;
  readonly tenantConfig?: TenantConfig;
}

export interface ExtensionAuditEvent {
  readonly type: 'deadline_extended';
  readonly reason: string;
  readonly originalDeadline: Date;
  readonly newDeadline: Date;
  readonly extensionDelta: number;
  readonly unit: DeadlineUnit;
  readonly recordedAt: Date;
}

export interface ExtensionResult {
  readonly newDeadlineAt: Date;
  readonly auditEvent: ExtensionAuditEvent;
}

export class DeadlineEngineError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DeadlineEngineError';
    this.code = code;
  }
}
