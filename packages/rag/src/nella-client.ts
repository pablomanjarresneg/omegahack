// nella MCP client with a three-stage fallback chain:
//
//     nella MCP  ──(timeout / auth / empty)──▶  pgvector (qa_embeddings)
//                                                   │
//                                                   ▼
//                                              FTS (keyword)
//
// Every hop emits `{ source, latency_ms }` via the optional `telemetry`
// callback so the caller (usually the UI) can render a badge and so logs
// can track fallback frequency.
//
// The nella MCP transport is pluggable — the default `defaultNellaTransport`
// looks for an `NELLA_MCP_ENDPOINT` env var; if absent it throws immediately
// so the fallback chain kicks in. This keeps local dev working without
// requiring nella to be installed.

import type { Pool } from 'pg';
import { searchFts, searchSimilar, type RetrievedChunk, type SearchOptions } from './retriever.js';

export type HopSource = 'nella' | 'pgvector' | 'fts';

export interface HopTelemetry {
  source: HopSource;
  latency_ms: number;
  /** null on success, error message on failure. */
  error: string | null;
  /** Number of results returned at this hop (0 triggers the next fallback). */
  result_count: number;
}

export interface NellaSearchParams extends SearchOptions {
  query: string;
  /** Upper bound on nella MCP latency before we abandon & fall through. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_TOP_K = 5;

export interface NellaTransport {
  /** `mode` maps to nella's search mode; 'hybrid' is the sweet spot per docs. */
  search(input: {
    query: string;
    mode: 'hybrid' | 'semantic' | 'keyword';
    topK: number;
  }): Promise<NellaRawResult[]>;
}

export interface NellaRawResult {
  id: string;
  text: string;
  title: string | null;
  url: string | null;
  score: number;
  /** Optional — nella may or may not return this. */
  heading_path?: string[];
}

export interface NellaClientDeps {
  pool: Pool;
  transport?: NellaTransport;
  embed?: (text: string) => Promise<number[]>;
  /** Called once per hop. Errors in the callback are swallowed. */
  telemetry?: (t: HopTelemetry) => void;
}

/**
 * Run a search with automatic fallback. Always returns the same `RetrievedChunk`
 * shape regardless of which hop produced the results. `source` on each
 * result reflects the hop that produced it.
 */
export async function nellaSearch(
  params: NellaSearchParams,
  deps: NellaClientDeps,
): Promise<RetrievedChunk[]> {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const emitTelemetry = (t: HopTelemetry): void => {
    if (!deps.telemetry) return;
    try {
      deps.telemetry(t);
    } catch {
      /* swallow — telemetry is never load-bearing */
    }
  };

  // Hop 1: nella MCP with timeout race.
  const transport = deps.transport ?? defaultNellaTransport();
  if (transport) {
    const start = now();
    try {
      const raw = await raceWithTimeout(
        transport.search({ query: params.query, mode: 'hybrid', topK }),
        timeoutMs,
      );
      const elapsed = now() - start;
      const mapped = raw.map((r): RetrievedChunk => ({
        chunkId: r.id,
        documentId: r.id,
        sourceId: r.id,
        sourceTitle: r.title ?? 'nella',
        sourceKind: 'internal_memo',
        sourceUrl: r.url,
        headingPath: r.heading_path ?? [],
        chunkText: r.text,
        score: r.score,
        source: 'nella',
      }));
      emitTelemetry({
        source: 'nella',
        latency_ms: elapsed,
        error: null,
        result_count: mapped.length,
      });
      if (mapped.length > 0) return mapped;
      // Empty result → fall through to pgvector.
    } catch (err) {
      emitTelemetry({
        source: 'nella',
        latency_ms: now() - start,
        error: errMessage(err),
        result_count: 0,
      });
    }
  }

  // Hop 2: pgvector.
  const pgStart = now();
  try {
    const rows = await searchSimilar(
      deps.pool,
      params.query,
      {
        topK,
        tenantId: params.tenantId,
        corpusFilter: params.corpusFilter,
      },
      deps.embed,
    );
    emitTelemetry({
      source: 'pgvector',
      latency_ms: now() - pgStart,
      error: null,
      result_count: rows.length,
    });
    if (rows.length > 0) return rows;
  } catch (err) {
    emitTelemetry({
      source: 'pgvector',
      latency_ms: now() - pgStart,
      error: errMessage(err),
      result_count: 0,
    });
  }

  // Hop 3: FTS keyword.
  const ftsStart = now();
  try {
    const rows = await searchFts(deps.pool, params.query, {
      topK,
      tenantId: params.tenantId,
      corpusFilter: params.corpusFilter,
    });
    emitTelemetry({
      source: 'fts',
      latency_ms: now() - ftsStart,
      error: null,
      result_count: rows.length,
    });
    return rows;
  } catch (err) {
    emitTelemetry({
      source: 'fts',
      latency_ms: now() - ftsStart,
      error: errMessage(err),
      result_count: 0,
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function raceWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`nella timeout after ${ms}ms`)), ms),
    ),
  ]);
}

function now(): number {
  return typeof performance !== 'undefined' && 'now' in performance
    ? performance.now()
    : Date.now();
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Default transport — HTTP POST to `NELLA_MCP_ENDPOINT` with bearer
 * `NELLA_MCP_TOKEN`. Returns `null` when either env var is missing so the
 * caller can skip the nella hop entirely (rather than racing against a
 * guaranteed-failing request).
 */
export function defaultNellaTransport(): NellaTransport | null {
  const endpoint = process.env.NELLA_MCP_ENDPOINT;
  const token = process.env.NELLA_MCP_TOKEN;
  if (!endpoint || !token) return null;
  return {
    async search(input) {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tool: 'nella_search',
          arguments: input,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`nella MCP ${resp.status}: ${body}`);
      }
      const json = (await resp.json()) as { results?: NellaRawResult[] };
      return Array.isArray(json.results) ? json.results : [];
    },
  };
}
