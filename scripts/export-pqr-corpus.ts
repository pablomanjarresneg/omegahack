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
import { redactText } from "@omega/habeas-data";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "fixtures", "pqr-corpus");

interface PqrRow {
  id: string;
  radicado: string | null;
  tipo: string | null;
  hechos: string | null;
  peticion: string | null;
  lead: string | null;
  secretaria_id: string | null;
  comuna_id: string | null;
  issued_at: string;
}

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

/**
 * Render a single PQR as markdown with YAML-ish frontmatter. We keep
 * frontmatter keys terse and ASCII so nella's indexer happily picks them up
 * as metadata fields.
 */
function renderPqrMarkdown(row: PqrRow): string {
  const { llmText: hechosSafe } = redactText(row.hechos ?? "");
  const { llmText: peticionSafe } = redactText(row.peticion ?? "");
  const { llmText: leadSafe } = redactText(row.lead ?? "");

  const frontmatter = [
    "---",
    `id: ${row.id}`,
    `radicado: ${row.radicado ?? ""}`,
    `tipo: ${row.tipo ?? ""}`,
    `dependencia: ${row.secretaria_id ?? ""}`,
    `comuna: ${row.comuna_id ?? ""}`,
    `fecha: ${row.issued_at.slice(0, 10)}`,
    "---",
    "",
  ].join("\n");

  const body = [
    leadSafe ? `# ${leadSafe.slice(0, 120)}\n` : "",
    hechosSafe ? `## Hechos\n\n${hechosSafe}\n` : "",
    peticionSafe ? `## Petición\n\n${peticionSafe}\n` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return frontmatter + body;
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
    .select("id, radicado, tipo, hechos, peticion, lead, secretaria_id, comuna_id, issued_at")
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`pqr select: ${error.message}`);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const rows = (data ?? []) as PqrRow[];
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
