/**
 * Import purity guard for @omega/deadline-engine/src.
 *
 * The runtime package must have ZERO bare-module imports. All code in
 * `src/**` must import only:
 *   - Relative paths (`./x`, `../x`) that stay inside `src/`
 *   - The Colombian holidays fixture at
 *     `../../../fixtures/colombian-holidays/holidays.json`
 *     (only allowed in `src/holidays.ts`)
 *
 * No `node:*` built-ins, no third-party packages, no workspace cross-imports.
 * If a new import is needed, add it to the allow-list here and justify it in
 * the PR.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

const SRC_DIR = resolve(HERE, '..', 'src');
const PKG_ROOT = resolve(HERE, '..');
const ALLOWED_FIXTURE = '../../../fixtures/colombian-holidays/holidays.json';
const FILES_ALLOWED_FIXTURE = new Set<string>([resolve(SRC_DIR, 'holidays.ts')]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (st.isFile() && full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

// Matches `import ... from 'x'`, `export ... from 'x'`, bare `import 'x'`,
// dynamic `import('x')`. Handles both single and double quotes.
const IMPORT_RE = /(?:\bimport\s*(?:[^'";]*?from\s*)?|\bexport\s+[^'";]*?\s+from\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g;

interface FoundImport {
  file: string;
  specifier: string;
}

function extractImports(file: string): FoundImport[] {
  const src = readFileSync(file, 'utf8');
  const found: FoundImport[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    found.push({ file, specifier: m[1]! });
  }
  return found;
}

function isRelative(spec: string): boolean {
  return spec.startsWith('./') || spec.startsWith('../');
}

describe('src/ import purity', () => {
  const files = walk(SRC_DIR);

  test('at least one source file was scanned', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const shortName = relative(PKG_ROOT, file);
    test(`${shortName} only imports from allowed targets`, () => {
      const imports = extractImports(file);
      for (const imp of imports) {
        const spec = imp.specifier;

        // Allow the single whitelisted fixture import, only from holidays.ts.
        if (spec === ALLOWED_FIXTURE) {
          expect(
            FILES_ALLOWED_FIXTURE.has(file),
            `Fixture import '${spec}' only permitted in src/holidays.ts, saw ${shortName}`,
          ).toBe(true);
          continue;
        }

        // Reject node:* built-ins — runtime has no need for them.
        if (spec.startsWith('node:')) {
          throw new Error(
            `Forbidden node:* import '${spec}' in ${shortName}. Runtime must be pure TS.`,
          );
        }

        // Reject bare-module imports (anything not starting with . or /).
        if (!isRelative(spec) && !spec.startsWith('/')) {
          throw new Error(
            `Bare-module import '${spec}' in ${shortName} is not allowed.`,
          );
        }

        // Relative imports must stay inside src/.
        if (isRelative(spec)) {
          const resolved = resolve(dirname(file), spec);
          const rel = relative(SRC_DIR, resolved);
          if (rel.startsWith('..')) {
            throw new Error(
              `Relative import '${spec}' in ${shortName} escapes src/ (resolves to ${resolved}).`,
            );
          }
          // Must also stay inside the package.
          const pkgRel = relative(PKG_ROOT, resolved);
          if (pkgRel.startsWith('..')) {
            throw new Error(
              `Relative import '${spec}' in ${shortName} escapes the package.`,
            );
          }
        }
      }
      // Test is a no-throw check; reaching here means success.
      expect(true).toBe(true);
    });
  }
});
