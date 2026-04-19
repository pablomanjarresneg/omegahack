import type { Database } from '@omega/db/types';

export type PqrStatus = Database['public']['Enums']['pqr_status'];
export type PqrTipo = Database['public']['Enums']['pqr_tipo'];
export type PriorityLevel = Database['public']['Enums']['priority_level'];

export type SearchMode = 'keyword' | 'semantic' | 'hybrid';

/**
 * Optional filters that narrow the candidate set. Every filter is ANDed with
 * the mandatory `tenant_id` predicate. Empty arrays are treated as "no filter".
 */
export interface SearchFilters {
  /** Match PQRs currently assigned to one of these secretarias. */
  secretariaIds?: readonly string[];
  /** Match PQRs currently in one of these statuses. */
  statuses?: readonly PqrStatus[];
  /** Match PQRs at one of these priority levels. */
  priorityLevels?: readonly PriorityLevel[];
  /** Lower bound (inclusive) on `legal_deadline` as an ISO 8601 timestamp. */
  deadlineFrom?: string;
  /** Upper bound (inclusive) on `legal_deadline` as an ISO 8601 timestamp. */
  deadlineUntil?: string;
  /**
   * Tag slugs that must ALL be present on the PQR (via `pqr_tags` join).
   * Matched against `tags.slug`.
   */
  tagSlugs?: readonly string[];
}

/**
 * Which retrieval path(s) surfaced this row. `'both'` means the row was in
 * the top-N of *both* keyword and semantic candidate sets during hybrid merge.
 */
export type RankSource = 'keyword' | 'semantic' | 'both';

export interface SearchResult {
  id: string;
  radicado: string | null;
  tipo: PqrTipo | null;
  /** Truncated preview of `hechos` (may be null if the column is null). */
  hechos_excerpt: string | null;
  /** Truncated preview of `peticion` (may be null if the column is null). */
  peticion_excerpt: string | null;
  /**
   * Scalar score used for ordering. For keyword, this is `ts_rank`; for
   * semantic, it is `1 - cosine_distance` (similarity); for hybrid, it is the
   * combined RRF score.
   */
  score: number;
  rank_source: RankSource;
}

/**
 * Shape of a row returned by the keyword candidate query. Internal.
 */
export interface KeywordRow {
  id: string;
  radicado: string | null;
  tipo: PqrTipo | null;
  hechos_excerpt: string | null;
  peticion_excerpt: string | null;
  score: number;
}

/**
 * Shape of a row returned by the semantic candidate query. Internal.
 * `score` is cosine *distance* (`<=>`); lower is better. We convert to
 * similarity at result boundary.
 */
export interface SemanticRow {
  id: string;
  radicado: string | null;
  tipo: PqrTipo | null;
  hechos_excerpt: string | null;
  peticion_excerpt: string | null;
  distance: number;
}
