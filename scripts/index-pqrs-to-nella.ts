#!/usr/bin/env tsx
// index-pqrs-to-nella — push PQRs directly to the nella MCP, bypassing the
// edge function. Used for the very first bulk backfill (before the edge
// function is deployed) and for debugging.
//
// Usage:
//   tsx scripts/index-pqrs-to-nella.ts                  (latest 1000, newest first)
//   tsx scripts/index-pqrs-to-nella.ts --limit 200
//   tsx scripts/index-pqrs-to-nella.ts --since 2026-04-01
//   tsx scripts/index-pqrs-to-nella.ts --bucket custom-bucket
//
// Required env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   NELLA_MCP_ENDPOINT, NELLA_MCP_TOKEN

import { createClient } from "@supabase/supabase-js";
import {
  DEFAULT_PQR_BUCKET,
  defaultNellaTransport,
  indexPqrBatch,
  type PqrRenderRow,
} from "@omega/rag";

interface Args {
  limit: number;
  since: string | null;
  bucket: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const flag = (name: string): string | null => {
    const idx = args.findIndex((a) => a === name);
    return idx >= 0 ? (args[idx + 1] ?? null) : null;
  };

  const limitRaw = flag("--limit");
  const limit = limitRaw ? Number(limitRaw) : 1000;
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer");
  }
  const since = flag("--since");
  const bucket = flag("--bucket") ?? DEFAULT_PQR_BUCKET;
  return { limit, since, bucket };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const { limit, since, bucket } = parseArgs();
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("NELLA_MCP_ENDPOINT");
  requireEnv("NELLA_MCP_TOKEN");

  const transport = defaultNellaTransport();
  if (!transport) {
    throw new Error("NELLA_MCP_ENDPOINT / NELLA_MCP_TOKEN unset even after requireEnv — unreachable");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });

  console.log(
    `[nella-indexer] bucket=${bucket} limit=${limit}${since ? ` since=${since}` : ""}`,
  );

  let q = supabase
    .from("pqr")
    .select(
      "id, radicado, tipo, status, hechos, peticion, lead, secretaria_id, comuna_id, priority_level, priority_score, issued_at",
    )
    .in("status", [
      "accepted",
      "assigned",
      "in_draft",
      "in_review",
      "approved",
      "sent",
      "closed",
    ])
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (since) {
    q = q.gte("updated_at", since);
  }

  const { data, error } = await q;
  if (error) throw new Error(`pqr select: ${error.message}`);

  const rows = (data ?? []) as PqrRenderRow[];
  console.log(`[nella-indexer] fetched ${rows.length} PQR(s); sending to nella…`);

  const startedAt = Date.now();
  const result = await indexPqrBatch(rows, { transport, bucket });
  const durationMs = Date.now() - startedAt;

  console.log(
    `[nella-indexer] bucket=${bucket} indexed=${result.indexed.length} skipped=${result.skipped.length} errors=${result.errors.length} duration_ms=${durationMs}`,
  );
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`  err ${e.id}: ${e.message}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
});
