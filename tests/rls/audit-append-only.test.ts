import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  RLS_TEST_PREFIX,
  TENANT_A,
  type ScopedPool,
  operationalPoolFor,
  serviceRoleOperationalPool,
  setupTestTenants,
  teardownTestData,
} from "./setup.js";

let tenantAPool: ScopedPool;

beforeAll(async () => {
  await setupTestTenants();
  tenantAPool = operationalPoolFor(TENANT_A);
});

afterAll(async () => {
  await tenantAPool.end();
  await teardownTestData();
});

describe("pqr_audit is append-only", () => {
  it("inserting a PQR produces a pqr_audit INSERT row for that tenant", async () => {
    // Insert a fresh PQR directly under TENANT_A (so RLS happily allows it).
    const sourceHash = `${RLS_TEST_PREFIX}audit-probe-${Date.now()}`;
    const inserted = await tenantAPool.query<{ id: string }>(
      `insert into public.pqr (tenant_id, channel, status, source_hash, hechos)
       values ($1, 'web', 'received', $2, 'audit probe')
       returning id`,
      [TENANT_A, sourceHash],
    );
    const pqrId = inserted.rows[0]!.id;

    const audit = await tenantAPool.query<{ operation: string; row_id: string }>(
      `select operation, row_id from public.pqr_audit
        where table_name = 'pqr' and row_id = $1`,
      [pqrId],
    );
    expect(audit.rowCount).toBeGreaterThan(0);
    expect(audit.rows[0]?.operation).toBe("INSERT");
  });

  it("UPDATE on pqr_audit is silently rewritten to nothing (rows unchanged)", async () => {
    // Grab one real audit row to target.
    const target = await tenantAPool.query<{ id: string; operation: string }>(
      `select id, operation from public.pqr_audit
        where tenant_id = $1 limit 1`,
      [TENANT_A],
    );
    expect(target.rowCount).toBe(1);
    const auditId = target.rows[0]!.id;
    const originalOp = target.rows[0]!.operation;

    // The RULE is `on update to pqr_audit do instead nothing`, which means
    // the statement succeeds with 0 rows affected and the row stays as-is.
    const res = await tenantAPool.query(
      "update public.pqr_audit set operation = 'TAMPERED' where id = $1",
      [auditId],
    );
    // Rewrite rules that produce no command return 0 affected rows.
    expect(res.rowCount).toBe(0);

    // Verify via a service-role pool so RLS can't mask the result.
    const admin = serviceRoleOperationalPool();
    try {
      const check = await admin.query<{ operation: string }>(
        "select operation from public.pqr_audit where id = $1",
        [auditId],
      );
      expect(check.rows[0]?.operation).toBe(originalOp);
    } finally {
      await admin.end();
    }
  });

  it("DELETE on pqr_audit is silently rewritten to nothing (count unchanged)", async () => {
    const admin = serviceRoleOperationalPool();
    try {
      const before = await admin.query<{ c: string }>(
        "select count(*)::text as c from public.pqr_audit where tenant_id = $1",
        [TENANT_A],
      );
      const beforeCount = Number(before.rows[0]!.c);

      const res = await tenantAPool.query(
        "delete from public.pqr_audit where tenant_id = $1",
        [TENANT_A],
      );
      expect(res.rowCount).toBe(0);

      const after = await admin.query<{ c: string }>(
        "select count(*)::text as c from public.pqr_audit where tenant_id = $1",
        [TENANT_A],
      );
      const afterCount = Number(after.rows[0]!.c);
      expect(afterCount).toBe(beforeCount);
    } finally {
      await admin.end();
    }
  });
});
