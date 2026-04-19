import { describe, expect, test } from 'vitest';
import {
  addBusinessDays,
  applyEmiliani,
  computeDeadline,
  computeEasterSunday,
  computeProgress,
  DeadlineEngineError,
  extend,
  isBusinessDay,
  isHoliday,
  isSuspended,
  loadHolidays,
  PLAZOS,
  resolvePlazo,
  subtractBusinessDays,
  validateSuspensions,
} from '../src/index';
import { fromBogotaISODate, toBogotaISODate } from '../src/business-days';

const H = loadHolidays();

describe('holidays.ts', () => {
  test('computeEasterSunday matches known Easter dates', () => {
    expect(computeEasterSunday(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
    expect(computeEasterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
    expect(computeEasterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(computeEasterSunday(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
  });

  test('applyEmiliani is a no-op on Monday', () => {
    const monday = new Date(Date.UTC(2026, 3, 20));
    expect(applyEmiliani(monday).toISOString().slice(0, 10)).toBe('2026-04-20');
  });

  test('applyEmiliani shifts Sunday to next Monday', () => {
    const sunday = new Date(Date.UTC(2026, 3, 19));
    expect(applyEmiliani(sunday).toISOString().slice(0, 10)).toBe('2026-04-20');
  });

  test('applyEmiliani shifts Tuesday to next Monday', () => {
    const tuesday = new Date(Date.UTC(2026, 3, 21));
    expect(applyEmiliani(tuesday).toISOString().slice(0, 10)).toBe('2026-04-27');
  });

  test('applyEmiliani shifts Friday to next Monday', () => {
    const friday = new Date(Date.UTC(2026, 3, 24));
    expect(applyEmiliani(friday).toISOString().slice(0, 10)).toBe('2026-04-27');
  });

  test('isHoliday returns false for unknown year', () => {
    expect(isHoliday('2099-01-01', H)).toBe(false);
  });

  test('isHoliday accepts ISO string and Date', () => {
    expect(isHoliday('2026-01-01', H)).toBe(true);
    expect(isHoliday(new Date('2026-01-01T12:00:00Z'), H)).toBe(true);
    expect(isHoliday('2026-01-02', H)).toBe(false);
  });

  test('isHoliday accepts non-ISO string by parsing it', () => {
    expect(isHoliday('2026-01-01T12:00:00Z', H)).toBe(true);
  });
});

describe('business-days.ts', () => {
  test('toBogotaISODate rejects garbage string via addBusinessDays', () => {
    expect(() => addBusinessDays('not-a-date', 1, H)).toThrow(DeadlineEngineError);
  });

  test('toBogotaISODate rejects blatantly invalid strings', () => {
    expect(() => addBusinessDays('completely-invalid-xyz', 1, H)).toThrow(DeadlineEngineError);
  });

  test('toBogotaISODate accepts non-ISO parseable strings', () => {
    expect(toBogotaISODate('2026-04-18T12:00:00Z')).toBe('2026-04-18');
  });

  test('fromBogotaISODate rejects non-ISO format', () => {
    try {
      fromBogotaISODate('2026/04/18');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DeadlineEngineError);
      expect((e as DeadlineEngineError).code).toBe('INVALID_ISO_DATE');
    }
  });

  test('fromBogotaISODate rejects impossible calendar date', () => {
    try {
      fromBogotaISODate('2026-13-45');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DeadlineEngineError);
      expect((e as DeadlineEngineError).code).toBe('INVALID_ISO_DATE');
    }
  });

  test('addBusinessDays with negative n delegates to subtract', () => {
    const r = addBusinessDays('2026-04-20', -3, H);
    expect(r.toISOString()).toBe('2026-04-15T05:00:00.000Z');
  });

  test('subtractBusinessDays with negative n delegates to add', () => {
    const r = subtractBusinessDays('2026-04-20', -3, H);
    expect(r.toISOString()).toBe('2026-04-23T05:00:00.000Z');
  });

  test('addBusinessDays with 0 normalizes only', () => {
    const r = addBusinessDays('2026-04-18', 0, H);
    expect(r.toISOString()).toBe('2026-04-18T05:00:00.000Z');
  });

  test('subtractBusinessDays with 0 normalizes only', () => {
    const r = subtractBusinessDays('2026-04-18', 0, H);
    expect(r.toISOString()).toBe('2026-04-18T05:00:00.000Z');
  });

  test('isBusinessDay false on Saturday, Sunday, holiday, suspension', () => {
    expect(isBusinessDay('2026-04-18', H)).toBe(false);
    expect(isBusinessDay('2026-04-19', H)).toBe(false);
    expect(isBusinessDay('2026-05-01', H)).toBe(false);
    expect(
      isBusinessDay('2026-04-20', H, [
        { from: '2026-04-20', to: '2026-04-20', reason: 'test' },
      ]),
    ).toBe(false);
  });

  test('isBusinessDay true on a normal weekday', () => {
    expect(isBusinessDay('2026-04-20', H)).toBe(true);
  });
});

describe('suspensiones.ts', () => {
  test('isSuspended with no suspensions is always false', () => {
    expect(isSuspended('2026-04-20')).toBe(false);
    expect(isSuspended('2026-04-20', [])).toBe(false);
  });

  test('isSuspended inside range is true', () => {
    expect(
      isSuspended('2026-04-20', [
        { from: '2026-04-18', to: '2026-04-22', reason: 'x' },
      ]),
    ).toBe(true);
  });

  test('isSuspended outside range is false', () => {
    expect(
      isSuspended('2026-04-23', [
        { from: '2026-04-18', to: '2026-04-22', reason: 'x' },
      ]),
    ).toBe(false);
  });

  test('validateSuspensions no-op on empty', () => {
    expect(() => validateSuspensions()).not.toThrow();
    expect(() => validateSuspensions([])).not.toThrow();
  });

  test('validateSuspensions throws when from > to', () => {
    try {
      validateSuspensions([{ from: '2026-04-22', to: '2026-04-18', reason: 'x' }]);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DeadlineEngineError);
      expect((e as DeadlineEngineError).code).toBe('INVALID_SUSPENSION_RANGE');
    }
  });
});

describe('plazos.ts', () => {
  test('PLAZOS table is frozen and complete', () => {
    expect(Object.isFrozen(PLAZOS)).toBe(true);
    expect(PLAZOS.peticion_general.amount).toBe(15);
    expect(PLAZOS.post_tutela.unit).toBe('clock_hours');
  });

  test('resolvePlazo throws on unknown type', () => {
    try {
      resolvePlazo('does_not_exist' as never);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DeadlineEngineError);
      expect((e as DeadlineEngineError).code).toBe('UNKNOWN_PLAZO_TYPE');
    }
  });

  test('resolvePlazo returns default for salud_priority without override', () => {
    expect(resolvePlazo('salud_priority').amount).toBe(5);
  });

  test('resolvePlazo applies valid salud override', () => {
    expect(resolvePlazo('salud_priority', { saludPriorityDays: 3 }).amount).toBe(3);
    expect(resolvePlazo('salud_priority', { saludPriorityDays: 8 }).amount).toBe(8);
  });

  test.each([
    [2],
    [9],
    [0],
    [-1],
    [5.5],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
  ])('resolvePlazo throws INVALID_SALUD_PRIORITY_DAYS for %s', (v) => {
    try {
      resolvePlazo('salud_priority', { saludPriorityDays: v as number });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DeadlineEngineError);
      expect((e as DeadlineEngineError).code).toBe('INVALID_SALUD_PRIORITY_DAYS');
    }
  });
});

describe('index.ts edge cases', () => {
  test('computeProgress before issuance reports 0 elapsed, on_track', () => {
    const r = computeProgress(
      {
        issuedAt: '2026-04-20T12:00:00Z',
        plazoType: 'peticion_general',
        deadlineAt: '2026-05-12T05:00:00Z',
      },
      new Date('2026-04-19T00:00:00Z'),
    );
    expect(r.elapsed).toBe(0);
    expect(r.status).toBe('on_track');
  });

  test('computeProgress overdue when now > deadline', () => {
    const r = computeProgress(
      {
        issuedAt: '2026-04-20T12:00:00Z',
        plazoType: 'peticion_general',
        deadlineAt: '2026-05-12T05:00:00Z',
      },
      new Date('2026-06-01T00:00:00Z'),
    );
    expect(r.status).toBe('overdue');
  });

  test('computeProgress at_risk near deadline', () => {
    const r = computeProgress(
      {
        issuedAt: '2026-04-20T12:00:00Z',
        plazoType: 'peticion_general',
        deadlineAt: '2026-05-12T05:00:00Z',
      },
      new Date('2026-05-08T12:00:00Z'),
    );
    expect(r.status).toBe('at_risk');
  });

  test('computeProgress clock_hours unit', () => {
    const issued = '2026-04-20T00:00:00Z';
    const deadline = '2026-04-22T00:00:00Z';
    const r = computeProgress(
      { issuedAt: issued, plazoType: 'post_tutela', deadlineAt: deadline },
      new Date('2026-04-21T16:00:00Z'),
    );
    expect(r.unit).toBe('clock_hours');
    expect(r.total).toBe(48);
    expect(Math.round(r.elapsed)).toBe(40);
    expect(r.status).toBe('at_risk');
  });

  test('computeProgress zero-total edge case never crashes', () => {
    // salud_priority can legally go to 3 min; keep a sanity check on elapsed clamp
    const r = computeProgress(
      {
        issuedAt: '2026-04-20T12:00:00Z',
        plazoType: 'salud_priority',
        deadlineAt: '2026-04-27T05:00:00Z',
        tenantConfig: { saludPriorityDays: 3 },
      },
      new Date('2026-04-20T12:00:00Z'),
    );
    expect(r.total).toBe(3);
    expect(r.percentUsed).toBeGreaterThanOrEqual(0);
  });

  test('extend throws EXTENSION_NOT_AFTER_ORIGINAL', () => {
    try {
      extend(
        {
          issuedAt: '2026-04-20T12:00:00Z',
          plazoType: 'peticion_general',
          deadlineAt: '2026-05-12T05:00:00Z',
        },
        'too short',
        '2026-05-12T05:00:00Z',
      );
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DeadlineEngineError);
      expect((e as DeadlineEngineError).code).toBe('EXTENSION_NOT_AFTER_ORIGINAL');
    }
  });

  test('extend succeeds within the 2x cap', () => {
    const r = extend(
      {
        issuedAt: '2026-04-20T12:00:00Z',
        plazoType: 'peticion_general',
        deadlineAt: '2026-05-12T05:00:00Z',
      },
      'ajuste',
      '2026-05-20T05:00:00Z',
    );
    expect(r.newDeadlineAt.toISOString()).toBe('2026-05-20T05:00:00.000Z');
    expect(r.auditEvent.type).toBe('deadline_extended');
    expect(r.auditEvent.unit).toBe('business_days');
  });

  test('extend succeeds for clock_hours (post_tutela)', () => {
    const r = extend(
      {
        issuedAt: '2026-04-20T00:00:00Z',
        plazoType: 'post_tutela',
        deadlineAt: '2026-04-22T00:00:00Z',
      },
      'imposibilidad técnica',
      '2026-04-24T00:00:00Z',
    );
    expect(r.auditEvent.unit).toBe('clock_hours');
    expect(r.auditEvent.extensionDelta).toBe(48);
  });

  test('computeDeadline accepts Date input', () => {
    const d = new Date('2026-04-20T12:00:00Z');
    const r = computeDeadline(d, 'peticion_general');
    expect(r.deadlineAt.toISOString()).toBe('2026-05-12T05:00:00.000Z');
  });

  test('computeDeadline accepts bare YYYY-MM-DD', () => {
    const r = computeDeadline('2026-04-20', 'peticion_general');
    expect(r.deadlineAt.toISOString()).toBe('2026-05-12T05:00:00.000Z');
  });

  test('DeadlineEngineError carries name and code', () => {
    const e = new DeadlineEngineError('TEST', 'msg');
    expect(e.name).toBe('DeadlineEngineError');
    expect(e.code).toBe('TEST');
    expect(e.message).toBe('msg');
  });
});
