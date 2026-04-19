import type { HolidaysByYear } from './types';
import holidaysJson from '../../../fixtures/colombian-holidays/holidays.json' with { type: 'json' };

export function loadHolidays(): HolidaysByYear {
  return holidaysJson as HolidaysByYear;
}

export function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function applyEmiliani(date: Date): Date {
  const day = date.getUTCDay();
  if (day === 1) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
  const delta = day === 0 ? 1 : 8 - day;
  const shifted = new Date(date.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function isHoliday(date: Date | string, holidays: HolidaysByYear): boolean {
  const iso = normalizeToBogotaISO(date);
  const year = iso.slice(0, 4);
  return holidays[year]?.includes(iso) ?? false;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeToBogotaISO(date: Date | string): string {
  if (typeof date === 'string') {
    if (ISO_DATE_RE.test(date)) return date;
    const parsed = new Date(date);
    return formatBogota(parsed);
  }
  return formatBogota(date);
}

function formatBogota(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
