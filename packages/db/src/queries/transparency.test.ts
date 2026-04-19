import { describe, expect, test } from "vitest";
import {
  K_ANON_THRESHOLD,
  isSuppressed,
  suppressIfSmall,
  type MaybeSuppressed,
} from "./transparency.js";

describe("suppressIfSmall (k-anonymity)", () => {
  test("suppresses cells below the default threshold", () => {
    for (let n = 0; n < K_ANON_THRESHOLD; n += 1) {
      const out = suppressIfSmall(n, { pqrCount: n });
      expect(isSuppressed(out)).toBe(true);
      if (isSuppressed(out)) {
        expect(out.reason).toBe("k_anonymity");
      }
    }
  });

  test("passes through cells at or above the threshold", () => {
    for (let n = K_ANON_THRESHOLD; n < K_ANON_THRESHOLD + 5; n += 1) {
      const payload = { pqrCount: n, label: "comuna-X" };
      const out = suppressIfSmall(n, payload);
      expect(isSuppressed(out)).toBe(false);
      // Narrow via the type guard, then compare.
      if (!isSuppressed(out)) {
        expect(out).toEqual(payload);
      }
    }
  });

  test("respects a custom threshold", () => {
    expect(isSuppressed(suppressIfSmall(9, { a: 1 }, 10))).toBe(true);
    expect(isSuppressed(suppressIfSmall(10, { a: 1 }, 10))).toBe(false);
  });

  test("threshold of zero never suppresses", () => {
    expect(isSuppressed(suppressIfSmall(0, { a: 1 }, 0))).toBe(false);
  });

  test("isSuppressed narrows correctly on non-object values", () => {
    const scalar: MaybeSuppressed<number> = 42;
    expect(isSuppressed(scalar)).toBe(false);
    const sup: MaybeSuppressed<number> = { suppressed: true, reason: "k_anonymity" };
    expect(isSuppressed(sup)).toBe(true);
  });
});
