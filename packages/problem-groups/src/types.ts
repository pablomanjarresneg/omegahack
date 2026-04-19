import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface BuiltQuery {
  text: string;
  params: unknown[];
}

export interface PgExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export type PgDatabase = Pool | PoolClient | PgExecutor;

export interface ProblemGroupTag extends QueryResultRow {
  id: string;
  namespace: string;
  slug: string;
  label?: string | null;
}

export type ProblemGroupStatus = 'open' | 'merged' | 'closed';

export interface ProblemGroupRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  canonical_title: string | null;
  resumen: string | null;
  location: JsonValue | null;
  status: ProblemGroupStatus;
  tag_ids: string[];
  member_count: number;
  hot: boolean;
  centroid_embedding: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateProblemGroupRow extends ProblemGroupRow {
  similarity_score: number;
  shared_tag_count: number;
  has_matching_comuna_tag: boolean;
}

export interface MatchPolicy {
  minSimilarity: number;
  minSharedTags: number;
  requireSameComunaTag: boolean;
}

export interface MatchInput {
  similarity: number;
  sharedTagCount: number;
  hasMatchingComunaTag: boolean;
}

export interface MatchEvaluation extends MatchInput {
  attach: boolean;
  reasons: string[];
}

export interface HotDetectionPolicy {
  minMembers: number;
  windowDays: number;
}

export interface HotDetectionInput {
  memberCount: number;
  createdAt: string | Date;
  now?: string | Date;
}

export interface FindCandidateGroupsParams {
  tenantId: string;
  embedding: readonly number[];
  tagIds: readonly string[];
  comunaTagIds: readonly string[];
  limit?: number;
  status?: ProblemGroupStatus;
  matchPolicy?: Partial<MatchPolicy>;
}

export interface CreateProblemGroupParams {
  tenantId: string;
  canonicalTitle?: string | null;
  resumen?: string | null;
  location?: JsonValue | null;
  tagIds: readonly string[];
  centroidEmbedding: readonly number[];
  hot?: boolean;
}

export interface UpdateProblemGroupAfterAttachParams {
  tenantId: string;
  groupId: string;
  centroidEmbedding: readonly number[];
  tagIds: readonly string[];
  hot: boolean;
}

export interface UpsertProblemGroupMembershipParams {
  pqrId: string;
  groupId: string;
  similarityScore: number | null;
}

export interface AttachOrCreateProblemGroupParams {
  tenantId: string;
  pqrId: string;
  embedding: readonly number[];
  tags?: readonly ProblemGroupTag[];
  tagIds?: readonly string[];
  canonicalTitle?: string | null;
  resumen?: string | null;
  location?: JsonValue | null;
  candidateLimit?: number;
  matchPolicy?: Partial<MatchPolicy>;
  hotPolicy?: Partial<HotDetectionPolicy>;
  now?: string | Date;
}

export interface AttachOrCreateProblemGroupResult {
  action: 'attached' | 'created';
  groupId: string;
  group: ProblemGroupRow;
  similarityScore: number | null;
  sharedTagCount: number;
}
