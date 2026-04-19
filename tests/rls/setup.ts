import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
type PgPool = pg.Pool;
type PgPoolClient = pg.PoolClient;
type QueryResult<R extends pg.QueryResultRow> = pg.QueryResult<R>;

// -----------------------------------------------------------------------------
// Env loading — resolve the repo-root .env deterministically.
// -----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
loadDotenv({ path: path.join(REPO_ROOT, ".env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// -----------------------------------------------------------------------------
// Fixed tenant UUIDs used by the test suite.
// TENANT_A matches the canonical Medellín row seeded by 20260418170100_tenants.sql.
// TENANT_B is a test-only tenant we create idempotently in setupTestTenants().
// -----------------------------------------------------------------------------

export const TENANT_A = "00000000-0000-0000-0000-000000000001";
export const TENANT_B = "00000000-0000-0000-0000-0000000000b2";

// Prefix used to tag all rows this suite inserts so teardown is surgical.
export const RLS_TEST_PREFIX = "rls-test-";

// -----------------------------------------------------------------------------
// Low-level pools — session-wide knobs are UNSAFE on Supavisor port 6543
// (transaction pooler reuses backends across logical clients, so session
// `SET ROLE` and session-level GUCs leak between tenants). Everything that
// needs role or GUC scoping MUST run inside an explicit transaction using
// SET LOCAL + set_config(..., true).
// -----------------------------------------------------------------------------

const OPERATIONAL_URL = requireEnv("DATABASE_URL_OPERATIONAL");
const QA_READER_URL = requireEnv("DATABASE_URL_QA_READER");

function rawPool(connectionString: string, max = 3): PgPool {
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });
}

// -----------------------------------------------------------------------------
// Pool wrapper that scopes every query to (role, tenant) via a transaction.
// API is query(text, params) → pg.QueryResult, matching pg.Pool#query shape
// for the two-arg form used by the tests.
// -----------------------------------------------------------------------------

export interface ScopedPool {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>>;
  end(): Promise<void>;
}

function scopedPool(
  inner: PgPool,
  role: "app_operational" | "app_qa_reader",
  tenantId: string | null,
): ScopedPool {
  const claims = tenantId === null ? null : JSON.stringify({ tenant_id: tenantId });
  return {
    async query<R extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<R>> {
      const client: PgPoolClient = await inner.connect();
      try {
        await client.query("begin");
        // RESET first to clear anything Supavisor may have left on the backend
        // from a prior logical connection, then pin role + JWT claims for the
        // duration of THIS transaction only.
        await client.query("reset role");
        await client.query(`set local role ${role}`);
        if (claims !== null) {
          await client.query(
            "select set_config('request.jwt.claims', $1, true)",
            [claims],
          );
        }
        const res = await client.query<R>(text, params);
        await client.query("commit");
        return res;
      } catch (err) {
        try {
          await client.query("rollback");
        } catch {
          /* swallow secondary error */
        }
        throw err;
      } finally {
        client.release();
      }
    },
    async end() {
      await inner.end();
    },
  };
}

export function operationalPoolFor(tenantId: string): ScopedPool {
  return scopedPool(rawPool(OPERATIONAL_URL), "app_operational", tenantId);
}

export function qaReaderPool(): ScopedPool {
  // qa_reader queries don't need a tenant GUC (qa_bank is tenant-agnostic).
  return scopedPool(rawPool(QA_READER_URL), "app_qa_reader", null);
}

// -----------------------------------------------------------------------------
// Service-role pool — stays as the `postgres` pooler user (which has
// BYPASSRLS) so seed/teardown can operate across tenants.
// We still wrap every query in a transaction that RESET ROLEs first, because
// Supavisor may hand us a backend with a stale SET ROLE from a prior session.
// -----------------------------------------------------------------------------

export interface AdminPool {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>>;
  end(): Promise<void>;
}

export function serviceRoleOperationalPool(): AdminPool {
  const inner = rawPool(OPERATIONAL_URL);
  return {
    async query<R extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<R>> {
      const client = await inner.connect();
      try {
        await client.query("begin");
        await client.query("reset role");
        // postgres has BYPASSRLS, so no need to set request.jwt.claims.
        const res = await client.query<R>(text, params);
        await client.query("commit");
        return res;
      } catch (err) {
        try {
          await client.query("rollback");
        } catch {
          /* swallow */
        }
        throw err;
      } finally {
        client.release();
      }
    },
    async end() {
      await inner.end();
    },
  };
}

// -----------------------------------------------------------------------------
// Test-data lifecycle
// -----------------------------------------------------------------------------

async function ensureTenantB(admin: AdminPool): Promise<void> {
  await admin.query(
    `insert into public.tenants (id, slug, name)
     values ($1, $2, $3)
     on conflict (id) do nothing`,
    [TENANT_B, `${RLS_TEST_PREFIX}tenant-b`, "RLS Test Tenant B"],
  );
}

async function ensurePqrRows(admin: AdminPool, tenantId: string): Promise<void> {
  for (let i = 1; i <= 2; i++) {
    const sourceHash = `${RLS_TEST_PREFIX}${tenantId}-pqr-${i}`;
    await admin.query(
      `insert into public.pqr (tenant_id, channel, status, source_hash, hechos, peticion)
       values ($1, 'web', 'received', $2, $3, $4)
       on conflict (tenant_id, source_hash) where source_hash is not null
       do nothing`,
      [
        tenantId,
        sourceHash,
        `Hechos de prueba ${i} para tenant ${tenantId}`,
        `Peticion de prueba ${i}`,
      ],
    );
  }
}

async function getPqrId(
  admin: AdminPool,
  tenantId: string,
  n: number,
): Promise<string> {
  const sourceHash = `${RLS_TEST_PREFIX}${tenantId}-pqr-${n}`;
  const res = await admin.query<{ id: string }>(
    "select id from public.pqr where tenant_id = $1 and source_hash = $2",
    [tenantId, sourceHash],
  );
  const row = res.rows[0];
  if (!row) throw new Error(`Test PQR not found for ${tenantId} #${n}`);
  return row.id;
}

async function ensureCitizen(admin: AdminPool, tenantId: string): Promise<string> {
  const email = `${RLS_TEST_PREFIX}${tenantId}@example.test`;
  const existing = await admin.query<{ id: string }>(
    "select id from public.citizens where tenant_id = $1 and email = $2",
    [tenantId, email],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const inserted = await admin.query<{ id: string }>(
    `insert into public.citizens (tenant_id, email, nombre)
     values ($1, $2, $3) returning id`,
    [tenantId, email, `${RLS_TEST_PREFIX}citizen`],
  );
  return inserted.rows[0]!.id;
}

async function ensurePqrEvent(
  admin: AdminPool,
  tenantId: string,
  pqrId: string,
): Promise<void> {
  const kind = `${RLS_TEST_PREFIX}seed`;
  const existing = await admin.query<{ id: string }>(
    "select id from public.pqr_events where tenant_id = $1 and pqr_id = $2 and kind = $3",
    [tenantId, pqrId, kind],
  );
  if (existing.rows[0]) return;
  await admin.query(
    `insert into public.pqr_events (tenant_id, pqr_id, kind, payload)
     values ($1, $2, $3, '{"seed": true}'::jsonb)`,
    [tenantId, pqrId, kind],
  );
}

async function ensureResponse(
  admin: AdminPool,
  tenantId: string,
  pqrId: string,
): Promise<void> {
  const existing = await admin.query<{ id: string }>(
    `select id from public.responses
      where tenant_id = $1 and pqr_id = $2 and body like $3`,
    [tenantId, pqrId, `${RLS_TEST_PREFIX}%`],
  );
  if (existing.rows[0]) return;
  await admin.query(
    `insert into public.responses (tenant_id, pqr_id, kind, body)
     values ($1, $2, 'draft', $3)`,
    [tenantId, pqrId, `${RLS_TEST_PREFIX}response body`],
  );
}

async function ensureAttachment(
  admin: AdminPool,
  tenantId: string,
  pqrId: string,
): Promise<void> {
  const storagePath = `${RLS_TEST_PREFIX}${pqrId}`;
  const existing = await admin.query<{ id: string }>(
    `select id from public.attachments where tenant_id = $1 and storage_path = $2`,
    [tenantId, storagePath],
  );
  if (existing.rows[0]) return;
  await admin.query(
    `insert into public.attachments (tenant_id, pqr_id, storage_path, filename)
     values ($1, $2, $3, $4)`,
    [tenantId, pqrId, storagePath, `${RLS_TEST_PREFIX}file.pdf`],
  );
}

async function ensureProblemGroup(
  admin: AdminPool,
  tenantId: string,
): Promise<void> {
  const title = `${RLS_TEST_PREFIX}group`;
  const existing = await admin.query<{ id: string }>(
    "select id from public.problem_groups where tenant_id = $1 and canonical_title = $2",
    [tenantId, title],
  );
  if (existing.rows[0]) return;
  await admin.query(
    `insert into public.problem_groups (tenant_id, canonical_title, resumen)
     values ($1, $2, $3)`,
    [tenantId, title, `${RLS_TEST_PREFIX}resumen`],
  );
}

async function ensureSimpleMemory(
  admin: AdminPool,
  tenantId: string,
  citizenId: string,
): Promise<void> {
  await admin.query(
    `insert into public.simple_memory (citizen_id, tenant_id, last_10_pqrs, open_tutelas)
     values ($1, $2, '[]'::jsonb, 0)
     on conflict (citizen_id, tenant_id) do nothing`,
    [citizenId, tenantId],
  );
}

export async function setupTestTenants(): Promise<void> {
  const admin = serviceRoleOperationalPool();
  try {
    await ensureTenantB(admin);

    for (const tenantId of [TENANT_A, TENANT_B]) {
      await ensurePqrRows(admin, tenantId);
      const pqr1Id = await getPqrId(admin, tenantId, 1);
      const citizenId = await ensureCitizen(admin, tenantId);
      await ensurePqrEvent(admin, tenantId, pqr1Id);
      await ensureResponse(admin, tenantId, pqr1Id);
      await ensureAttachment(admin, tenantId, pqr1Id);
      await ensureProblemGroup(admin, tenantId);
      await ensureSimpleMemory(admin, tenantId, citizenId);
    }
  } finally {
    await admin.end();
  }
}

export async function teardownTestData(): Promise<void> {
  const admin = serviceRoleOperationalPool();
  try {
    await admin.query(
      `delete from public.simple_memory
        where tenant_id in ($1, $2)
          and citizen_id in (
            select id from public.citizens
             where tenant_id in ($1, $2)
               and email like $3 || '%'
          )`,
      [TENANT_A, TENANT_B, RLS_TEST_PREFIX],
    );
    await admin.query(
      `delete from public.problem_groups
        where tenant_id in ($1, $2) and canonical_title like $3 || '%'`,
      [TENANT_A, TENANT_B, RLS_TEST_PREFIX],
    );
    // pqr cascades to pqr_events, responses, attachments, pqr_problem_group_members
    await admin.query(
      `delete from public.pqr
        where tenant_id in ($1, $2) and source_hash like $3 || '%'`,
      [TENANT_A, TENANT_B, RLS_TEST_PREFIX],
    );
    await admin.query(
      `delete from public.citizens
        where tenant_id in ($1, $2) and email like $3 || '%'`,
      [TENANT_A, TENANT_B, RLS_TEST_PREFIX],
    );
    // Finally the test tenant itself (TENANT_A is canonical — never delete).
    await admin.query("delete from public.tenants where id = $1", [TENANT_B]);
  } finally {
    await admin.end();
  }
}
