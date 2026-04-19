// Shared PQR → markdown + nella-doc renderer. Kept in @omega/rag so both
// `scripts/export-pqr-corpus.ts` (writes to disk) and the pqr-nella-indexer
// edge function (pushes to nella) produce byte-identical output for the same
// row — nella is sensitive to doc text churn (dedups by id + hash).

import { redactText } from '@omega/habeas-data';
import type { NellaIndexDoc } from './nella-client.js';

/**
 * Row shape expected by the renderer. Deliberately a loose subset of the
 * `public.pqr` schema so callers can pass either a Supabase row or an edge
 * function body.
 */
export interface PqrRenderRow {
  id: string;
  radicado: string | null;
  tipo: string | null;
  status?: string | null;
  hechos: string | null;
  peticion: string | null;
  lead: string | null;
  secretaria_id: string | null;
  comuna_id: string | null;
  priority_level?: string | null;
  priority_score?: number | null;
  problem_group_id?: string | null;
  tag_ids?: string[] | null;
  issued_at: string;
}

export interface PqrRenderedDoc {
  /** Markdown with YAML frontmatter — safe to write to disk. */
  markdown: string;
  /** Same payload normalised for nella's index tool. */
  nellaDoc: NellaIndexDoc;
}

function redact(value: string | null | undefined): string {
  if (!value) return '';
  const { llmText } = redactText(value);
  return llmText;
}

function buildFrontmatter(row: PqrRenderRow): string {
  return [
    '---',
    `id: ${row.id}`,
    `radicado: ${row.radicado ?? ''}`,
    `tipo: ${row.tipo ?? ''}`,
    `dependencia: ${row.secretaria_id ?? ''}`,
    `comuna: ${row.comuna_id ?? ''}`,
    `fecha: ${row.issued_at.slice(0, 10)}`,
    row.priority_level ? `prioridad: ${row.priority_level}` : '',
    row.problem_group_id ? `grupo_problema: ${row.problem_group_id}` : '',
    '---',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Render a single PQR as markdown with YAML-ish frontmatter. Keeps
 * frontmatter keys terse and ASCII so nella's indexer happily stores them
 * as metadata fields.
 */
export function renderPqrMarkdown(row: PqrRenderRow): string {
  const hechosSafe = redact(row.hechos);
  const peticionSafe = redact(row.peticion);
  const leadSafe = redact(row.lead);

  const frontmatter = buildFrontmatter(row);

  const body = [
    leadSafe ? `# ${leadSafe.slice(0, 120)}\n` : '',
    hechosSafe ? `## Hechos\n\n${hechosSafe}\n` : '',
    peticionSafe ? `## Petición\n\n${peticionSafe}\n` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return frontmatter + body;
}

/**
 * Convert a PQR row into a nella-index-ready doc. Metadata keeps the
 * fields the dashboard needs to deep-link back: `problem_group_id`,
 * `priority_level`, `priority_score`, `tipo`, `secretaria_id`, `comuna_id`,
 * `issued_at`.
 */
export function renderPqrAsNellaDoc(row: PqrRenderRow): PqrRenderedDoc {
  const markdown = renderPqrMarkdown(row);
  const leadSafe = redact(row.lead).trim();
  const title = leadSafe ? leadSafe.slice(0, 120) : (row.radicado ?? row.id);

  const metadata: Record<string, unknown> = {
    radicado: row.radicado,
    tipo: row.tipo,
    status: row.status ?? null,
    priority_level: row.priority_level ?? null,
    priority_score: row.priority_score ?? null,
    secretaria_id: row.secretaria_id,
    comuna_id: row.comuna_id,
    problem_group_id: row.problem_group_id ?? null,
    tag_ids: row.tag_ids ?? [],
    issued_at: row.issued_at,
  };

  return {
    markdown,
    nellaDoc: {
      id: row.id,
      text: markdown,
      title,
      metadata,
    },
  };
}
