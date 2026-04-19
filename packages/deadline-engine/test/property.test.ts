/**
 * Property-based tests for @omega/deadline-engine business-day math.
 *
 * Invariants we check:
 *   1. Round-trip for business-day inputs: if `d` is a business day, then
 *      `subtractBusinessDays(addBusinessDays(d, n), n) === d` for any n ≥ 0.
 *      We use `fc.pre` to filter out generated weekends/holidays/suspensions.
 *      Non-business-day inputs are outside the invariant's domain — the
 *      engine's `addBusinessDays(d, 0)` just normalizes timezone without
 *      skipping to the next business day, so a normalize-then-round-trip
 *      formulation would not hold.
 *   2. Monotonicity: addBusinessDays(d, n) is non-decreasing in n. Checked
 *      with 500 random (d, a, b) triples where 0 ≤ a, b ≤ 60.
 */

import fc from 'fast-check';
import { describe, test } from 'vitest';

import {
  addBusinessDays,
  isBusinessDay,
  loadHolidays,
  subtractBusinessDays,
} from '../src/index';

const HOLIDAYS = loadHolidays();

// Bogota-safe calendar-date arbitrary. We generate Y-M-D triples and let the
// engine normalize timezone; 2024-01-01 through 2030-12-31 covers the full
// holiday fixture.
const calendarDateArb = fc
  .tuple(
    fc.integer({ min: 2024, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => {
    const yy = String(y).padStart(4, '0');
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${yy}-${mm}-${dd}` as const;
  });

const dayCountArb = fc.integer({ min: 0, max: 60 });

describe('business-days property invariants', () => {
  test('round-trip holds for 10_000 business-day inputs', () => {
    fc.assert(
      fc.property(calendarDateArb, dayCountArb, (iso, n) => {
        // Precondition: the input must itself be a business day. Round-trip
        // is undefined for weekends/holidays (engine does not auto-normalize
        // on addBusinessDays(d, 0)).
        fc.pre(isBusinessDay(iso, HOLIDAYS));
        const forward = addBusinessDays(iso, n, HOLIDAYS);
        const back = subtractBusinessDays(forward, n, HOLIDAYS);
        // Compare on Bogota calendar date via ISO strings — the canonical
        // business-day identity.
        return back.toISOString() === addBusinessDays(iso, 0, HOLIDAYS).toISOString();
      }),
      { numRuns: 10_000 },
    );
  });

  test('addBusinessDays is monotonic non-decreasing in n (500 runs)', () => {
    fc.assert(
      fc.property(
        calendarDateArb,
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 60 }),
        (iso, a, b) => {
          fc.pre(isBusinessDay(iso, HOLIDAYS));
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          const da = addBusinessDays(iso, lo, HOLIDAYS);
          const db = addBusinessDays(iso, hi, HOLIDAYS);
          return da.getTime() <= db.getTime();
        },
      ),
      { numRuns: 500 },
    );
  });

  test('subtractBusinessDays by 0 is identity for business-day inputs', () => {
    fc.assert(
      fc.property(calendarDateArb, (iso) => {
        fc.pre(isBusinessDay(iso, HOLIDAYS));
        const normalized = addBusinessDays(iso, 0, HOLIDAYS);
        const same = subtractBusinessDays(normalized, 0, HOLIDAYS);
        return same.getTime() === normalized.getTime();
      }),
      { numRuns: 500 },
    );
  });
});
