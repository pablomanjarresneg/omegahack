import { describe, expect, it, vi } from 'vitest';
import { nellaSearch, type HopTelemetry, type NellaTransport } from '../src/nella-client.js';
import type { Pool } from 'pg';

// We stub the pg Pool and the two retriever paths by injecting a fake pool
// that throws a sentinel whose presence the retriever functions cascade on.
// Easier: stub by hijacking the pool.query to return a shaped result.

function fakePool(rows: Array<Record<string, unknown>>): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as Pool;
}

function erroringPool(message: string): Pool {
  return {
    query: vi.fn().mockRejectedValue(new Error(message)),
  } as unknown as Pool;
}

const nellaResult = (id: string) => ({
  id,
  text: `text-${id}`,
  title: `title-${id}`,
  url: `https://ex/${id}`,
  score: 0.9,
});

const pgvectorRow = (id: string) => ({
  chunk_id: id,
  document_id: `d-${id}`,
  source_id: `s-${id}`,
  source_title: `t-${id}`,
  source_kind: 'decreto',
  source_url: null,
  heading_path: [],
  text: `pg-${id}`,
  score: 0.8,
});

const ftsRow = (id: string) => ({
  chunk_id: id,
  document_id: `d-${id}`,
  source_id: `s-${id}`,
  source_title: `t-${id}`,
  source_kind: 'ley',
  source_url: null,
  heading_path: [],
  text: `fts-${id}`,
  score: 0.5,
});

function successTransport(ids: string[]): NellaTransport {
  return {
    search: vi.fn().mockResolvedValue(ids.map((i) => nellaResult(i))),
  };
}

function erroringTransport(err: string): NellaTransport {
  return {
    search: vi.fn().mockRejectedValue(new Error(err)),
  };
}

function slowTransport(ms: number): NellaTransport {
  return {
    search: vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), ms)),
    ),
  };
}

const embed = async (_text: string): Promise<number[]> =>
  new Array(1024).fill(0).map((_, i) => (i % 2 === 0 ? 0.1 : -0.1));

describe('nellaSearch fallback chain', () => {
  it('returns nella results when nella succeeds', async () => {
    const tel: HopTelemetry[] = [];
    const rows = await nellaSearch(
      { query: 'ley 1755', topK: 3 },
      {
        pool: fakePool([]),
        transport: successTransport(['a', 'b']),
        embed,
        telemetry: (t) => tel.push(t),
      },
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.source === 'nella')).toBe(true);
    expect(tel.map((t) => t.source)).toEqual(['nella']);
    expect(tel[0]!.error).toBeNull();
  });

  it('falls through to pgvector when nella throws (auth failure)', async () => {
    const tel: HopTelemetry[] = [];
    const rows = await nellaSearch(
      { query: 'ley 1755' },
      {
        pool: fakePool([pgvectorRow('x')]),
        transport: erroringTransport('401 unauthorized'),
        embed,
        telemetry: (t) => tel.push(t),
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('pgvector');
    expect(tel.map((t) => t.source)).toEqual(['nella', 'pgvector']);
    expect(tel[0]!.error).toMatch(/401/);
  });

  it('falls through to pgvector when nella returns empty', async () => {
    const tel: HopTelemetry[] = [];
    const rows = await nellaSearch(
      { query: 'ley 1755' },
      {
        pool: fakePool([pgvectorRow('p')]),
        transport: successTransport([]),
        embed,
        telemetry: (t) => tel.push(t),
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('pgvector');
    expect(tel.map((t) => t.source)).toEqual(['nella', 'pgvector']);
    expect(tel[0]!.result_count).toBe(0);
  });

  it('falls through past slow nella via timeout', async () => {
    const tel: HopTelemetry[] = [];
    const rows = await nellaSearch(
      { query: 'ley 1755', timeoutMs: 50 },
      {
        pool: fakePool([pgvectorRow('t')]),
        transport: slowTransport(5000),
        embed,
        telemetry: (t) => tel.push(t),
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('pgvector');
    expect(tel[0]!.error).toMatch(/timeout/);
  });

  it('falls through to FTS when pgvector throws', async () => {
    const tel: HopTelemetry[] = [];
    // First query (pgvector) throws; second query (fts) resolves with rows.
    const pool = {
      query: vi
        .fn()
        .mockRejectedValueOnce(new Error('pgvector error'))
        .mockResolvedValueOnce({ rows: [ftsRow('f')] }),
    } as unknown as Pool;
    const rows = await nellaSearch(
      { query: 'ley 1755' },
      {
        pool,
        transport: erroringTransport('nella down'),
        embed,
        telemetry: (t) => tel.push(t),
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('fts');
    expect(tel.map((t) => t.source)).toEqual(['nella', 'pgvector', 'fts']);
    expect(tel[1]!.error).toMatch(/pgvector error/);
  });

  it('returns empty and emits three telemetry hops when all fail', async () => {
    const tel: HopTelemetry[] = [];
    const rows = await nellaSearch(
      { query: 'ley 1755' },
      {
        pool: erroringPool('db down'),
        transport: erroringTransport('nella down'),
        embed,
        telemetry: (t) => tel.push(t),
      },
    );
    expect(rows).toHaveLength(0);
    expect(tel.map((t) => t.source)).toEqual(['nella', 'pgvector', 'fts']);
    for (const t of tel) {
      expect(t.error).not.toBeNull();
    }
  });

  it('skips nella hop entirely when transport is null', async () => {
    const tel: HopTelemetry[] = [];
    const rows = await nellaSearch(
      { query: 'ley 1755' },
      {
        pool: fakePool([pgvectorRow('z')]),
        transport: undefined,
        embed,
        telemetry: (t) => tel.push(t),
      },
    );
    // We only expect pgvector telemetry because transport=null means "no nella".
    // Default transport resolver returns null unless env vars are set — tests
    // don't set them, so the nella hop is skipped silently.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('pgvector');
    expect(tel.map((t) => t.source)).toEqual(['pgvector']);
  });
});
