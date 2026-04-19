import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  buildKeywordQuery,
  buildSemanticQuery,
  rrfMerge,
  searchPqrs,
  toVectorLiteral,
} from '../src/pqr';
import type {
  KeywordRow,
  SearchResult,
  SemanticRow,
} from '../src/types';

const TENANT = '00000000-0000-0000-0000-000000000001';

function fakeEmbedding(seed: number): number[] {
  const out = new Array<number>(1024);
  for (let i = 0; i < 1024; i++) {
    // Deterministic, bounded values.
    out[i] = Math.sin(seed + i * 0.013);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Unit tests — always run, no DB needed.
// ---------------------------------------------------------------------------

describe('toVectorLiteral', () => {
  test('serializes a 1024-dim array as a pgvector literal', () => {
    const arr = fakeEmbedding(0);
    const s = toVectorLiteral(arr);
    expect(s.startsWith('[')).toBe(true);
    expect(s.endsWith(']')).toBe(true);
    // Quick sanity: element count matches.
    expect(s.split(',').length).toBe(1024);
  });

  test('rejects the wrong dimension', () => {
    expect(() => toVectorLiteral([1, 2, 3])).toThrow(/1024 dimensions/);
  });

  test('rejects non-finite values', () => {
    const arr = fakeEmbedding(1);
    arr[42] = Number.NaN;
    expect(() => toVectorLiteral(arr)).toThrow(/finite number/);
    const arr2 = fakeEmbedding(2);
    arr2[7] = Number.POSITIVE_INFINITY;
    expect(() => toVectorLiteral(arr2)).toThrow(/finite number/);
  });
});

describe('buildKeywordQuery', () => {
  test('base query: tenant + tsquery + limit, no filters', () => {
    const q = buildKeywordQuery(TENANT, 'agua potable', 25);
    expect(q.text).toContain('FROM pqr p');
    expect(q.text).toContain("p.tenant_id = $1::uuid");
    expect(q.text).toContain("search_vector @@ plainto_tsquery('spanish', $2)");
    expect(q.text).toContain('LIMIT $3::int');
    expect(q.text).toContain("ts_rank(p.search_vector, plainto_tsquery('spanish', $2))");
    expect(q.text).not.toContain('DISTINCT');
    expect(q.params).toEqual([TENANT, 'agua potable', 25]);
  });

  test('composes secretaria, status, priority, deadline, tag filters with parameterized placeholders', () => {
    const q = buildKeywordQuery(TENANT, 'basuras', 20, {
      secretariaIds: ['s-1', 's-2'],
      statuses: ['assigned', 'in_draft'],
      priorityLevels: ['P0_critica'],
      deadlineFrom: '2026-01-01T00:00:00Z',
      deadlineUntil: '2026-12-31T23:59:59Z',
      tagSlugs: ['residuos', 'salud-publica'],
    });

    expect(q.text).toContain('p.secretaria_id = ANY($4::uuid[])');
    expect(q.text).toContain('p.status = ANY($5::pqr_status[])');
    expect(q.text).toContain('p.priority_level = ANY($6::priority_level[])');
    expect(q.text).toContain('p.legal_deadline >= $7::timestamptz');
    expect(q.text).toContain('p.legal_deadline <= $8::timestamptz');
    expect(q.text).toContain('$9::text[]');
    expect(q.text).toContain('$10::int');
    expect(q.text).toContain('SELECT DISTINCT');

    expect(q.params).toEqual([
      TENANT,
      'basuras',
      20,
      ['s-1', 's-2'],
      ['assigned', 'in_draft'],
      ['P0_critica'],
      '2026-01-01T00:00:00Z',
      '2026-12-31T23:59:59Z',
      ['residuos', 'salud-publica'],
      2,
    ]);
  });

  test('omits empty filter arrays (they produce no clauses)', () => {
    const q = buildKeywordQuery(TENANT, 'ruido', 10, {
      secretariaIds: [],
      statuses: [],
      priorityLevels: [],
      tagSlugs: [],
    });
    expect(q.text).not.toContain('ANY($4');
    expect(q.text).not.toContain('DISTINCT');
    expect(q.params).toEqual([TENANT, 'ruido', 10]);
  });

  test('snapshot of no-filter SQL is stable', () => {
    const q = buildKeywordQuery(TENANT, 'hello', 5);
    expect(q.text).toMatchInlineSnapshot(`
      "SELECT
        p.id,
          p.radicado,
          p.tipo,
          CASE WHEN p.hechos IS NULL THEN NULL ELSE LEFT(p.hechos, 280) END AS hechos_excerpt,
          CASE WHEN p.peticion IS NULL THEN NULL ELSE LEFT(p.peticion, 280) END AS peticion_excerpt,
          ts_rank(p.search_vector, plainto_tsquery('spanish', $2)) AS score
      FROM pqr p
      WHERE p.tenant_id = $1::uuid
        AND p.search_vector @@ plainto_tsquery('spanish', $2)
      ORDER BY score DESC, p.created_at DESC
      LIMIT $3::int"
    `);
  });
});

describe('buildSemanticQuery', () => {
  test('base semantic query joins pqr_embeddings on tenant_id and orders by cosine distance', () => {
    const q = buildSemanticQuery(TENANT, 15);
    expect(q.text).toContain('JOIN pqr_embeddings e ON e.pqr_id = p.id AND e.tenant_id = p.tenant_id');
    expect(q.text).toContain("e.kind = 'full'::pqr_embedding_kind");
    expect(q.text).toContain('e.embedding <=> $2::vector(1024)');
    expect(q.text).toContain('ORDER BY distance ASC');
    expect(q.text).toContain('LIMIT $3::int');
    expect(q.text).toContain("p.tenant_id = $1::uuid");
    // The second slot is reserved for the caller to fill with the vector literal.
    expect(q.params).toEqual([TENANT, null, 15]);
  });

  test('parameterizes filters beginning at $4 and includes DISTINCT when tagSlugs present', () => {
    const q = buildSemanticQuery(TENANT, 30, {
      tagSlugs: ['movilidad'],
      statuses: ['received'],
    });
    expect(q.text).toContain('p.status = ANY($4::pqr_status[])');
    expect(q.text).toContain('$5::text[]');
    expect(q.text).toContain('$6::int');
    expect(q.text).toContain('SELECT DISTINCT');
    expect(q.params).toEqual([TENANT, null, 30, ['received'], ['movilidad'], 1]);
  });
});

describe('rrfMerge', () => {
  const mkKw = (id: string, score = 0.1): KeywordRow => ({
    id,
    radicado: `R-${id}`,
    tipo: 'peticion',
    hechos_excerpt: `hechos ${id}`,
    peticion_excerpt: `peticion ${id}`,
    score,
  });
  const mkSem = (id: string, distance = 0.2): SemanticRow => ({
    id,
    radicado: `R-${id}`,
    tipo: 'queja',
    hechos_excerpt: `hechos ${id}`,
    peticion_excerpt: `peticion ${id}`,
    distance,
  });

  test('rows present in both lists rank first with summed scores and rank_source="both"', () => {
    const keyword = [mkKw('a'), mkKw('b'), mkKw('c')];
    const semantic = [mkSem('c'), mkSem('d'), mkSem('a')];
    const fused = rrfMerge(keyword, semantic, 10);

    // Rows 'a' and 'c' appear in both lists.
    const both = fused.filter((r) => r.rank_source === 'both').map((r) => r.id);
    expect(both.sort()).toEqual(['a', 'c']);

    // 'a' = 1/(60+1) + 1/(60+3) = 0.016393... + 0.015873... ≈ 0.032266
    // 'c' = 1/(60+3) + 1/(60+1) = same total ≈ 0.032266
    const a = fused.find((r) => r.id === 'a');
    const c = fused.find((r) => r.id === 'c');
    expect(a?.score).toBeCloseTo(1 / 61 + 1 / 63, 10);
    expect(c?.score).toBeCloseTo(1 / 61 + 1 / 63, 10);

    // Unique rows come out as their single-list contribution with correct source.
    const b = fused.find((r) => r.id === 'b');
    const d = fused.find((r) => r.id === 'd');
    expect(b?.rank_source).toBe('keyword');
    expect(b?.score).toBeCloseTo(1 / 62, 10);
    expect(d?.rank_source).toBe('semantic');
    expect(d?.score).toBeCloseTo(1 / 62, 10);
  });

  test('respects limit and sorts by fused score desc', () => {
    const keyword = Array.from({ length: 5 }, (_, i) => mkKw(`k${i}`));
    const semantic = Array.from({ length: 5 }, (_, i) => mkSem(`s${i}`));
    const fused = rrfMerge(keyword, semantic, 3);
    expect(fused).toHaveLength(3);
    for (let i = 1; i < fused.length; i++) {
      // Safe index access under noUncheckedIndexedAccess.
      const prev = fused[i - 1]!;
      const curr = fused[i]!;
      expect(prev.score).toBeGreaterThanOrEqual(curr.score);
    }
  });

  test('handles one empty list', () => {
    const onlySemantic = rrfMerge([], [mkSem('x'), mkSem('y')], 5);
    expect(onlySemantic).toHaveLength(2);
    expect(onlySemantic.every((r) => r.rank_source === 'semantic')).toBe(true);

    const onlyKeyword = rrfMerge([mkKw('x')], [], 5);
    expect(onlyKeyword).toHaveLength(1);
    expect(onlyKeyword[0]!.rank_source).toBe('keyword');
  });
});

describe('searchPqrs (mock pool)', () => {
  interface MockCall {
    text: string;
    params: unknown[];
  }
  function makePool(rowsByCall: unknown[][]): {
    pool: { query: (text: string, params: unknown[]) => Promise<{ rows: unknown[] }> };
    calls: MockCall[];
  } {
    const calls: MockCall[] = [];
    let i = 0;
    return {
      calls,
      pool: {
        query: (text: string, params: unknown[]) => {
          calls.push({ text, params });
          const rows = rowsByCall[i++] ?? [];
          return Promise.resolve({ rows });
        },
      },
    };
  }

  test('keyword mode: returns rows with rank_source=keyword and numeric score', async () => {
    const { pool, calls } = makePool([
      [
        {
          id: 'p1',
          radicado: 'R-1',
          tipo: 'peticion',
          hechos_excerpt: 'h',
          peticion_excerpt: 'p',
          score: '0.42',
        },
      ],
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: SearchResult[] = await searchPqrs(pool as any, {
      tenantId: TENANT,
      query: 'luz',
      mode: 'keyword',
    });
    expect(res).toHaveLength(1);
    expect(res[0]!.rank_source).toBe('keyword');
    expect(res[0]!.score).toBe(0.42);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.params[0]).toBe(TENANT);
    expect(calls[0]!.params[1]).toBe('luz');
  });

  test('keyword mode with empty query short-circuits to empty array', async () => {
    const { pool, calls } = makePool([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await searchPqrs(pool as any, {
      tenantId: TENANT,
      query: '   ',
      mode: 'keyword',
    });
    expect(res).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test('semantic mode: requires queryEmbedding', async () => {
    const { pool } = makePool([]);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      searchPqrs(pool as any, {
        tenantId: TENANT,
        query: 'anything',
        mode: 'semantic',
      }),
    ).rejects.toThrow(/queryEmbedding is required/);
  });

  test('semantic mode: casts to vector literal and converts distance to similarity', async () => {
    const { pool, calls } = makePool([
      [
        {
          id: 'p2',
          radicado: null,
          tipo: null,
          hechos_excerpt: null,
          peticion_excerpt: null,
          distance: '0.25',
        },
      ],
    ]);
    const emb = fakeEmbedding(10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await searchPqrs(pool as any, {
      tenantId: TENANT,
      query: 'ignored for semantic',
      mode: 'semantic',
      queryEmbedding: emb,
      limit: 5,
    });
    expect(res).toHaveLength(1);
    expect(res[0]!.rank_source).toBe('semantic');
    // score = 1 - distance
    expect(res[0]!.score).toBeCloseTo(0.75, 10);
    // vector literal landed in the second parameter slot
    expect(typeof calls[0]!.params[1]).toBe('string');
    expect((calls[0]!.params[1] as string).startsWith('[')).toBe(true);
    expect(calls[0]!.params[2]).toBe(5);
  });

  test('hybrid mode: requires queryEmbedding', async () => {
    const { pool } = makePool([]);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      searchPqrs(pool as any, {
        tenantId: TENANT,
        query: 'x',
        mode: 'hybrid',
      }),
    ).rejects.toThrow(/queryEmbedding is required/);
  });

  test('hybrid mode: fetches 2x limit from each, RRF-merges, emits rank_source correctly', async () => {
    const keywordRows = [
      { id: 'a', radicado: 'R-a', tipo: 'peticion', hechos_excerpt: 'h', peticion_excerpt: 'p', score: '0.9' },
      { id: 'b', radicado: 'R-b', tipo: 'peticion', hechos_excerpt: 'h', peticion_excerpt: 'p', score: '0.8' },
      { id: 'c', radicado: 'R-c', tipo: 'peticion', hechos_excerpt: 'h', peticion_excerpt: 'p', score: '0.7' },
      { id: 'd', radicado: 'R-d', tipo: 'peticion', hechos_excerpt: 'h', peticion_excerpt: 'p', score: '0.6' },
    ];
    const semanticRows = [
      { id: 'c', radicado: 'R-c', tipo: 'queja', hechos_excerpt: 'h', peticion_excerpt: 'p', distance: '0.1' },
      { id: 'e', radicado: 'R-e', tipo: 'queja', hechos_excerpt: 'h', peticion_excerpt: 'p', distance: '0.2' },
      { id: 'a', radicado: 'R-a', tipo: 'queja', hechos_excerpt: 'h', peticion_excerpt: 'p', distance: '0.3' },
      { id: 'f', radicado: 'R-f', tipo: 'queja', hechos_excerpt: 'h', peticion_excerpt: 'p', distance: '0.4' },
    ];
    const { pool, calls } = makePool([keywordRows, semanticRows]);
    const emb = fakeEmbedding(99);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await searchPqrs(pool as any, {
      tenantId: TENANT,
      query: 'calle',
      mode: 'hybrid',
      queryEmbedding: emb,
      limit: 3,
    });

    // Two queries fired in parallel, both asking for 2x the requested limit.
    expect(calls).toHaveLength(2);
    expect(calls[0]!.params[2]).toBe(6);
    expect(calls[1]!.params[2]).toBe(6);

    // Returned slice is the requested limit.
    expect(res).toHaveLength(3);

    // 'a' and 'c' appear in both candidate lists — they should be flagged 'both'.
    const both = res.filter((r) => r.rank_source === 'both').map((r) => r.id).sort();
    expect(both).toEqual(['a', 'c']);
  });

  test('hybrid mode: empty query still runs the semantic leg only, merging against zero keyword candidates', async () => {
    const semanticRows = [
      { id: 'e', radicado: 'R-e', tipo: 'queja', hechos_excerpt: 'h', peticion_excerpt: 'p', distance: '0.1' },
    ];
    // When the keyword query is skipped, only one DB call is made.
    const { pool, calls } = makePool([semanticRows]);
    const emb = fakeEmbedding(123);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await searchPqrs(pool as any, {
      tenantId: TENANT,
      query: '   ',
      mode: 'hybrid',
      queryEmbedding: emb,
      limit: 5,
    });
    expect(calls).toHaveLength(1);
    expect(res).toHaveLength(1);
    expect(res[0]!.rank_source).toBe('semantic');
  });
});

// ---------------------------------------------------------------------------
// Integration tests — only run when DATABASE_URL_OPERATIONAL is set.
// ---------------------------------------------------------------------------

const INTEGRATION = Boolean(process.env.DATABASE_URL_OPERATIONAL);

describe.skipIf(!INTEGRATION)('searchPqrs (integration)', () => {
  let pool: import('pg').Pool;
  let testTenantId: string;
  const createdPqrIds: string[] = [];

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL_OPERATIONAL,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
    pool.on('connect', (c) => {
      c.query('SET ROLE app_operational').catch(() => {
        /* ignore — role may not exist in local */
      });
    });

    // Seed a second tenant + 5 PQRs + 5 fake embeddings.
    const slug = `search-test-${Date.now()}`;
    const tenantRes = await pool.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
      [`search-test`, slug],
    );
    testTenantId = tenantRes.rows[0]!.id;

    const seeds = [
      { hechos: 'fuga de agua potable en la comuna trece', peticion: 'repararla' },
      { hechos: 'basuras acumuladas en el parque central', peticion: 'recogerlas' },
      { hechos: 'ruido excesivo en zona residencial', peticion: 'controlar el ruido' },
      { hechos: 'hueco profundo en la calle cuarta', peticion: 'tapar el hueco' },
      { hechos: 'alumbrado publico danado', peticion: 'reparar alumbrado' },
    ];
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i]!;
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO pqr (tenant_id, channel, hechos, peticion, status, tipo)
         VALUES ($1, 'web', $2, $3, 'received', 'peticion')
         RETURNING id`,
        [testTenantId, seed.hechos, seed.peticion],
      );
      const pqrId = ins.rows[0]!.id;
      createdPqrIds.push(pqrId);
      // Fake embedding — just enough to populate the index for the test.
      const emb = toVectorLiteral(fakeEmbedding(i));
      await pool.query(
        `INSERT INTO pqr_embeddings (tenant_id, pqr_id, kind, embedding, model_version)
         VALUES ($1, $2, 'full', $3::vector(1024), 'test-v0')`,
        [testTenantId, pqrId, emb],
      );
    }
  }, 60_000);

  afterAll(async () => {
    if (!testTenantId) return;
    await pool.query(`DELETE FROM pqr_embeddings WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM pqr WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [testTenantId]);
    await pool.end();
  }, 60_000);

  test('keyword mode finds the "agua" PQR', async () => {
    const res = await searchPqrs(pool, {
      tenantId: testTenantId,
      query: 'agua',
      mode: 'keyword',
      limit: 10,
    });
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]!.hechos_excerpt).toMatch(/agua/i);
  });

  test('semantic mode returns results ordered by similarity', async () => {
    const res = await searchPqrs(pool, {
      tenantId: testTenantId,
      query: '',
      mode: 'semantic',
      queryEmbedding: fakeEmbedding(0),
      limit: 5,
    });
    expect(res.length).toBe(5);
    for (let i = 1; i < res.length; i++) {
      const prev = res[i - 1]!;
      const curr = res[i]!;
      expect(prev.score).toBeGreaterThanOrEqual(curr.score);
    }
  });

  test('hybrid mode merges both legs', async () => {
    const res = await searchPqrs(pool, {
      tenantId: testTenantId,
      query: 'agua',
      mode: 'hybrid',
      queryEmbedding: fakeEmbedding(0),
      limit: 5,
    });
    expect(res.length).toBeGreaterThan(0);
    expect(
      res.every((r) => r.rank_source === 'keyword' || r.rank_source === 'semantic' || r.rank_source === 'both'),
    ).toBe(true);
  });
});
