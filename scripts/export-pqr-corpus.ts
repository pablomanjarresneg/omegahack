#!/usr/bin/env tsx
// export-pqr-corpus — pull PQRs from Supabase, redact PII via @omega/habeas-data,
// and write one markdown file per PQR into fixtures/pqr-corpus/ for nella
// indexing. Never commit the output: fixtures/pqr-corpus/*.md is gitignored.
//
// Usage:
//   tsx scripts/export-pqr-corpus.ts            (default: latest 1000 PQRs)
//   tsx scripts/export-pqr-corpus.ts --limit 50
//
// Required env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { renderPqrMarkdown, type PqrRenderRow } from "@omega/rag";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "fixtures", "pqr-corpus");

function parseArgs(): { limit: number } {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === "--limit");
  const limit = idx >= 0 ? Number(args[idx + 1]) : 1000;
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("--limit must be a positive integer");
  }
  return { limit };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main(): Promise<void> {
  const { limit } = parseArgs();
  const url = requireEnv("SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });

  console.log(`Fetching latest ${limit} PQRs…`);
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "id, radicado, tipo, status, hechos, peticion, lead, secretaria_id, comuna_id, priority_level, priority_score, issued_at",
    )
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`pqr select: ${error.message}`);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const rows = (data ?? []) as PqrRenderRow[];
  let written = 0;
  for (const row of rows) {
    const md = renderPqrMarkdown(row);
    const outPath = path.join(OUTPUT_DIR, `${row.id}.md`);
    await writeFile(outPath, md, "utf8");
    written++;
  }
  console.log(`Wrote ${written} file(s) to ${OUTPUT_DIR}`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
});
