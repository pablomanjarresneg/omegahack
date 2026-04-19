// Retrievers against qa_bank.*. The pool passed in must already be connected
// as `app_qa_reader` (or a role that has SELECT on qa_bank.*). We do NOT
// SET ROLE in here — connection scoping is the caller's responsibility so we
// stay safe on Supavisor's transaction pooler.

import type { Pool } from 'pg';
import { EMBEDDING_DIM, embedText, toVectorLiteral } from './embedding.js';

export type CorpusKind = 'decreto' | 'ley' | 'canonical_response' | 'internal_memo';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  sourceId: string;
  sourceTitle: string;
  sourceKind: CorpusKind;
  sourceUrl: string | null;
  headingPath: string[];
  chunkText: string;
  score: number;
  /** Source of this result — for telemetry & UI badges. `'nella'` only appears when the nella-client returned it. */
  source: 'nella' | 'pgvector' | 'fts';
}

export interface SearchOptions {
  topK?: number;
  /** Restrict to documents with a tenant_id matching this value. `null` means corpus-wide only. */
  tenantId?: string | null;
  /** Restrict to one or more document kinds (e.g. `['decreto','ley']`). */
  corpusFilter?: readonly CorpusKind[];
}

const DEFAULT_TOP_K = 5;

interface Row {
  chunk_id: string;
  document_id: string;
  source_id: string;
  source_title: string;
  source_kind: CorpusKind;
  source_url: string | null;
  heading_path: string[] | null;
  text: string;
  score: number;
}

function buildFilterClauses(
  opts: SearchOptions,
  startIdx: number,
): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = startIdx;

  if (opts.tenantId !== undefined) {
    if (opts.tenantId === null) {
      clauses.push('d.tenant_id is null');
    } else {
      clauses.push(`d.tenant_id = $${idx}::uuid`);
      params.push(opts.tenantId);
      idx++;
    }
  }

  if (opts.corpusFilter && opts.corpusFilter.length > 0) {
    clauses.push(`d.kind = ANY($${idx}::text[])`);
    params.push([...opts.corpusFilter]);
    idx++;
  }

  return { clauses, params };
}

/**
 * Semantic retrieval over qa_bank via pgvector cosine distance. Embeds `query`
 * with `embed` (defaults to Azure nella-embeddings), then ranks chunks by
 * `embedding <=> $vec`. Returns up to `topK` rows, highest similarity first.
 */
export async function searchSimilar(
  pool: Pool,
  query: string,
  options: SearchOptions = {},
  embed: (text: string) => Promise<number[]> = embedText,
): Promise<RetrievedChunk[]> {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const vec = await embed(trimmed);
  const literal = toVectorLiteral(vec);

  const { clauses, params } = buildFilterClauses(options, 3);

  const sql = `
    select
      c.id           as chunk_id,
      c.document_id,
      s.id           as source_id,
      s.title        as source_title,
      s.kind         as source_kind,
      s.url          as source_url,
      c.heading_path,
      c.text,
      (1 - (e.embedding <=> $1::vector(${EMBEDDING_DIM}))) as score
    from qa_bank.qa_embeddings e
    join qa_bank.qa_chunks     c on c.id = e.chunk_id
    join qa_bank.qa_documents  d on d.id = c.document_id
    join qa_bank.qa_sources    s on s.id = d.source_id
    ${clauses.length > 0 ? `where ${clauses.join(' and ')}` : ''}
    order by e.embedding <=> $1::vector(${EMBEDDING_DIM}) asc
    limit $2::int
  `;

  const res = await pool.query<Row>(sql, [literal, topK, ...params]);
  return res.rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    sourceId: r.source_id,
    sourceTitle: r.source_title,
    sourceKind: r.source_kind,
    sourceUrl: r.source_url,
    headingPath: r.heading_path ?? [],
    chunkText: r.text,
    score: Number(r.score),
    source: 'pgvector' as const,
  }));
}

/**
 * Keyword fallback using Postgres FTS on `qa_chunks.text` (Spanish dictionary).
 * Used when pgvector is unavailable or returns nothing.
 */
export async function searchFts(
  pool: Pool,
  query: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const { clauses, params } = buildFilterClauses(options, 3);

  const sql = `
    select
      c.id           as chunk_id,
      c.document_id,
      s.id           as source_id,
      s.title        as source_title,
      s.kind         as source_kind,
      s.url          as source_url,
      c.heading_path,
      c.text,
      ts_rank_cd(to_tsvector('spanish', c.text), plainto_tsquery('spanish', $1)) as score
    from qa_bank.qa_chunks     c
    join qa_bank.qa_documents  d on d.id = c.document_id
    join qa_bank.qa_sources    s on s.id = d.source_id
    where to_tsvector('spanish', c.text) @@ plainto_tsquery('spanish', $1)
    ${clauses.length > 0 ? `and ${clauses.join(' and ')}` : ''}
    order by score desc
    limit $2::int
  `;

  const res = await pool.query<Row>(sql, [trimmed, topK, ...params]);
  return res.rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    sourceId: r.source_id,
    sourceTitle: r.source_title,
    sourceKind: r.source_kind,
    sourceUrl: r.source_url,
    headingPath: r.heading_path ?? [],
    chunkText: r.text,
    score: Number(r.score),
    source: 'fts' as const,
  }));
}
