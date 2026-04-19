import { describe, expect, test } from 'vitest';
import {
  buildCreateProblemGroupQuery,
  buildFindCandidateGroupsQuery,
  buildUpdateProblemGroupAfterAttachQuery,
  buildUpsertProblemGroupMembershipQuery,
  cosineSimilarity,
  evaluateMatchPolicy,
  isHotProblemGroup,
  runningCentroid,
  toVectorLiteral,
} from '../src/index';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const PQR_ID = '10000000-0000-0000-0000-000000000001';
const GROUP_ID = '60000000-0000-0000-0000-000000000001';
const TAG_A = '20000000-0000-0000-0000-000000000001';
const TAG_B = '20000000-0000-0000-0000-000000000002';
const COMUNA_TAG = '20000000-0000-0000-0000-000000000003';

function embedding(seed: number): number[] {
  return Array.from({ length: 1024 }, (_, index) => {
    return Number(Math.sin(seed + index * 0.017).toFixed(8));
  });
}

describe('vector utilities', () => {
  test('cosineSimilarity returns 1 for equal vectors and 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  test('runningCentroid updates an existing centroid by member count', () => {
    const centroid = runningCentroid([2, 4], 3, [8, 12]);
    expect(centroid).toEqual([3.5, 6]);
  });

  test('runningCentroid seeds from the next vector when the group is empty', () => {
    expect(runningCentroid(null, 0, [3, 5])).toEqual([3, 5]);
  });

  test('toVectorLiteral validates pgvector dimensions', () => {
    const literal = toVectorLiteral(embedding(1));
    expect(literal.startsWith('[')).toBe(true);
    expect(literal.endsWith(']')).toBe(true);
    expect(literal.split(',')).toHaveLength(1024);
    expect(() => toVectorLiteral([1, 2, 3])).toThrow(/1024 dimensions/);
  });
});

describe('match policy', () => {
  test('requires similarity >= 0.80, at least two shared tags, and same comuna tag', () => {
    expect(
      evaluateMatchPolicy({
        similarity: 0.8,
        sharedTagCount: 2,
        hasMatchingComunaTag: true,
      }),
    ).toMatchObject({ attach: true, reasons: [] });
  });

  test('rejects candidates below any conservative threshold', () => {
    expect(
      evaluateMatchPolicy({
        similarity: 0.799,
        sharedTagCount: 2,
        hasMatchingComunaTag: true,
      }).reasons,
    ).toContain('similarity_below_threshold');

    expect(
      evaluateMatchPolicy({
        similarity: 0.91,
        sharedTagCount: 1,
        hasMatchingComunaTag: true,
      }).reasons,
    ).toContain('shared_tags_below_threshold');

    expect(
      evaluateMatchPolicy({
        similarity: 0.91,
        sharedTagCount: 2,
        hasMatchingComunaTag: false,
      }).reasons,
    ).toContain('missing_matching_comuna_tag');
  });
});

describe('hot detector', () => {
  test('marks groups hot when enough members accumulate inside the window', () => {
    expect(
      isHotProblemGroup({
        memberCount: 5,
        createdAt: '2026-04-14T12:00:00.000Z',
        now: '2026-04-19T12:00:00.000Z',
      }),
    ).toBe(true);
  });

  test('does not mark cold groups with too few members or old creation dates', () => {
    expect(
      isHotProblemGroup({
        memberCount: 4,
        createdAt: '2026-04-19T12:00:00.000Z',
        now: '2026-04-19T12:00:00.000Z',
      }),
    ).toBe(false);

    expect(
      isHotProblemGroup({
        memberCount: 8,
        createdAt: '2026-04-01T12:00:00.000Z',
        now: '2026-04-19T12:00:00.000Z',
      }),
    ).toBe(false);
  });
});

describe('SQL builders', () => {
  test('find candidate query uses placeholders for vector, tags, policy, status, and limit', () => {
    const maliciousTenant = `${TENANT_ID}' OR true --`;
    const q = buildFindCandidateGroupsQuery({
      tenantId: maliciousTenant,
      embedding: embedding(2),
      tagIds: [TAG_A, TAG_B, COMUNA_TAG],
      comunaTagIds: [COMUNA_TAG],
      limit: 7,
    });

    expect(q.text).toContain('g.tenant_id = $1::uuid');
    expect(q.text).toContain('g.centroid_embedding <=> $2::vector(1024)');
    expect(q.text).toContain('unnest($3::uuid[])');
    expect(q.text).toContain('unnest($4::uuid[])');
    expect(q.text).toContain('shared.shared_tag_count >= $5::int');
    expect(q.text).toContain('>= $6::float8');
    expect(q.text).toContain('g.status = $7::text');
    expect(q.text).toContain('LIMIT $8::int');
    expect(q.text).not.toContain(maliciousTenant);
    expect(q.params).toEqual([
      maliciousTenant,
      expect.stringMatching(/^\[/),
      [TAG_A, TAG_B, COMUNA_TAG],
      [COMUNA_TAG],
      2,
      0.8,
      'open',
      7,
    ]);
  });

  test('create, update, and membership queries keep values parameterized', () => {
    const create = buildCreateProblemGroupQuery({
      tenantId: TENANT_ID,
      canonicalTitle: "x'); drop table problem_groups; --",
      resumen: 'resumen',
      location: { comuna: 11 },
      tagIds: [TAG_A, TAG_A, COMUNA_TAG],
      centroidEmbedding: embedding(3),
    });

    expect(create.text).toContain('$2::text');
    expect(create.text).toContain('$4::jsonb');
    expect(create.text).not.toContain('drop table');
    expect(create.params[1]).toBe("x'); drop table problem_groups; --");
    expect(create.params[4]).toEqual([TAG_A, COMUNA_TAG]);

    const update = buildUpdateProblemGroupAfterAttachQuery({
      tenantId: TENANT_ID,
      groupId: GROUP_ID,
      centroidEmbedding: embedding(4),
      tagIds: [TAG_B, COMUNA_TAG],
      hot: true,
    });
    expect(update.text).toContain('WHERE g.id = $1::uuid');
    expect(update.text).toContain('g.tenant_id = $2::uuid');
    expect(update.text).toContain('$3::vector(1024)');
    expect(update.text).toContain('$4::uuid[]');
    expect(update.text).toContain('$5::boolean');
    expect(update.params).toEqual([
      GROUP_ID,
      TENANT_ID,
      expect.stringMatching(/^\[/),
      [TAG_B, COMUNA_TAG],
      true,
    ]);

    const membership = buildUpsertProblemGroupMembershipQuery({
      pqrId: PQR_ID,
      groupId: GROUP_ID,
      similarityScore: 0.87,
    });
    expect(membership.text).toContain('$1::uuid');
    expect(membership.text).toContain('$2::uuid');
    expect(membership.text).toContain('$3::numeric');
    expect(membership.params).toEqual([PQR_ID, GROUP_ID, 0.87]);
  });
});
