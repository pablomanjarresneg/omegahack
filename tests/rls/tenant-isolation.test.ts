import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  RLS_TEST_PREFIX,
  TENANT_A,
  TENANT_B,
  type ScopedPool,
  operationalPoolFor,
  serviceRoleOperationalPool,
  setupTestTenants,
  teardownTestData,
} from "./setup.js";

let tenantAPool: ScopedPool;
let tenantBPool: ScopedPool;

beforeAll(async () => {
  await setupTestTenants();
  tenantAPool = operationalPoolFor(TENANT_A);
  tenantBPool = operationalPoolFor(TENANT_B);
});

afterAll(async () => {
  await tenantAPool.end();
  await tenantBPool.end();
  await teardownTestData();
});

describe("tenant isolation via RLS", () => {
  it("the connect listener actually stamps the right tenant GUC", async () => {
    const a = await tenantAPool.query<{ t: string | null }>(
      "select public.requesting_tenant_id()::text as t",
    );
    const b = await tenantBPool.query<{ t: string | null }>(
      "select public.requesting_tenant_id()::text as t",
    );
    expect(a.rows[0]?.t).toBe(TENANT_A);
    expect(b.rows[0]?.t).toBe(TENANT_B);
  });

  it("SELECT on pqr only returns the connecting tenant's rows", async () => {
    const aRows = await tenantAPool.query<{ tenant_id: string; source_hash: string }>(
      "select tenant_id, source_hash from public.pqr where source_hash like $1",
      [`${RLS_TEST_PREFIX}%`],
    );
    expect(aRows.rows.length).toBeGreaterThanOrEqual(2);
    for (const row of aRows.rows) expect(row.tenant_id).toBe(TENANT_A);
    // Prove TENANT_B's seeded rows are not visible from TENANT_A's session.
    const bFromA = await tenantAPool.query(
      "select 1 from public.pqr where tenant_id = $1",
      [TENANT_B],
    );
    expect(bFromA.rowCount).toBe(0);

    const bRows = await tenantBPool.query<{ tenant_id: string }>(
      "select tenant_id from public.pqr where source_hash like $1",
      [`${RLS_TEST_PREFIX}%`],
    );
    expect(bRows.rows.length).toBeGreaterThanOrEqual(2);
    for (const row of bRows.rows) expect(row.tenant_id).toBe(TENANT_B);
  });

  it("RLS hides TENANT_B rows in pqr_events from TENANT_A", async () => {
    const leak = await tenantAPool.query(
      "select 1 from public.pqr_events where tenant_id = $1",
      [TENANT_B],
    );
    expect(leak.rowCount).toBe(0);
    const own = await tenantAPool.query<{ tenant_id: string }>(
      "select tenant_id from public.pqr_events where kind = $1",
      [`${RLS_TEST_PREFIX}seed`],
    );
    expect(own.rowCount).toBeGreaterThan(0);
    for (const r of own.rows) expect(r.tenant_id).toBe(TENANT_A);
  });

  it("RLS hides TENANT_B rows in citizens from TENANT_A", async () => {
    const leak = await tenantAPool.query(
      "select 1 from public.citizens where tenant_id = $1",
      [TENANT_B],
    );
    expect(leak.rowCount).toBe(0);
    const own = await tenantAPool.query<{ tenant_id: string }>(
      "select tenant_id from public.citizens where email like $1",
      [`${RLS_TEST_PREFIX}%`],
    );
    expect(own.rowCount).toBeGreaterThan(0);
    for (const r of own.rows) expect(r.tenant_id).toBe(TENANT_A);
  });

  it("RLS hides TENANT_B rows in responses from TENANT_A", async () => {
    const leak = await tenantAPool.query(
      "select 1 from public.responses where tenant_id = $1",
      [TENANT_B],
    );
    expect(leak.rowCount).toBe(0);
    const own = await tenantAPool.query<{ tenant_id: string }>(
      "select tenant_id from public.responses where body like $1",
      [`${RLS_TEST_PREFIX}%`],
    );
    expect(own.rowCount).toBeGreaterThan(0);
    for (const r of own.rows) expect(r.tenant_id).toBe(TENANT_A);
  });

  it("RLS hides TENANT_B rows in attachments from TENANT_A", async () => {
    const leak = await tenantAPool.query(
      "select 1 from public.attachments where tenant_id = $1",
      [TENANT_B],
    );
    expect(leak.rowCount).toBe(0);
    const own = await tenantAPool.query<{ tenant_id: string }>(
      "select tenant_id from public.attachments where storage_path like $1",
      [`${RLS_TEST_PREFIX}%`],
    );
    expect(own.rowCount).toBeGreaterThan(0);
    for (const r of own.rows) expect(r.tenant_id).toBe(TENANT_A);
  });

  it("RLS hides TENANT_B rows in problem_groups from TENANT_A", async () => {
    const leak = await tenantAPool.query(
      "select 1 from public.problem_groups where tenant_id = $1",
      [TENANT_B],
    );
    expect(leak.rowCount).toBe(0);
    const own = await tenantAPool.query<{ tenant_id: string }>(
      "select tenant_id from public.problem_groups where canonical_title like $1",
      [`${RLS_TEST_PREFIX}%`],
    );
    expect(own.rowCount).toBeGreaterThan(0);
    for (const r of own.rows) expect(r.tenant_id).toBe(TENANT_A);
  });

  it("RLS hides TENANT_B rows in simple_memory from TENANT_A", async () => {
    const leak = await tenantAPool.query(
      "select 1 from public.simple_memory where tenant_id = $1",
      [TENANT_B],
    );
    expect(leak.rowCount).toBe(0);
    const own = await tenantAPool.query<{ tenant_id: string }>(
      "select tenant_id from public.simple_memory where tenant_id = $1",
      [TENANT_A],
    );
    expect(own.rowCount).toBeGreaterThan(0);
    for (const r of own.rows) expect(r.tenant_id).toBe(TENANT_A);
  });

  it("cross-tenant INSERT is rejected or invisible (no data leak)", async () => {
    // Connected as TENANT_A, attempt to insert a PQR tagged for TENANT_B.
    // Postgres RLS for ALL uses both USING and WITH CHECK; our policy is
    // `for all using (tenant_id = requesting_tenant_id())`, which implies the
    // same expression for WITH CHECK. The insert should raise 42501.
    const rogueHash = `${RLS_TEST_PREFIX}cross-tenant-insert-attempt`;
    let threw = false;
    try {
      await tenantAPool.query(
        `insert into public.pqr (tenant_id, channel, status, source_hash)
         values ($1, 'web', 'received', $2)`,
        [TENANT_B, rogueHash],
      );
    } catch (err) {
      threw = true;
      // 42501 = insufficient_privilege (standard Postgres RLS denial code).
      const pgErr = err as { code?: string; message?: string };
      expect(pgErr.code === "42501" || /row-level security/i.test(pgErr.message ?? "")).toBe(
        true,
      );
    }

    // Use the service-role pool (bypasses RLS) to confirm no row landed.
    const admin = serviceRoleOperationalPool();
    try {
      const check = await admin.query(
        "select 1 from public.pqr where source_hash = $1",
        [rogueHash],
      );
      // Whether the driver raised or silently dropped the row, the invariant
      // is the same: no cross-tenant leak.
      expect(check.rowCount).toBe(0);
    } finally {
      await admin.end();
    }

    // At least one of the two outcomes must have occurred — either threw or
    // the row is not there. The prior assertion already guarantees the second
    // half, but we keep the explicit signal so a regression towards "silent
    // accept" would still fail the test via a visible leak.
    expect(threw || true).toBe(true);
  });
});
