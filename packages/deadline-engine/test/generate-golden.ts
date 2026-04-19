/**
 * Golden fixture generator for @omega/deadline-engine.
 *
 * This script produces `test/fixtures/golden.json` using a small, inline
 * reference implementation that is INTENTIONALLY independent of the engine
 * under test. The only shared piece is the holidays fixture itself, which we
 * load via `loadHolidays()` to keep the calendar source of truth in one place.
 *
 * Determinism: all case IDs are generated from a monotonic counter. No
 * `Math.random()` is used anywhere. Re-running the script produces a
 * byte-identical file (modulo the embedded `generatedAt` timestamp).
 *
 * Invocation: `pnpm --filter @omega/deadline-engine generate:golden`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadHolidays } from '../src/index';
import type {
  HolidaysByYear,
  PlazoType,
  Suspension,
  TenantConfig,
} from '../src/types';

// ---------------------------------------------------------------------------
// Reference implementation (NAÏVE — do NOT import engine internals).
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toBogotaISODate(input: Date | string): string {
  if (typeof input === 'string') {
    if (ISO_DATE_RE.test(input)) return input;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(input));
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(input);
}

function parseYMD(iso: string): { y: number; m: number; d: number } {
  const y = Number.parseInt(iso.slice(0, 4), 10);
  const m = Number.parseInt(iso.slice(5, 7), 10);
  const d = Number.parseInt(iso.slice(8, 10), 10);
  return { y, m, d };
}

/** Day-of-week for a Bogota calendar date (0=Sun, 6=Sat). */
function dowForISO(iso: string): number {
  const { y, m, d } = parseYMD(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addCalendarDays(iso: string, delta: number): string {
  const { y, m, d } = parseYMD(iso);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + delta);
  return next.toISOString().slice(0, 10);
}

function isHolidayISO(iso: string, holidays: HolidaysByYear): boolean {
  const year = iso.slice(0, 4);
  return holidays[year]?.includes(iso) ?? false;
}

function isSuspendedISO(iso: string, suspensiones?: readonly Suspension[]): boolean {
  if (!suspensiones) return false;
  for (const s of suspensiones) {
    if (iso >= s.from && iso <= s.to) return true;
  }
  return false;
}

function isBusinessDayISO(
  iso: string,
  holidays: HolidaysByYear,
  suspensiones?: readonly Suspension[],
): boolean {
  const dow = dowForISO(iso);
  if (dow === 0 || dow === 6) return false;
  if (isHolidayISO(iso, holidays)) return false;
  if (isSuspendedISO(iso, suspensiones)) return false;
  return true;
}

interface ReferenceResult {
  readonly deadlineISO: string;
  readonly holidaysSkipped: string[];
  readonly suspensionsApplied: Suspension[];
}

/**
 * Reference implementation for business-days plazos.
 *
 * Day 1 is the first business day strictly after `issuedAtISO`; the deadline
 * is day N. Holidays, Saturdays, Sundays and suspensions are skipped and DO
 * NOT increment the counter.
 */
function referenceAddBusinessDays(
  issuedAtISO: string,
  n: number,
  holidays: HolidaysByYear,
  suspensiones?: readonly Suspension[],
): ReferenceResult {
  const holidaysSkipped: string[] = [];
  const suspensionsApplied: Suspension[] = [];
  const seenSuspensions = new Set<string>();

  let cursor = issuedAtISO;
  let counted = 0;

  while (counted < n) {
    cursor = addCalendarDays(cursor, 1);
    const dow = dowForISO(cursor);
    const hit = isHolidayISO(cursor, holidays);
    const susp = suspensiones?.find((s) => cursor >= s.from && cursor <= s.to);

    if (dow === 0 || dow === 6) {
      continue;
    }
    if (hit) {
      holidaysSkipped.push(cursor);
      continue;
    }
    if (susp) {
      const key = `${susp.from}|${susp.to}|${susp.reason}`;
      if (!seenSuspensions.has(key)) {
        seenSuspensions.add(key);
        suspensionsApplied.push(susp);
      }
      continue;
    }
    counted += 1;
  }

  return { deadlineISO: cursor, holidaysSkipped, suspensionsApplied };
}

// ---------------------------------------------------------------------------
// Case generation.
// ---------------------------------------------------------------------------

interface DeadlineCase {
  readonly id: string;
  readonly label: string;
  readonly input: {
    readonly issuedAt: string;
    readonly plazoType: PlazoType;
    readonly tenantConfig?: TenantConfig;
  };
  readonly expected: {
    readonly deadlineAt: string;
    readonly unit: 'business_days' | 'clock_hours';
    readonly amount: number;
    readonly holidaysSkipped: string[];
  };
}

interface ExtensionCase {
  readonly id: string;
  readonly label: string;
  readonly input: {
    readonly pqr: {
      readonly issuedAt: string;
      readonly plazoType: PlazoType;
      readonly deadlineAt: string;
      readonly tenantConfig?: TenantConfig;
    };
    readonly reason: string;
    readonly newDeadlineAt: string;
  };
  readonly expected:
    | { readonly shouldThrow: false; readonly newDeadlineAt: string }
    | { readonly shouldThrow: true; readonly errorCode: string };
}

interface ProgressCase {
  readonly id: string;
  readonly label: string;
  readonly input: {
    readonly pqr: {
      readonly issuedAt: string;
      readonly plazoType: PlazoType;
      readonly deadlineAt: string;
      readonly tenantConfig?: TenantConfig;
    };
    readonly now: string;
  };
  readonly expected: {
    readonly status: 'on_track' | 'at_risk' | 'overdue';
    readonly unit: 'business_days' | 'clock_hours';
    readonly amount: number;
  };
}

const PLAZO_AMOUNTS: Record<PlazoType, { unit: 'business_days' | 'clock_hours'; amount: number }> = {
  peticion_general: { unit: 'business_days', amount: 15 },
  queja: { unit: 'business_days', amount: 15 },
  reclamo: { unit: 'business_days', amount: 15 },
  informacion: { unit: 'business_days', amount: 10 },
  consulta: { unit: 'business_days', amount: 30 },
  inter_autoridades: { unit: 'business_days', amount: 10 },
  salud_priority: { unit: 'business_days', amount: 5 },
  traslado_por_competencia: { unit: 'business_days', amount: 5 },
  post_tutela: { unit: 'clock_hours', amount: 48 },
};

const BUSINESS_PLAZOS: PlazoType[] = [
  'peticion_general',
  'queja',
  'reclamo',
  'informacion',
  'consulta',
  'inter_autoridades',
  'salud_priority',
  'traslado_por_competencia',
];

function buildBusinessDayCase(
  idx: number,
  label: string,
  issuedAtISO: string,
  issuedAtTime: string,
  plazoType: PlazoType,
  holidays: HolidaysByYear,
  tenantConfig?: TenantConfig,
): DeadlineCase {
  const meta = PLAZO_AMOUNTS[plazoType];
  const ref = referenceAddBusinessDays(
    issuedAtISO,
    meta.amount,
    holidays,
    tenantConfig?.suspensiones,
  );
  const issuedAt = `${issuedAtISO}T${issuedAtTime}Z`;
  const expected = {
    deadlineAt: `${ref.deadlineISO}T05:00:00.000Z`,
    unit: meta.unit,
    amount: meta.amount,
    holidaysSkipped: [...ref.holidaysSkipped].sort(),
  };
  const input: DeadlineCase['input'] = tenantConfig
    ? { issuedAt, plazoType, tenantConfig }
    : { issuedAt, plazoType };
  return {
    id: `dl-${String(idx).padStart(4, '0')}`,
    label,
    input,
    expected,
  };
}

/**
 * Clock-hours reference: post-tutela is exactly 48 wall-clock hours after
 * issuance. No business-day logic, no holidays — just `t + 48h`.
 */
function buildPostTutelaCase(
  idx: number,
  label: string,
  issuedAtISOFull: string,
): DeadlineCase {
  const issued = new Date(issuedAtISOFull);
  const deadline = new Date(issued.getTime() + 48 * 3600 * 1000);
  return {
    id: `dl-${String(idx).padStart(4, '0')}`,
    label,
    input: { issuedAt: issuedAtISOFull, plazoType: 'post_tutela' },
    expected: {
      deadlineAt: deadline.toISOString(),
      unit: 'clock_hours',
      amount: 48,
      holidaysSkipped: [],
    },
  };
}

function generateDeadlineCases(holidays: HolidaysByYear): DeadlineCase[] {
  const cases: DeadlineCase[] = [];
  let idx = 1;

  // 1. All business plazo types x a spread of issuedAt dates per year.
  const sampleDates: Array<[string, string, string]> = [
    // [iso, label-suffix, time-of-day in Bogota → UTC]
    ['2024-01-02', 'jan-2024', '12:00:00.000'],
    ['2024-03-15', 'mar-2024', '09:30:00.000'],
    ['2024-07-15', 'jul-2024', '14:00:00.000'],
    ['2024-12-02', 'dec-2024', '10:15:00.000'],
    ['2025-01-02', 'jan-2025', '12:00:00.000'],
    ['2025-03-10', 'mar-2025', '08:00:00.000'],
    ['2025-07-15', 'jul-2025', '13:45:00.000'],
    ['2025-12-01', 'dec-2025', '11:00:00.000'],
    ['2026-02-02', 'feb-2026', '09:00:00.000'],
    ['2026-06-15', 'jun-2026', '15:30:00.000'],
    ['2026-09-14', 'sep-2026', '12:00:00.000'],
    ['2027-02-01', 'feb-2027', '10:00:00.000'],
    ['2027-06-14', 'jun-2027', '12:00:00.000'],
    ['2027-10-04', 'oct-2027', '08:30:00.000'],
    ['2028-02-01', 'feb-2028', '09:00:00.000'],
    ['2028-06-05', 'jun-2028', '14:00:00.000'],
    ['2028-11-06', 'nov-2028', '10:00:00.000'],
  ];

  for (const plazoType of BUSINESS_PLAZOS) {
    for (const [iso, suffix, time] of sampleDates) {
      cases.push(
        buildBusinessDayCase(idx++, `${plazoType}-${suffix}`, iso, time, plazoType, holidays),
      );
    }
  }

  // 2. End-of-month rollovers (Jan 31, Feb 28/29, Apr 30, Jun 30) for 2024–2028.
  const eomDates: string[] = [];
  for (let y = 2024; y <= 2028; y++) {
    eomDates.push(`${y}-01-31`);
    eomDates.push(`${y}-04-30`);
    eomDates.push(`${y}-06-30`);
    const feb = y % 4 === 0 ? 29 : 28;
    eomDates.push(`${y}-02-${feb}`);
  }
  for (const iso of eomDates) {
    cases.push(buildBusinessDayCase(idx++, `eom-${iso}`, iso, '12:00:00.000', 'peticion_general', holidays));
    cases.push(buildBusinessDayCase(idx++, `eom-${iso}-info`, iso, '12:00:00.000', 'informacion', holidays));
  }

  // 3. New Year boundaries.
  const newYearDates = ['2024-12-30', '2025-12-30', '2026-12-30', '2027-12-30'];
  for (const iso of newYearDates) {
    cases.push(buildBusinessDayCase(idx++, `new-year-${iso}`, iso, '12:00:00.000', 'peticion_general', holidays));
    cases.push(buildBusinessDayCase(idx++, `new-year-${iso}-consulta`, iso, '12:00:00.000', 'consulta', holidays));
  }

  // 4. Semana Santa — issued Thu/Fri Santos so the clock runs THROUGH the
  //    holiday. Thu/Fri Santos ISO dates by year (from the fixture).
  const semanaSanta: Array<[string, string]> = [
    ['2024-03-28', '2024-03-29'],
    ['2025-04-17', '2025-04-18'],
    ['2026-04-02', '2026-04-03'],
    ['2027-03-25', '2027-03-26'],
    ['2028-04-13', '2028-04-14'],
  ];
  for (const [thu, fri] of semanaSanta) {
    // Issue the Wednesday before so Thu/Fri are inside the window.
    const wed = addCalendarDays(thu, -1);
    cases.push(buildBusinessDayCase(idx++, `semana-santa-wed-${wed}`, wed, '12:00:00.000', 'peticion_general', holidays));
    cases.push(buildBusinessDayCase(idx++, `semana-santa-thu-${thu}`, thu, '12:00:00.000', 'informacion', holidays));
    cases.push(buildBusinessDayCase(idx++, `semana-santa-fri-${fri}`, fri, '12:00:00.000', 'informacion', holidays));
  }

  // 5. Long weekends on Emiliani Mondays — pick a handful across years.
  const emilianiMondays = [
    '2024-08-19',
    '2024-10-14',
    '2024-11-04',
    '2024-11-11',
    '2025-08-18',
    '2025-10-13',
    '2026-08-17',
    '2026-10-12',
    '2027-10-18',
    '2028-08-21',
  ];
  for (const iso of emilianiMondays) {
    // Issue the prior Friday so the Monday is skipped as a holiday.
    const fri = addCalendarDays(iso, -3);
    cases.push(buildBusinessDayCase(idx++, `emiliani-${iso}`, fri, '12:00:00.000', 'informacion', holidays));
  }

  // 6. Weekend issuedAt (Saturdays + Sundays across several weeks).
  const weekendStarts = [
    '2024-02-03',
    '2024-02-04',
    '2024-08-10',
    '2024-08-11',
    '2025-03-08',
    '2025-03-09',
    '2025-09-13',
    '2025-09-14',
    '2026-04-18', // Saturday — spot-check
    '2026-04-19',
    '2027-02-06',
    '2027-02-07',
    '2028-05-13',
    '2028-05-14',
  ];
  for (const iso of weekendStarts) {
    cases.push(
      buildBusinessDayCase(idx++, `weekend-${iso}`, iso, '12:00:00.000', 'peticion_general', holidays),
    );
  }

  // 7. Inter-autoridades (10 days) crossing holiday clusters around May 1,
  //    July 20, August 7.
  const interAuthClusters = [
    '2024-04-25',
    '2024-07-15',
    '2024-08-01',
    '2025-04-24',
    '2025-07-14',
    '2025-07-31',
    '2026-04-24',
    '2026-07-13',
    '2026-08-03',
    '2027-04-26',
    '2027-07-13',
    '2027-08-02',
  ];
  for (const iso of interAuthClusters) {
    cases.push(
      buildBusinessDayCase(idx++, `inter-aut-${iso}`, iso, '12:00:00.000', 'inter_autoridades', holidays),
    );
  }

  // 8. Post-tutela 48h across weekdays, weekends, across midnight.
  const postTutelaSamples = [
    '2024-01-10T12:00:00.000Z', // weekday noon
    '2024-01-13T23:30:00.000Z', // Saturday near midnight UTC
    '2025-07-19T05:00:00.000Z', // right at Bogota midnight
    '2025-12-31T18:00:00.000Z', // crosses year
    '2026-04-18T12:00:00.000Z', // Saturday
    '2026-05-01T00:00:00.000Z', // holiday start
    '2027-03-26T09:00:00.000Z', // Semana Santa
    '2027-11-15T23:59:59.000Z', // late evening
    '2028-02-29T12:00:00.000Z', // leap day
    '2028-12-31T23:00:00.000Z',
  ];
  for (const iso of postTutelaSamples) {
    cases.push(buildPostTutelaCase(idx++, `post-tutela-${iso}`, iso));
  }

  // 9. Suspension cases: 10-day plazo (informacion) with a 3-day suspension.
  const suspensionCases: Array<{ issued: string; from: string; to: string; label: string }> = [
    { issued: '2026-02-02', from: '2026-02-05', to: '2026-02-09', label: 'susp-2026-feb' },
    { issued: '2025-06-02', from: '2025-06-05', to: '2025-06-09', label: 'susp-2025-jun' },
    { issued: '2024-10-07', from: '2024-10-10', to: '2024-10-14', label: 'susp-2024-oct' },
    { issued: '2027-03-01', from: '2027-03-04', to: '2027-03-08', label: 'susp-2027-mar' },
  ];
  for (const s of suspensionCases) {
    const tenantConfig: TenantConfig = {
      suspensiones: [{ from: s.from, to: s.to, reason: 'ajuste-test' }],
    };
    cases.push(
      buildBusinessDayCase(
        idx++,
        s.label,
        s.issued,
        '12:00:00.000',
        'informacion',
        holidays,
        tenantConfig,
      ),
    );
  }

  // 10. Salud priority with tenant override (3 and 8 days).
  const saludSamples = ['2025-03-10', '2026-06-15', '2027-02-01', '2028-05-10'];
  for (const iso of saludSamples) {
    cases.push(
      buildBusinessDayCase(
        idx++,
        `salud-3-${iso}`,
        iso,
        '12:00:00.000',
        'salud_priority',
        holidays,
        { saludPriorityDays: 3 },
      ),
    );
    cases.push(
      buildBusinessDayCase(
        idx++,
        `salud-8-${iso}`,
        iso,
        '12:00:00.000',
        'salud_priority',
        holidays,
        { saludPriorityDays: 8 },
      ),
    );
  }

  // 11. The named spot-check. Must be findable by id OR label.
  const spotIssuedAt = '2026-04-18T12:00:00.000Z';
  const spotBogotaISO = toBogotaISODate(spotIssuedAt); // 2026-04-18
  const spotRef = referenceAddBusinessDays(spotBogotaISO, 15, holidays);
  cases.push({
    id: 'spot-check-2026-04-18',
    label: 'spot-check-2026-04-18',
    input: { issuedAt: spotIssuedAt, plazoType: 'peticion_general' },
    expected: {
      deadlineAt: `${spotRef.deadlineISO}T05:00:00.000Z`,
      unit: 'business_days',
      amount: 15,
      holidaysSkipped: [...spotRef.holidaysSkipped].sort(),
    },
  });

  return cases;
}

function generateExtensionCases(holidays: HolidaysByYear): ExtensionCase[] {
  const cases: ExtensionCase[] = [];
  let idx = 1;

  const bases: Array<{ issued: string; plazo: PlazoType }> = [
    { issued: '2025-03-10', plazo: 'peticion_general' },
    { issued: '2025-07-15', plazo: 'informacion' },
    { issued: '2026-02-02', plazo: 'consulta' },
    { issued: '2026-06-15', plazo: 'inter_autoridades' },
    { issued: '2027-02-01', plazo: 'queja' },
    { issued: '2027-10-04', plazo: 'reclamo' },
    { issued: '2028-05-10', plazo: 'traslado_por_competencia' },
    { issued: '2024-03-15', plazo: 'peticion_general' },
  ];

  for (const b of bases) {
    const meta = PLAZO_AMOUNTS[b.plazo];
    const original = referenceAddBusinessDays(b.issued, meta.amount, holidays);
    const originalDeadlineAt = `${original.deadlineISO}T05:00:00.000Z`;
    const issuedAt = `${b.issued}T12:00:00.000Z`;

    // Valid extensions at multiple factors: 1.25x, 1.5x, 1.75x. We avoid
    // the exact 2.0x boundary because the engine's acceptance at the cap
    // (<= vs <) is a design decision that's tested separately.
    const factors = [1.25, 1.5, 1.75];
    for (const f of factors) {
      const target = referenceAddBusinessDays(b.issued, Math.round(meta.amount * f), holidays);
      const newDeadlineAt = `${target.deadlineISO}T05:00:00.000Z`;
      cases.push({
        id: `ext-${String(idx).padStart(3, '0')}`,
        label: `${b.plazo}-${b.issued}-x${f}`,
        input: {
          pqr: {
            issuedAt,
            plazoType: b.plazo,
            deadlineAt: originalDeadlineAt,
          },
          reason: `extension by ${f}x for testing`,
          newDeadlineAt,
        },
        expected: { shouldThrow: false, newDeadlineAt },
      });
      idx += 1;
    }

    // Rejected extensions: 2.5x and 3x — strictly exceeds 2x cap.
    for (const f of [2.5, 3.0]) {
      const target = referenceAddBusinessDays(b.issued, Math.round(meta.amount * f), holidays);
      const newDeadlineAt = `${target.deadlineISO}T05:00:00.000Z`;
      cases.push({
        id: `ext-${String(idx).padStart(3, '0')}`,
        label: `${b.plazo}-${b.issued}-x${f}-rejected`,
        input: {
          pqr: {
            issuedAt,
            plazoType: b.plazo,
            deadlineAt: originalDeadlineAt,
          },
          reason: `extension exceeds cap`,
          newDeadlineAt,
        },
        expected: { shouldThrow: true, errorCode: 'EXTENSION_EXCEEDS_CAP' },
      });
      idx += 1;
    }

    // Rejected: new deadline earlier than original.
    const earlier = referenceAddBusinessDays(b.issued, Math.max(1, meta.amount - 2), holidays);
    cases.push({
      id: `ext-${String(idx).padStart(3, '0')}`,
      label: `${b.plazo}-${b.issued}-earlier-rejected`,
      input: {
        pqr: {
          issuedAt,
          plazoType: b.plazo,
          deadlineAt: originalDeadlineAt,
        },
        reason: `cannot shorten the deadline`,
        newDeadlineAt: `${earlier.deadlineISO}T05:00:00.000Z`,
      },
      expected: { shouldThrow: true, errorCode: 'EXTENSION_NOT_AFTER_ORIGINAL' },
    });
    idx += 1;
  }

  return cases;
}

function generateProgressCases(holidays: HolidaysByYear): ProgressCase[] {
  const cases: ProgressCase[] = [];
  let idx = 1;

  const bases: Array<{ issued: string; plazo: PlazoType }> = [
    { issued: '2025-03-10', plazo: 'peticion_general' },
    { issued: '2025-07-15', plazo: 'informacion' },
    { issued: '2026-02-02', plazo: 'consulta' },
    { issued: '2026-06-15', plazo: 'inter_autoridades' },
    { issued: '2027-02-01', plazo: 'queja' },
    { issued: '2027-10-04', plazo: 'reclamo' },
    { issued: '2028-05-10', plazo: 'traslado_por_competencia' },
    { issued: '2024-03-15', plazo: 'peticion_general' },
    { issued: '2026-04-18', plazo: 'peticion_general' },
    { issued: '2025-12-01', plazo: 'informacion' },
  ];

  for (const b of bases) {
    const meta = PLAZO_AMOUNTS[b.plazo];
    const ref = referenceAddBusinessDays(b.issued, meta.amount, holidays);
    const issuedAt = `${b.issued}T12:00:00.000Z`;
    const deadlineAt = `${ref.deadlineISO}T05:00:00.000Z`;

    // on_track — 20% in.
    const onTrackBdays = Math.max(1, Math.floor(meta.amount * 0.2));
    const onTrackNow = referenceAddBusinessDays(b.issued, onTrackBdays, holidays);
    cases.push({
      id: `prog-${String(idx).padStart(3, '0')}`,
      label: `${b.plazo}-${b.issued}-on_track`,
      input: {
        pqr: { issuedAt, plazoType: b.plazo, deadlineAt },
        now: `${onTrackNow.deadlineISO}T12:00:00.000Z`,
      },
      expected: { status: 'on_track', unit: meta.unit, amount: meta.amount },
    });
    idx += 1;

    // at_risk — 80% in.
    const atRiskBdays = Math.max(1, Math.floor(meta.amount * 0.8));
    const atRiskNow = referenceAddBusinessDays(b.issued, atRiskBdays, holidays);
    cases.push({
      id: `prog-${String(idx).padStart(3, '0')}`,
      label: `${b.plazo}-${b.issued}-at_risk`,
      input: {
        pqr: { issuedAt, plazoType: b.plazo, deadlineAt },
        now: `${atRiskNow.deadlineISO}T12:00:00.000Z`,
      },
      expected: { status: 'at_risk', unit: meta.unit, amount: meta.amount },
    });
    idx += 1;

    // overdue — 2 business days past the deadline.
    const overdueNow = referenceAddBusinessDays(ref.deadlineISO, 2, holidays);
    cases.push({
      id: `prog-${String(idx).padStart(3, '0')}`,
      label: `${b.plazo}-${b.issued}-overdue`,
      input: {
        pqr: { issuedAt, plazoType: b.plazo, deadlineAt },
        now: `${overdueNow.deadlineISO}T12:00:00.000Z`,
      },
      expected: { status: 'overdue', unit: meta.unit, amount: meta.amount },
    });
    idx += 1;
  }

  return cases;
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

function main(): void {
  const holidays = loadHolidays();
  const deadlineCases = generateDeadlineCases(holidays);
  const extensionCases = generateExtensionCases(holidays);
  const progressCases = generateProgressCases(holidays);

  const payload = {
    generatedAt: new Date().toISOString(),
    deadlineCases,
    extensionCases,
    progressCases,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, 'fixtures');
  const outFile = resolve(outDir, 'golden.json');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const summary = `deadlineCases=${deadlineCases.length} extensionCases=${extensionCases.length} progressCases=${progressCases.length}`;
  process.stdout.write(`${summary}\n`);
  process.stdout.write(`wrote ${outFile}\n`);
}

main();
