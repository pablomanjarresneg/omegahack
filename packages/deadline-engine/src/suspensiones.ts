import { toBogotaISODate } from './business-days';
import { DeadlineEngineError, type Suspension } from './types';

/**
 * True when `date` falls inside any suspension range (inclusive on both
 * endpoints). All comparisons happen on the Bogota-local calendar date.
 */
export function isSuspended(
  date: Date | string,
  suspensiones?: readonly Suspension[],
): boolean {
  if (!suspensiones || suspensiones.length === 0) {
    return false;
  }
  const target = toBogotaISODate(date);
  for (const s of suspensiones) {
    const from = toBogotaISODate(s.from);
    const to = toBogotaISODate(s.to);
    if (from <= target && target <= to) {
      return true;
    }
  }
  return false;
}

/**
 * Throw `DeadlineEngineError('INVALID_SUSPENSION_RANGE', …)` if any suspension
 * has `from > to`. No-op when the list is empty or missing.
 */
export function validateSuspensions(
  suspensiones?: readonly Suspension[],
): void {
  if (!suspensiones || suspensiones.length === 0) {
    return;
  }
  for (let i = 0; i < suspensiones.length; i++) {
    const s = suspensiones[i]!;
    const from = toBogotaISODate(s.from);
    const to = toBogotaISODate(s.to);
    if (from > to) {
      throw new DeadlineEngineError(
        'INVALID_SUSPENSION_RANGE',
        `Suspension at index ${i} has from (${s.from}) after to (${s.to}).`,
      );
    }
  }
}
