import type {
  BuiltQuery,
  CreateProblemGroupParams,
  FindCandidateGroupsParams,
  MatchPolicy,
  ProblemGroupStatus,
  UpdateProblemGroupAfterAttachParams,
  UpsertProblemGroupMembershipParams,
} from './types.js';
import { resolveMatchPolicy } from './policy.js';
import { toVectorLiteral, EMBEDDING_DIM } from './vector.js';
import { uniqueTagIds } from './tags.js';

const DEFAULT_CANDIDATE_LIMIT = 10;

const GROUP_COLUMNS = `
  g.id,
  g.tenant_id,
  g.canonical_title,
  g.resumen,
  g.location,
  g.status,
  g.tag_ids,
  g.member_count,
  g.hot,
  g.centroid_embedding::text AS centroid_embedding,
  g.created_at,
  g.updated_at
`.trim();

function matchPolicy(params?: Partial<MatchPolicy>): MatchPolicy {
  return resolveMatchPolicy(params);
}

export function buildFetchPqrTagsQuery(tenantId: string, pqrId: string): BuiltQuery {
  return {
    text: `
SELECT
  t.id,
  t.namespace,
  t.slug,
  t.label
FROM pqr_tags pt
JOIN pqr p ON p.id = pt.pqr_id AND p.tenant_id = $1::uuid
JOIN tags t ON t.id = pt.tag_id
WHERE pt.pqr_id = $2::uuid
ORDER BY t.namespace ASC, t.slug ASC
`.trim(),
    params: [tenantId, pqrId],
  };
}

export function buildFetchTagsByIdsQuery(tagIds: readonly string[]): BuiltQuery {
  return {
    text: `
SELECT
  id,
  namespace,
  slug,
  label
FROM tags
WHERE id = ANY($1::uuid[])
ORDER BY namespace ASC, slug ASC
`.trim(),
    params: [uniqueTagIds(tagIds)],
  };
}

export function buildFindCandidateGroupsQuery(
  params: FindCandidateGroupsParams,
): BuiltQuery {
  const policy = matchPolicy(params.matchPolicy);
  const status: ProblemGroupStatus = params.status ?? 'open';
  const limit = params.limit ?? DEFAULT_CANDIDATE_LIMIT;

  return {
    text: `
SELECT
  ${GROUP_COLUMNS},
  1 - (g.centroid_embedding <=> $2::vector(${EMBEDDING_DIM})) AS similarity_score,
  shared.shared_tag_count,
  comuna.has_matching_comuna_tag
FROM problem_groups g
CROSS JOIN LATERAL (
  SELECT COUNT(DISTINCT group_tag.tag_id)::int AS shared_tag_count
  FROM unnest(g.tag_ids) AS group_tag(tag_id)
  JOIN unnest($3::uuid[]) AS input_tag(tag_id)
    ON input_tag.tag_id = group_tag.tag_id
) shared
CROSS JOIN LATERAL (
  SELECT EXISTS (
    SELECT 1
    FROM unnest(g.tag_ids) AS group_tag(tag_id)
    JOIN unnest($4::uuid[]) AS input_comuna_tag(tag_id)
      ON input_comuna_tag.tag_id = group_tag.tag_id
  ) AS has_matching_comuna_tag
) comuna
WHERE g.tenant_id = $1::uuid
  AND g.status = $7::text
  AND g.centroid_embedding IS NOT NULL
  AND shared.shared_tag_count >= $5::int
  AND comuna.has_matching_comuna_tag = true
  AND 1 - (g.centroid_embedding <=> $2::vector(${EMBEDDING_DIM})) >= $6::float8
ORDER BY similarity_score DESC, shared.shared_tag_count DESC, g.member_count DESC, g.updated_at DESC
LIMIT $8::int
`.trim(),
    params: [
      params.tenantId,
      toVectorLiteral(params.embedding),
      uniqueTagIds(params.tagIds),
      uniqueTagIds(params.comunaTagIds),
      policy.minSharedTags,
      policy.minSimilarity,
      status,
      limit,
    ],
  };
}

export function buildCreateProblemGroupQuery(
  params: CreateProblemGroupParams,
): BuiltQuery {
  return {
    text: `
INSERT INTO problem_groups (
  tenant_id,
  canonical_title,
  resumen,
  location,
  tag_ids,
  hot,
  centroid_embedding
)
VALUES (
  $1::uuid,
  $2::text,
  $3::text,
  $4::jsonb,
  $5::uuid[],
  $6::boolean,
  $7::vector(${EMBEDDING_DIM})
)
RETURNING
  id,
  tenant_id,
  canonical_title,
  resumen,
  location,
  status,
  tag_ids,
  member_count,
  hot,
  centroid_embedding::text AS centroid_embedding,
  created_at,
  updated_at
`.trim(),
    params: [
      params.tenantId,
      params.canonicalTitle ?? null,
      params.resumen ?? null,
      params.location ?? null,
      uniqueTagIds(params.tagIds),
      params.hot ?? false,
      toVectorLiteral(params.centroidEmbedding),
    ],
  };
}

export function buildUpdateProblemGroupAfterAttachQuery(
  params: UpdateProblemGroupAfterAttachParams,
): BuiltQuery {
  return {
    text: `
UPDATE problem_groups AS g
SET
  centroid_embedding = $3::vector(${EMBEDDING_DIM}),
  tag_ids = (
    SELECT COALESCE(array_agg(DISTINCT tag_id ORDER BY tag_id), ARRAY[]::uuid[])
    FROM unnest(g.tag_ids || $4::uuid[]) AS merged(tag_id)
  ),
  hot = $5::boolean,
  updated_at = now()
WHERE g.id = $1::uuid
  AND g.tenant_id = $2::uuid
RETURNING
  g.id,
  g.tenant_id,
  g.canonical_title,
  g.resumen,
  g.location,
  g.status,
  g.tag_ids,
  g.member_count,
  g.hot,
  g.centroid_embedding::text AS centroid_embedding,
  g.created_at,
  g.updated_at
`.trim(),
    params: [
      params.groupId,
      params.tenantId,
      toVectorLiteral(params.centroidEmbedding),
      uniqueTagIds(params.tagIds),
      params.hot,
    ],
  };
}

export function buildUpsertProblemGroupMembershipQuery(
  params: UpsertProblemGroupMembershipParams,
): BuiltQuery {
  return {
    text: `
INSERT INTO pqr_problem_group_members (
  pqr_id,
  group_id,
  similarity_score
)
VALUES (
  $1::uuid,
  $2::uuid,
  $3::numeric
)
ON CONFLICT (pqr_id) DO UPDATE
SET
  group_id = excluded.group_id,
  similarity_score = excluded.similarity_score
RETURNING pqr_id, group_id, joined_at, similarity_score
`.trim(),
    params: [params.pqrId, params.groupId, params.similarityScore],
  };
}

export function buildFetchProblemGroupQuery(
  tenantId: string,
  groupId: string,
): BuiltQuery {
  return {
    text: `
SELECT
  ${GROUP_COLUMNS}
FROM problem_groups g
WHERE g.tenant_id = $1::uuid
  AND g.id = $2::uuid
`.trim(),
    params: [tenantId, groupId],
  };
}
