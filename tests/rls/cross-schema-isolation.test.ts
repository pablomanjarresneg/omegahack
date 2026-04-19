import { afterAll, describe, expect, it } from "vitest";
import {
  TENANT_A,
  type ScopedPool,
  operationalPoolFor,
  qaReaderPool,
  serviceRoleOperationalPool,
} from "./setup.js";

let tenantAPool: ScopedPool | null = null;
let qaPool: ScopedPool | null = null;

afterAll(async () => {
  if (tenantAPool) await tenantAPool.end();
  if (qaPool) await qaPool.end();
});

describe("cross-schema role isolation", () => {
  it("app_operational has no USAGE on qa_bank (cannot read any qa_bank table)", async () => {
    tenantAPool = tenantAPool ?? operationalPoolFor(TENANT_A);
    const pool = tenantAPool;

    // Primary check: schema-level USAGE privilege. This is robust to the
    // qa_bank schema not having any user tables yet (qa_bank tables are a
    // later phase's concern).
    const priv = await pool.query<{ has: boolean }>(
      `select has_schema_privilege(current_user, 'qa_bank', 'USAGE') as has`,
    );
    expect(priv.rows[0]?.has).toBe(false);

    // Belt-and-suspenders: if any qa_bank.* table does exist, touching it
    // must raise permission denied (42501) OR undefined_table (42P01 — the
    // schema exists but the role can't see anything inside it, which is
    // functionally the same for our isolation purposes). We use the
    // service-role pool to find a candidate table name if present; the
    // operational pool cannot enumerate qa_bank either.
    const admin = serviceRoleOperationalPool();
    let sampleTable: string | null = null;
    try {
      const tables = await admin.query<{ table_name: string }>(
        `select table_name from information_schema.tables
          where table_schema = 'qa_bank' and table_type = 'BASE TABLE'
          order by table_name
          limit 1`,
      );
      sampleTable = tables.rows[0]?.table_name ?? null;
    } finally {
      await admin.end();
    }

    if (sampleTable) {
      let pgCode: string | undefined;
      let threw = false;
      try {
        await pool.query(
          `select 1 from qa_bank.${sampleTable.replace(/[^a-zA-Z0-9_]/g, "")} limit 1`,
        );
      } catch (err) {
        threw = true;
        pgCode = (err as { code?: string }).code;
      }
      expect(threw).toBe(true);
      // 42501 = insufficient_privilege; 3F000 = invalid_schema_name;
      // 42P01 = undefined_table (surfaces when USAGE is absent on schema).
      expect(["42501", "3F000", "42P01"]).toContain(pgCode);
    }
  });

  it("app_qa_reader cannot read public.pqr", async () => {
    qaPool = qaPool ?? qaReaderPool();
    const pool = qaPool;
    let threw = false;
    let pgCode: string | undefined;
    try {
      await pool.query("select 1 from public.pqr limit 1");
    } catch (err) {
      threw = true;
      pgCode = (err as { code?: string }).code;
    }
    expect(threw).toBe(true);
    // 42501 insufficient_privilege is the expected code; accept 42P01 too in
    // case the schema grant model hid the table from the catalog entirely.
    expect(["42501", "42P01"]).toContain(pgCode);
  });

  it("app_operational gets permission denied on qa_bank.qa_documents explicitly", async () => {
    tenantAPool = tenantAPool ?? operationalPoolFor(TENANT_A);
    const pool = tenantAPool;
    let threw = false;
    let pgCode: string | undefined;
    try {
      await pool.query("select 1 from qa_bank.qa_documents limit 1");
    } catch (err) {
      threw = true;
      pgCode = (err as { code?: string }).code;
    }
    expect(threw).toBe(true);
    // 42501 insufficient_privilege; 42P01 undefined_table (schema USAGE missing).
    expect(["42501", "42P01", "3F000"]).toContain(pgCode);
  });

  it("app_qa_reader can SELECT from qa_bank.qa_documents (positive invariant)", async () => {
    qaPool = qaPool ?? qaReaderPool();
    const pool = qaPool;
    // We don't care about the row count — we care that the query does not throw.
    const res = await pool.query<{ ok: number }>(
      "select 1 as ok from qa_bank.qa_documents limit 1",
    );
    expect(Array.isArray(res.rows)).toBe(true);
  });
});
