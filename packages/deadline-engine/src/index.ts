import {
  addBusinessDays,
  fromBogotaISODate,
  isBusinessDay,
  subtractBusinessDays,
  toBogotaISODate,
} from './business-days';
import { isHoliday, loadHolidays } from './holidays';
import { resolvePlazo } from './plazos';
import { validateSuspensions } from './suspensiones';
import {
  DeadlineEngineError,
  type DeadlineResult,
  type DeadlineUnit,
  type ExtensionAuditEvent,
  type ExtensionResult,
  type PlazoType,
  type PqrSnapshot,
  type ProgressResult,
  type ProgressStatus,
  type Suspension,
  type TenantConfig,
} from './types';

export * from './types';
export { isBusinessDay, addBusinessDays, subtractBusinessDays } from './business-days';
export { isHoliday, loadHolidays } from './holidays';
export { PLAZOS, resolvePlazo } from './plazos';
export type { PlazoDefinition } from './plazos';
export { isSuspended, validateSuspensions } from './suspensiones';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 3600 * 1000;
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalize the various supported input shapes into a real `Date`.
 * - `YYYY-MM-DD` strings are interpreted as Bogota-local calendar dates.
 * - Any other string is passed through `new Date(...)`.
 * - `Date` inputs are returned as a fresh copy.
 */
function normalizeInstant(input: Date | string): Date {
  if (input instanceof Date) {
    return new Date(input.getTime());
  }
  if (typeof input === 'string' && ISO_DATE_ONLY.test(input)) {
    return fromBogotaISODate(input);
  }
  return new Date(input);
}

/**
 * Enumerate every Bogota-local calendar day in `(startExclusive, endInclusive]`.
 * Both endpoints are normalized to Bogota midnight before iterating so that DST
 * is irrelevant (Bogota does not observe it). Returns the ISO date strings in
 * ascending order.
 */
function enumerateBogotaDates(
  startExclusive: Date,
  endInclusive: Date,
): string[] {
  const out: string[] = [];
  if (endInclusive.getTime() <= startExclusive.getTime()) {
    return out;
  }
  const startISO = toBogotaISODate(startExclusive);
  const endISO = toBogotaISODate(endInclusive);
  // Walk one day at a time in Bogota-local space by bumping the anchor.
  let cursor = fromBogotaISODate(startISO);
  cursor = new Date(cursor.getTime() + MS_PER_DAY);
  const finalAnchor = fromBogotaISODate(endISO);
  while (cursor.getTime() <= finalAnchor.getTime()) {
    out.push(toBogotaISODate(cursor));
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }
  return out;
}

function suspensionsOverlapping(
  startInclusive: Date,
  endInclusive: Date,
  suspensiones: readonly Suspension[] | undefined,
): readonly Suspension[] {
  if (!suspensiones || suspensiones.length === 0) return [];
  const startISO = toBogotaISODate(startInclusive);
  const endISO = toBogotaISODate(endInclusive);
  const out: Suspension[] = [];
  for (const s of suspensiones) {
    const from = toBogotaISODate(s.from);
    const to = toBogotaISODate(s.to);
    // Overlap check on inclusive ranges.
    if (from <= endISO && to >= startISO) {
      out.push(s);
    }
  }
  return out;
}

/**
 * Convention: day 1 is the first business day strictly after `issuedAt`, so
 * `deadlineAt = addBusinessDays(issuedAt, amount, …)`.
 */
export function computeDeadline(
  issuedAt: Date | string,
  type: PlazoType,
  tenantConfig?: TenantConfig,
): DeadlineResult {
  validateSuspensions(tenantConfig?.suspensiones);
  const plazo = resolvePlazo(type, tenantConfig);
  const issued = normalizeInstant(issuedAt);
  const holidays = loadHolidays();
  const suspensiones = tenantConfig?.suspensiones;

  let deadlineAt: Date;
  if (plazo.unit === 'business_days') {
    deadlineAt = addBusinessDays(issued, plazo.amount, holidays, suspensiones);
  } else {
    deadlineAt = new Date(issued.getTime() + plazo.amount * MS_PER_HOUR);
  }

  const holidaysSkipped: string[] = [];
  for (const iso of enumerateBogotaDates(issued, deadlineAt)) {
    if (isHoliday(iso, holidays)) {
      holidaysSkipped.push(iso);
    }
  }

  const suspensionsApplied = suspensionsOverlapping(issued, deadlineAt, suspensiones);

  return {
    issuedAt: issued,
    deadlineAt,
    plazoType: type,
    unit: plazo.unit,
    amount: plazo.amount,
    holidaysSkipped,
    suspensionsApplied,
  };
}

function countBusinessDaysBetween(
  startExclusive: Date,
  endInclusive: Date,
  holidays: ReturnType<typeof loadHolidays>,
  suspensiones: readonly Suspension[] | undefined,
): number {
  if (endInclusive.getTime() <= startExclusive.getTime()) {
    return 0;
  }
  let count = 0;
  const startISO = toBogotaISODate(startExclusive);
  const endISO = toBogotaISODate(endInclusive);
  let cursor = fromBogotaISODate(startISO);
  cursor = new Date(cursor.getTime() + MS_PER_DAY);
  const finalAnchor = fromBogotaISODate(endISO);
  while (cursor.getTime() <= finalAnchor.getTime()) {
    if (isBusinessDay(cursor, holidays, suspensiones)) {
      count++;
    }
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }
  return count;
}

function clamp(min: number, max: number, value: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function computeStatus(
  now: Date,
  deadlineAt: Date,
  remaining: number,
  total: number,
  percentUsed: number,
): ProgressStatus {
  if (now.getTime() > deadlineAt.getTime()) return 'overdue';
  const ratioRemaining = total > 0 ? remaining / total : 0;
  if (ratioRemaining <= 0.2 || percentUsed >= 80) return 'at_risk';
  return 'on_track';
}

export function computeProgress(
  pqr: PqrSnapshot,
  now: Date = new Date(),
): ProgressResult {
  validateSuspensions(pqr.tenantConfig?.suspensiones);
  const issued = normalizeInstant(pqr.issuedAt);
  const deadlineAt = normalizeInstant(pqr.deadlineAt);
  const plazo = resolvePlazo(pqr.plazoType, pqr.tenantConfig);
  const holidays = loadHolidays();
  const suspensiones = pqr.tenantConfig?.suspensiones;

  const unit: DeadlineUnit = plazo.unit;
  const total = plazo.amount;

  let elapsed: number;
  if (unit === 'business_days') {
    if (now.getTime() <= issued.getTime()) {
      elapsed = 0;
    } else {
      const cap = now.getTime() < deadlineAt.getTime() ? now : deadlineAt;
      const counted = countBusinessDaysBetween(issued, cap, holidays, suspensiones);
      elapsed = Math.min(total, Math.max(0, counted));
    }
  } else {
    const deltaHours = (now.getTime() - issued.getTime()) / MS_PER_HOUR;
    elapsed = Math.max(0, deltaHours);
  }

  const remaining = Math.max(0, total - elapsed);
  const percentUsed =
    total > 0 ? clamp(0, 100, Math.round((elapsed / total) * 100)) : 0;
  const status = computeStatus(now, deadlineAt, remaining, total, percentUsed);

  return {
    elapsed,
    remaining,
    total,
    unit,
    percentUsed,
    status,
  };
}

export function extend(
  pqr: PqrSnapshot,
  reason: string,
  newDeadlineAt: Date | string,
): ExtensionResult {
  validateSuspensions(pqr.tenantConfig?.suspensiones);
  const plazo = resolvePlazo(pqr.plazoType, pqr.tenantConfig);
  const originalDeadline = normalizeInstant(pqr.deadlineAt);
  const proposedDeadline = normalizeInstant(newDeadlineAt);
  const holidays = loadHolidays();
  const suspensiones = pqr.tenantConfig?.suspensiones;

  if (proposedDeadline.getTime() <= originalDeadline.getTime()) {
    throw new DeadlineEngineError(
      'EXTENSION_NOT_AFTER_ORIGINAL',
      `newDeadlineAt (${proposedDeadline.toISOString()}) must be strictly after the original deadline (${originalDeadline.toISOString()}).`,
    );
  }

  let extensionDelta: number;
  if (plazo.unit === 'business_days') {
    extensionDelta = countBusinessDaysBetween(
      originalDeadline,
      proposedDeadline,
      holidays,
      suspensiones,
    );
  } else {
    extensionDelta =
      (proposedDeadline.getTime() - originalDeadline.getTime()) / MS_PER_HOUR;
  }

  // Ley 1755/2015: una prórroga no puede superar el doble del plazo original
  // (delta + amount <= 2 * amount  ⇔  delta <= amount).
  if (extensionDelta > plazo.amount) {
    throw new DeadlineEngineError(
      'EXTENSION_EXCEEDS_LIMIT',
      `Extension of ${extensionDelta} ${plazo.unit} exceeds the legal 2x cap (max additional ${plazo.amount} ${plazo.unit}).`,
    );
  }

  const auditEvent: ExtensionAuditEvent = {
    type: 'deadline_extended',
    reason,
    originalDeadline,
    newDeadline: proposedDeadline,
    extensionDelta,
    unit: plazo.unit,
    recordedAt: new Date(),
  };

  return {
    newDeadlineAt: proposedDeadline,
    auditEvent,
  };
}
