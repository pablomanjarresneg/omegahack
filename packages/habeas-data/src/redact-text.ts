import type { FieldName, RedactionLogEntry, RedactTextResult } from './types';

interface Pattern {
  fieldName: FieldName;
  regex: RegExp;
  replacement: string;
}

/**
 * Order matters: longer / more-specific patterns run first so they claim bytes
 * before looser fall-back patterns (e.g. email before any digit run, dirección
 * before placa, NIT before cédula). Each regex has the `g` flag.
 *
 * Philosophy: we prefer over-redaction to leaks. When in doubt, redact.
 */
const PATTERNS: readonly Pattern[] = [
  {
    fieldName: 'email',
    regex: /\b[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },
  {
    fieldName: 'direccion',
    // Colombian address style: "Cra 45B # 12-34", "Calle 10 #5-67", "Av. 68 #20-45".
    regex:
      /\b(?:cra|carrera|calle|cl|dg|diagonal|tv|transversal|av|avenida)\.?\s*\d+[A-Za-z]?\s*#\s*\d+[A-Za-z]?(?:\s*-\s*\d+[A-Za-z]?)?/gi,
    replacement: '[DIR]',
  },
  {
    fieldName: 'nit',
    regex: /\bNIT\.?\s*\d{9,10}-?\d?\b/gi,
    replacement: '[NIT]',
  },
  {
    fieldName: 'telefono',
    // Colombian mobile: starts with 3, 10 digits total. Runs BEFORE cédula so
    // a 10-digit mobile is not misclassified as a cédula.
    regex: /\b3\d{9}\b/g,
    replacement: '[TEL]',
  },
  {
    fieldName: 'telefono',
    // Fixed line with dashes/spaces: 3-3-4 pattern.
    regex: /\b\d{3}[\s-]\d{3}[\s-]\d{4}\b/g,
    replacement: '[TEL]',
  },
  {
    fieldName: 'cedula',
    // Either the "CC 12345678" form OR a bare 7–10 digit run that is NOT part
    // of a longer digit run and not preceded by a dot/dash (to avoid dates
    // like 2026-04-18 and mid-decimal digits).
    regex: /\bC\.?C\.?\s*\d{6,10}\b|(?<![\d.\-])\b\d{7,10}\b(?!\d)/g,
    replacement: '[CED]',
  },
  {
    fieldName: 'placa',
    // Colombian plate: 3 letters + 3 or 4 digits, optional space/dash.
    regex: /\b[A-Z]{3}\s?-?\s?\d{3,4}\b/g,
    replacement: '[PLACA]',
  },
];

/**
 * Redacts free-form text by applying every pattern in order. Returns the
 * sanitized text plus a log of every replacement (raw match + offset) so the
 * caller can persist an audit trail.
 *
 * Offsets in the log refer to positions in the ORIGINAL input string.
 */
export function redactText(text: string): RedactTextResult {
  const log: RedactionLogEntry[] = [];

  // Mask array tracks which bytes of the original string have already been
  // claimed by a previous pattern. This prevents, e.g., the cédula regex from
  // re-matching digits inside an already-redacted NIT.
  const claimed = new Array<boolean>(text.length).fill(false);

  interface Replacement {
    start: number;
    end: number;
    replacement: string;
  }
  const replacements: Replacement[] = [];

  for (const pattern of PATTERNS) {
    // Re-create the regex for each run to avoid shared lastIndex state.
    const re = new RegExp(pattern.regex.source, pattern.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      // Skip if any byte in this match was already claimed.
      let overlap = false;
      for (let i = start; i < end; i++) {
        if (claimed[i]) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;
      // Claim the bytes.
      for (let i = start; i < end; i++) {
        claimed[i] = true;
      }
      replacements.push({ start, end, replacement: pattern.replacement });
      log.push({
        fieldName: pattern.fieldName,
        match: m[0],
        replacement: pattern.replacement,
        offset: start,
      });
      // Guard against zero-length matches on pathological patterns.
      /* c8 ignore next 3 -- all current patterns consume at least one char. */
      if (m[0].length === 0) {
        re.lastIndex++;
      }
    }
  }

  // Apply the replacements left-to-right to build the output string.
  replacements.sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const r of replacements) {
    out += text.slice(cursor, r.start) + r.replacement;
    cursor = r.end;
  }
  out += text.slice(cursor);

  log.sort((a, b) => a.offset - b.offset);

  return { llmText: out, redactionLog: log };
}
