import type { Pool } from 'pg';
import type {
  KeywordRow,
  RankSource,
  SearchFilters,
  SearchMode,
  SearchResult,
  SemanticRow,
} from './types.js';

const DEFAULT_LIMIT = 20;
const EXCERPT_LEN = 280;
const EMBEDDING_DIM = 1024;
/** Reciprocal Rank Fusion smoothing constant. Classic default from Cormack. */
const RRF_K = 60;

/**
 * Serialize a JS number array into a pgvector string literal. We pass this as
 * a string parameter and let PG cast to `vector(N)` via `$n::vector(1024)` in
 * the SQL. This avoids binary-protocol concerns and matches how the ivfflat
 * ops expect input.
 *
 * Exported for tests; kept out of `index.ts`.
 */
export function toVectorLiteral(arr: readonly number[]): string {
  if (arr.length !== EMBEDDING_DIM) {
    throw new Error(
      `queryEmbedding must have exactly ${EMBEDDING_DIM} dimensions, got ${arr.length}`,
    );
  }
  // Guard against NaN / Infinity — pgvector will reject them but the error
  // surfaces far from the source. Catch here.
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`queryEmbedding[${i}] must be a finite number`);
    }
  }
  return `[${arr.join(',')}]`;
}

/**
 * Shape returned by the SQL builders. `text` and `params` map 1:1 onto
 * `pool.query(text, params)`.
 */
export interface BuiltQuery {
  text: string;
  params: unknown[];
}

interface FilterFragment {
  clauses: string[];
  params: unknown[];
  /** Joins to append after `from pqr p`, e.g. for the `pqr_tags` filter. */
  joins: string[];
  /** Whether we injected any tag-join fragments (forces DISTINCT). */
  needsDistinct: boolean;
}

/**
 * Build the shared WHERE / JOIN fragment given a starting param index. Returns
 * SQL chunks that both the keyword and semantic builders splice in. Every
 * user-provided value goes through a placeholder — there are zero string
 * interpolations of user input.
 */
function buildFilters(
  filters: SearchFilters | undefined,
  startIndex: number,
): FilterFragment {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const joins: string[] = [];
  let idx = startIndex;
  let needsDistinct = false;

  if (!filters) {
    return { clauses, params, joins, needsDistinct };
  }

  if (filters.secretariaIds && filters.secretariaIds.length > 0) {
    clauses.push(`p.secretaria_id = ANY($${idx}::uuid[])`);
    params.push([...filters.secretariaIds]);
    idx++;
  }

  if (filters.statuses && filters.statuses.length > 0) {
    clauses.push(`p.status = ANY($${idx}::pqr_status[])`);
    params.push([...filters.statuses]);
    idx++;
  }

  if (filters.priorityLevels && filters.priorityLevels.length > 0) {
    clauses.push(`p.priority_level = ANY($${idx}::priority_level[])`);
    params.push([...filters.priorityLevels]);
    idx++;
  }

  if (filters.deadlineFrom) {
    clauses.push(`p.legal_deadline >= $${idx}::timestamptz`);
    params.push(filters.deadlineFrom);
    idx++;
  }

  if (filters.deadlineUntil) {
    clauses.push(`p.legal_deadline <= $${idx}::timestamptz`);
    params.push(filters.deadlineUntil);
    idx++;
  }

  if (filters.tagSlugs && filters.tagSlugs.length > 0) {
    // Require *all* tag slugs to match (conjunctive). We join pqr_tags once
    // and filter with a HAVING-style subquery for correctness.
    needsDistinct = true;
    const slugParamIdx = idx;
    const countParamIdx = idx + 1;
    clauses.push(
      `p.id IN (
        SELECT pt.pqr_id
        FROM pqr_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE t.slug = ANY($${slugParamIdx}::text[])
        GROUP BY pt.pqr_id
        HAVING COUNT(DISTINCT t.slug) = $${countParamIdx}::int
      )`,
    );
    params.push([...filters.tagSlugs]);
    params.push(filters.tagSlugs.length);
    idx += 2;
  }

  return { clauses, params, joins, needsDistinct };
}

/** Shared projection for the candidate queries. */
function projection(scoreExpr: string, scoreAlias: string): string {
  return `
    p.id,
    p.radicado,
    p.tipo,
    CASE WHEN p.hechos IS NULL THEN NULL ELSE LEFT(p.hechos, ${EXCERPT_LEN}) END AS hechos_excerpt,
    CASE WHEN p.peticion IS NULL THEN NULL ELSE LEFT(p.peticion, ${EXCERPT_LEN}) END AS peticion_excerpt,
    ${scoreExpr} AS ${scoreAlias}
  `.trim();
}

/**
 * Build the keyword search query. Parameter layout:
 *   $1 = tenantId (uuid)
 *   $2 = query (text, plainto_tsquery)
 *   $3 = limit (int)
 *   $4..N = filter params in the order produced by buildFilters
 */
export function buildKeywordQuery(
  tenantId: string,
  query: string,
  limit: number,
  filters?: SearchFilters,
): BuiltQuery {
  const filter = buildFilters(filters, 4);
  const whereParts: string[] = [
    `p.tenant_id = $1::uuid`,
    `p.search_vector @@ plainto_tsquery('spanish', $2)`,
    ...filter.clauses,
  ];
  const selectPrefix = filter.needsDistinct ? 'SELECT DISTINCT' : 'SELECT';

  const text = `
${selectPrefix}
  ${projection(`ts_rank(p.search_vector, plainto_tsquery('spanish', $2))`, 'score')}
FROM pqr p
WHERE ${whereParts.join('\n  AND ')}
ORDER BY score DESC, p.created_at DESC
LIMIT $3::int
`.trim();

  const params: unknown[] = [tenantId, query, limit, ...filter.params];
  return { text, params };
}

/**
 * Build the semantic search query. Parameter layout:
 *   $1 = tenantId (uuid)
 *   $2 = vector literal string (cast to ::vector(1024))
 *   $3 = limit (int)
 *   $4..N = filter params in the order produced by buildFilters
 */
export function buildSemanticQuery(
  tenantId: string,
  limit: number,
  filters?: SearchFilters,
): BuiltQuery {
  const filter = buildFilters(filters, 4);
  const whereParts: string[] = [
    `p.tenant_id = $1::uuid`,
    `e.kind = 'full'::pqr_embedding_kind`,
    ...filter.clauses,
  ];
  const selectPrefix = filter.needsDistinct ? 'SELECT DISTINCT' : 'SELECT';

  const text = `
${selectPrefix}
  ${projection(`e.embedding <=> $2::vector(${EMBEDDING_DIM})`, 'distance')}
FROM pqr p
JOIN pqr_embeddings e ON e.pqr_id = p.id AND e.tenant_id = p.tenant_id
WHERE ${whereParts.join('\n  AND ')}
ORDER BY distance ASC
LIMIT $3::int
`.trim();

  // Placeholder for the vector literal — caller fills it in.
  const params: unknown[] = [tenantId, null, limit, ...filter.params];
  return { text, params };
}

/**
 * Reciprocal Rank Fusion merge. Given the two ordered candidate lists, each
 * row's contribution is `1 / (k + rank)` where rank is 1-indexed. If a row
 * appears in both lists, its score is summed. Ties broken by keyword rank
 * first (stable, since BM25-ish relevance tends to be sharper at the top than
 * cosine similarity on a narrow corpus).
 *
 * Exported for unit tests.
 */
export function rrfMerge(
  keyword: readonly KeywordRow[],
  semantic: readonly SemanticRow[],
  limit: number,
  k: number = RRF_K,
): SearchResult[] {
  const byId = new Map<
    string,
    {
      row: KeywordRow | SemanticRow;
      score: number;
      inKeyword: boolean;
      inSemantic: boolean;
      keywordRank: number;
    }
  >();

  keyword.forEach((row, i) => {
    const rank = i + 1;
    byId.set(row.id, {
      row,
      score: 1 / (k + rank),
      inKeyword: true,
      inSemantic: false,
      keywordRank: rank,
    });
  });

  semantic.forEach((row, i) => {
    const rank = i + 1;
    const existing = byId.get(row.id);
    if (existing) {
      existing.score += 1 / (k + rank);
      existing.inSemantic = true;
    } else {
      byId.set(row.id, {
        row,
        score: 1 / (k + rank),
        inKeyword: false,
        inSemantic: true,
        keywordRank: Number.POSITIVE_INFINITY,
      });
    }
  });

  const fused = Array.from(byId.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.keywordRank - b.keywordRank;
    })
    .slice(0, limit);

  return fused.map(({ row, score, inKeyword, inSemantic }) => {
    const rank_source: RankSource =
      inKeyword && inSemantic ? 'both' : inKeyword ? 'keyword' : 'semantic';
    return {
      id: row.id,
      radicado: row.radicado,
      tipo: row.tipo,
      hechos_excerpt: row.hechos_excerpt,
      peticion_excerpt: row.peticion_excerpt,
      score,
      rank_source,
    };
  });
}

export interface SearchPqrsParams {
  tenantId: string;
  query: string;
  filters?: SearchFilters;
  mode: SearchMode;
  limit?: number;
  /** Required when `mode === 'semantic' || mode === 'hybrid'`. */
  queryEmbedding?: readonly number[];
}

/**
 * Search PQRs within a tenant. The provided `pool` should already be scoped
 * (via `SET ROLE`) to `app_operational` or `app_qa_reader`; this function
 * does not mutate connection state.
 */
export async function searchPqrs(
  pool: Pool,
  params: SearchPqrsParams,
): Promise<SearchResult[]> {
  const {
    tenantId,
    query,
    filters,
    mode,
    limit = DEFAULT_LIMIT,
    queryEmbedding,
  } = params;

  if (mode === 'keyword') {
    // Empty / whitespace-only query short-circuits to an empty result.
    // plainto_tsquery('') returns the empty tsquery which matches nothing
    // anyway — we skip the round trip.
    if (query.trim() === '') return [];

    const q = buildKeywordQuery(tenantId, query, limit, filters);
    const res = await pool.query<KeywordRow>(q.text, q.params);
    return res.rows.map((row) => ({
      id: row.id,
      radicado: row.radicado,
      tipo: row.tipo,
      hechos_excerpt: row.hechos_excerpt,
      peticion_excerpt: row.peticion_excerpt,
      score: Number(row.score),
      rank_source: 'keyword' as const,
    }));
  }

  if (mode === 'semantic') {
    if (!queryEmbedding) {
      throw new Error(`searchPqrs: queryEmbedding is required when mode is '${mode}'`);
    }
    const literal = toVectorLiteral(queryEmbedding);
    const q = buildSemanticQuery(tenantId, limit, filters);
    q.params[1] = literal;
    const res = await pool.query<SemanticRow>(q.text, q.params);
    return res.rows.map((row) => ({
      id: row.id,
      radicado: row.radicado,
      tipo: row.tipo,
      hechos_excerpt: row.hechos_excerpt,
      peticion_excerpt: row.peticion_excerpt,
      // Surface similarity (1 - cosine distance) so higher == better, like
      // keyword scores.
      score: 1 - Number(row.distance),
      rank_source: 'semantic' as const,
    }));
  }

  // hybrid
  if (!queryEmbedding) {
    throw new Error(`searchPqrs: queryEmbedding is required when mode is '${mode}'`);
  }
  const candidateLimit = Math.max(limit * 2, limit);

  const kwQuery =
    query.trim() === ''
      ? null
      : buildKeywordQuery(tenantId, query, candidateLimit, filters);
  const semQuery = buildSemanticQuery(tenantId, candidateLimit, filters);
  semQuery.params[1] = toVectorLiteral(queryEmbedding);

  const [kwRows, semRows] = await Promise.all([
    kwQuery === null
      ? Promise.resolve({ rows: [] as KeywordRow[] })
      : pool.query<KeywordRow>(kwQuery.text, kwQuery.params),
    pool.query<SemanticRow>(semQuery.text, semQuery.params),
  ]);

  const keywordCandidates: KeywordRow[] = kwRows.rows.map((r) => ({
    ...r,
    score: Number(r.score),
  }));
  const semanticCandidates: SemanticRow[] = semRows.rows.map((r) => ({
    ...r,
    distance: Number(r.distance),
  }));

  return rrfMerge(keywordCandidates, semanticCandidates, limit);
}
