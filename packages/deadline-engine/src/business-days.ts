import type { HolidaysByYear, Suspension } from './types';
import { DeadlineEngineError } from './types';
import { isHoliday } from './holidays';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toBogotaISODate(date: Date | string): string {
  if (typeof date === 'string') {
    if (ISO_DATE_RE.test(date)) return date;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new DeadlineEngineError('INVALID_ISO_DATE', `Cannot parse date string: ${date}`);
    }
    return formatBogota(parsed);
  }
  return formatBogota(date);
}

export function fromBogotaISODate(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) {
    throw new DeadlineEngineError('INVALID_ISO_DATE', `Expected YYYY-MM-DD, got: ${iso}`);
  }
  const d = new Date(`${iso}T05:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new DeadlineEngineError('INVALID_ISO_DATE', `Invalid calendar date: ${iso}`);
  }
  return d;
}

export function isBusinessDay(
  date: Date | string,
  holidays: HolidaysByYear,
  suspensiones?: readonly Suspension[],
): boolean {
  const iso = toBogotaISODate(date);
  const dow = fromBogotaISODate(iso).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (isHoliday(iso, holidays)) return false;
  if (suspensiones && suspensiones.some((s) => iso >= s.from && iso <= s.to)) return false;
  return true;
}

export function addBusinessDays(
  date: Date | string,
  n: number,
  holidays: HolidaysByYear,
  suspensiones?: readonly Suspension[],
): Date {
  if (n < 0) return subtractBusinessDays(date, -n, holidays, suspensiones);
  const startISO = toBogotaISODate(date);
  if (n === 0) return fromBogotaISODate(startISO);

  let cursor = fromBogotaISODate(startISO);
  let remaining = n;
  while (remaining > 0) {
    cursor = stepDay(cursor, 1);
    if (isBusinessDay(cursor, holidays, suspensiones)) remaining -= 1;
  }
  return fromBogotaISODate(toBogotaISODate(cursor));
}

export function subtractBusinessDays(
  date: Date | string,
  n: number,
  holidays: HolidaysByYear,
  suspensiones?: readonly Suspension[],
): Date {
  if (n < 0) return addBusinessDays(date, -n, holidays, suspensiones);
  const startISO = toBogotaISODate(date);
  if (n === 0) return fromBogotaISODate(startISO);

  let cursor = fromBogotaISODate(startISO);
  let remaining = n;
  while (remaining > 0) {
    cursor = stepDay(cursor, -1);
    if (isBusinessDay(cursor, holidays, suspensiones)) remaining -= 1;
  }
  return fromBogotaISODate(toBogotaISODate(cursor));
}

function stepDay(date: Date, delta: 1 | -1): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

function formatBogota(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
