import type { Pool, PoolClient } from 'pg';
import type {
  AttachOrCreateProblemGroupParams,
  AttachOrCreateProblemGroupResult,
  CandidateProblemGroupRow,
  PgDatabase,
  PgExecutor,
  ProblemGroupRow,
  ProblemGroupTag,
} from './types.js';
import {
  buildCreateProblemGroupQuery,
  buildFetchPqrTagsQuery,
  buildFetchProblemGroupQuery,
  buildFetchTagsByIdsQuery,
  buildFindCandidateGroupsQuery,
  buildUpdateProblemGroupAfterAttachQuery,
  buildUpsertProblemGroupMembershipQuery,
} from './sql.js';
import { evaluateMatchPolicy, isHotProblemGroup } from './policy.js';
import { comunaTagIds, uniqueTagIds } from './tags.js';
import { parseVectorLiteral, runningCentroid } from './vector.js';

export type {
  AttachOrCreateProblemGroupParams,
  AttachOrCreateProblemGroupResult,
  BuiltQuery,
  CandidateProblemGroupRow,
  CreateProblemGroupParams,
  FindCandidateGroupsParams,
  HotDetectionInput,
  HotDetectionPolicy,
  JsonValue,
  MatchEvaluation,
  MatchInput,
  MatchPolicy,
  PgDatabase,
  PgExecutor,
  ProblemGroupRow,
  ProblemGroupStatus,
  ProblemGroupTag,
  UpdateProblemGroupAfterAttachParams,
  UpsertProblemGroupMembershipParams,
} from './types.js';

export {
  DEFAULT_HOT_POLICY,
  DEFAULT_MATCH_POLICY,
  evaluateMatchPolicy,
  isHotProblemGroup,
  resolveHotDetectionPolicy,
  resolveMatchPolicy,
  shouldAttachToGroup,
} from './policy.js';

export {
  buildCreateProblemGroupQuery,
  buildFetchPqrTagsQuery,
  buildFetchProblemGroupQuery,
  buildFetchTagsByIdsQuery,
  buildFindCandidateGroupsQuery,
  buildUpdateProblemGroupAfterAttachQuery,
  buildUpsertProblemGroupMembershipQuery,
} from './sql.js';

export {
  comunaTagIds,
  countSharedTags,
  hasMatchingComunaTag,
  isComunaTag,
  matchingComunaTagIds,
  uniqueTagIds,
} from './tags.js';

export {
  EMBEDDING_DIM,
  cosineSimilarity,
  parseVectorLiteral,
  runningCentroid,
  toVectorLiteral,
} from './vector.js';

function isPool(db: PgDatabase): db is Pool {
  return typeof (db as Pool).connect === 'function';
}

async function withOptionalTransaction<Result>(
  db: PgDatabase,
  fn: (client: PgExecutor) => Promise<Result>,
): Promise<Result> {
  if (!isPool(db)) {
    return fn(db);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function queryOne<Row extends ProblemGroupRow>(
  db: PgExecutor,
  text: string,
  params: readonly unknown[],
  message: string,
): Promise<Row> {
  const result = await db.query<Row>(text, params);
  const row = result.rows[0];
  if (!row) throw new Error(message);
  return row;
}

function normalizeNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function normalizeCandidate(row: CandidateProblemGroupRow): CandidateProblemGroupRow {
  return {
    ...row,
    member_count: normalizeNumber(row.member_count),
    similarity_score: normalizeNumber(row.similarity_score),
    shared_tag_count: normalizeNumber(row.shared_tag_count),
    has_matching_comuna_tag: Boolean(row.has_matching_comuna_tag),
  };
}

async function resolveInputTags(
  db: PgExecutor,
  params: AttachOrCreateProblemGroupParams,
): Promise<{ tags: ProblemGroupTag[]; tagIds: string[] }> {
  const explicitTagIds = uniqueTagIds(params.tagIds ?? []);

  if (params.tags) {
    const tags = [...params.tags];
    return {
      tags,
      tagIds: uniqueTagIds([...explicitTagIds, ...tags.map((tag) => tag.id)]),
    };
  }

  if (explicitTagIds.length > 0) {
    const query = buildFetchTagsByIdsQuery(explicitTagIds);
    const result = await db.query<ProblemGroupTag>(query.text, query.params);
    return {
      tags: result.rows,
      tagIds: explicitTagIds,
    };
  }

  const query = buildFetchPqrTagsQuery(params.tenantId, params.pqrId);
  const result = await db.query<ProblemGroupTag>(query.text, query.params);
  return {
    tags: result.rows,
    tagIds: uniqueTagIds(result.rows.map((tag) => tag.id)),
  };
}

export async function findCandidateGroups(
  db: PgExecutor,
  params: Parameters<typeof buildFindCandidateGroupsQuery>[0],
): Promise<CandidateProblemGroupRow[]> {
  const query = buildFindCandidateGroupsQuery(params);
  const result = await db.query<CandidateProblemGroupRow>(query.text, query.params);
  return result.rows.map(normalizeCandidate);
}

export async function attachOrCreateProblemGroup(
  db: Pool | PoolClient | PgExecutor,
  params: AttachOrCreateProblemGroupParams,
): Promise<AttachOrCreateProblemGroupResult> {
  return withOptionalTransaction(db, async (client) => {
    const { tags, tagIds } = await resolveInputTags(client, params);
    const candidateComunaTagIds = comunaTagIds(tags);

    const candidates =
      tagIds.length > 0 && candidateComunaTagIds.length > 0
        ? await findCandidateGroups(client, {
            tenantId: params.tenantId,
            embedding: params.embedding,
            tagIds,
            comunaTagIds: candidateComunaTagIds,
            limit: params.candidateLimit,
            matchPolicy: params.matchPolicy,
          })
        : [];

    const match = candidates.find((candidate) => {
      return evaluateMatchPolicy(
        {
          similarity: candidate.similarity_score,
          sharedTagCount: candidate.shared_tag_count,
          hasMatchingComunaTag: candidate.has_matching_comuna_tag,
        },
        params.matchPolicy,
      ).attach;
    });

    if (match) {
      const nextCentroid = runningCentroid(
        parseVectorLiteral(match.centroid_embedding),
        match.member_count,
        params.embedding,
      );
      const hot = isHotProblemGroup(
        {
          memberCount: match.member_count + 1,
          createdAt: match.created_at,
          now: params.now,
        },
        params.hotPolicy,
      );

      const update = buildUpdateProblemGroupAfterAttachQuery({
        tenantId: params.tenantId,
        groupId: match.id,
        centroidEmbedding: nextCentroid,
        tagIds,
        hot,
      });
      await queryOne<ProblemGroupRow>(
        client,
        update.text,
        update.params,
        `problem group ${match.id} was not found for tenant ${params.tenantId}`,
      );

      const membership = buildUpsertProblemGroupMembershipQuery({
        pqrId: params.pqrId,
        groupId: match.id,
        similarityScore: match.similarity_score,
      });
      await client.query(membership.text, membership.params);

      const fetch = buildFetchProblemGroupQuery(params.tenantId, match.id);
      const group = await queryOne<ProblemGroupRow>(
        client,
        fetch.text,
        fetch.params,
        `problem group ${match.id} was not found after attach`,
      );

      return {
        action: 'attached',
        groupId: group.id,
        group,
        similarityScore: match.similarity_score,
        sharedTagCount: match.shared_tag_count,
      };
    }

    const hot = isHotProblemGroup(
      {
        memberCount: 1,
        createdAt: params.now ?? new Date(),
        now: params.now,
      },
      params.hotPolicy,
    );
    const create = buildCreateProblemGroupQuery({
      tenantId: params.tenantId,
      canonicalTitle: params.canonicalTitle,
      resumen: params.resumen,
      location: params.location,
      tagIds,
      centroidEmbedding: params.embedding,
      hot,
    });
    const created = await queryOne<ProblemGroupRow>(
      client,
      create.text,
      create.params,
      `problem group could not be created for tenant ${params.tenantId}`,
    );

    const membership = buildUpsertProblemGroupMembershipQuery({
      pqrId: params.pqrId,
      groupId: created.id,
      similarityScore: null,
    });
    await client.query(membership.text, membership.params);

    const fetch = buildFetchProblemGroupQuery(params.tenantId, created.id);
    const group = await queryOne<ProblemGroupRow>(
      client,
      fetch.text,
      fetch.params,
      `problem group ${created.id} was not found after create`,
    );

    return {
      action: 'created',
      groupId: group.id,
      group,
      similarityScore: null,
      sharedTagCount: 0,
    };
  });
}
