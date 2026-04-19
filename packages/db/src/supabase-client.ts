import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool, type PoolConfig } from "pg";
import type { Database } from "./types.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function createOperationalClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function createServiceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Supabase's Supavisor pooler strips libpq's `options` param, so the app layer
// must issue `SET ROLE` on every new connection. We pin the role via a
// `connect` listener on the pool.
function makeRoleScopedPool(
  connectionString: string,
  role: "app_operational" | "app_qa_reader",
  extra: PoolConfig = {},
): Pool {
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    ssl: { rejectUnauthorized: false },
    ...extra,
  });
  pool.on("connect", (client) => {
    client.query(`SET ROLE ${role}`).catch((err) => {
      console.error(`Failed to SET ROLE ${role}:`, err);
    });
  });
  return pool;
}

let operationalPool: Pool | null = null;
let qaReaderPool: Pool | null = null;

export function getOperationalPool(): Pool {
  operationalPool ??= makeRoleScopedPool(
    requireEnv("DATABASE_URL_OPERATIONAL"),
    "app_operational",
  );
  return operationalPool;
}

export function getQaReaderPool(): Pool {
  qaReaderPool ??= makeRoleScopedPool(
    requireEnv("DATABASE_URL_QA_READER"),
    "app_qa_reader",
  );
  return qaReaderPool;
}

export function createQaReaderClient(): Pool {
  return getQaReaderPool();
}
