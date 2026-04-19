#!/usr/bin/env tsx
// verify-nella-index — scan fixtures/pqr-corpus/*.md for PII. Exits non-zero
// (and prints the offending file + line) if anything slips past the habeas
// redactor. Meant to run BEFORE `nella index` so we never ship a corpus with
// a cédula, email, or phone number in it.
//
// Rules: any of the following in a file body (not frontmatter):
//   - email-shaped strings that the habeas redactor didn't mask (we rerun
//     the same regexes here as a second line of defense)
//   - 7+ digit runs (bare cédula)
//   - Colombian mobile (starts with 3, 10 digits)
//   - fixed-line 3-3-4 digit pattern
//
// Invocation:
//   tsx scripts/verify-nella-index.ts
//   # exits 0 on clean corpus, 1 with a report otherwise.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const TARGET_DIR = path.join(REPO_ROOT, "fixtures", "pqr-corpus");

interface Rule {
  name: string;
  regex: RegExp;
}

// These MUST stay in sync with packages/habeas-data/src/redact-text.ts. Any
// hit here means either a new pattern slipped the redactor or the exporter
// skipped redaction for a field.
const RULES: Rule[] = [
  { name: "email", regex: /\b[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { name: "cedula/numero", regex: /\bC\.?C\.?\s*\d{6,10}\b/i },
  { name: "cedula-bare", regex: /(?<![\d.\-])\b\d{7,10}\b(?!\d)/ },
  { name: "telefono-movil", regex: /\b3\d{9}\b/ },
  { name: "telefono-fijo", regex: /\b\d{3}[\s-]\d{3}[\s-]\d{4}\b/ },
];

interface Violation {
  file: string;
  line: number;
  rule: string;
  match: string;
}

function stripFrontmatter(text: string): string {
  // A YAML-ish frontmatter block bounded by `---` on its own line. If the
  // document starts with one, drop everything up to and including the second
  // fence. Frontmatter contains non-sensitive ids by construction.
  const fenceRe = /^---\s*$/m;
  if (!text.startsWith("---")) return text;
  const rest = text.slice(3);
  const m = fenceRe.exec(rest);
  if (!m) return text;
  return rest.slice(m.index + m[0].length);
}

async function scanFile(filePath: string): Promise<Violation[]> {
  const raw = await readFile(filePath, "utf8");
  const body = stripFrontmatter(raw);
  const lines = body.split("\n");
  const out: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const rule of RULES) {
      const m = rule.regex.exec(line);
      if (m) {
        out.push({
          file: path.relative(REPO_ROOT, filePath),
          line: i + 1,
          rule: rule.name,
          match: m[0],
        });
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(TARGET_DIR);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      console.log(`No ${TARGET_DIR} directory — nothing to verify.`);
      return;
    }
    throw err;
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) {
    console.log("No .md files in fixtures/pqr-corpus — nothing to verify.");
    return;
  }

  const violations: Violation[] = [];
  for (const f of mdFiles) {
    const hits = await scanFile(path.join(TARGET_DIR, f));
    violations.push(...hits);
  }

  if (violations.length === 0) {
    console.log(`Scanned ${mdFiles.length} file(s). No PII detected.`);
    return;
  }

  console.error(`FAIL: ${violations.length} PII hit(s) across ${mdFiles.length} file(s):`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.match}`);
  }
  process.exit(1);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
});
