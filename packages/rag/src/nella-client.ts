// nella MCP client.
//
// Search path:
//     nella MCP  ──(timeout / auth / empty)──▶  pgvector (qa_embeddings)
//                                                   │
//                                                   ▼
//                                              FTS (keyword)
//
// Every hop emits `{ source, latency_ms }` via the optional `telemetry`
// callback so the caller (usually the UI) can render a badge and so logs
// can track fallback frequency.
//
// Index path:
//     nella.index({ bucket, documents })   — idempotent on doc id
//
// Nella's indexer skips documents whose ids already exist, so calling
// `index()` with the same UUIDs repeatedly is a no-op; that's the contract
// the PQR indexer relies on for incremental backfills.
//
// The nella MCP transport is pluggable — the default `defaultNellaTransport`
// looks for an `NELLA_MCP_ENDPOINT` env var; if absent it returns null so
// the fallback chain kicks in for search, and the indexer short-circuits.

import type { Pool } from 'pg';
import { searchFts, searchSimilar, type RetrievedChunk, type SearchOptions } from './retriever.js';

export type HopSource = 'nella' | 'pgvector' | 'fts';

export const DEFAULT_PQR_BUCKET = 'omega-pqr-corpus';

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
  /** Optional nella bucket to scope the search to (e.g. `omega-pqr-corpus`). */
  bucket?: string;
}

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_TOP_K = 5;

export interface NellaSearchInput {
  query: string;
  mode: 'hybrid' | 'semantic' | 'keyword';
  topK: number;
  bucket?: string;
}

export interface NellaIndexDoc {
  /** Stable id — nella skips documents whose id has already been indexed. */
  id: string;
  /** Body text to embed. */
  text: string;
  title?: string;
  url?: string;
  /** Free-form metadata. Keep keys terse + ASCII so nella stores them faithfully. */
  metadata?: Record<string, unknown>;
}

export interface NellaIndexInput {
  bucket: string;
  documents: NellaIndexDoc[];
}

export interface NellaIndexResult {
  /** Ids nella treated as new (or re-indexed). */
  indexed: string[];
  /** Ids nella recognised as already-indexed and skipped. */
  skipped: string[];
}

export interface NellaTransport {
  /** `mode` maps to nella's search mode; 'hybrid' is the sweet spot per docs. */
  search(input: NellaSearchInput): Promise<NellaRawResult[]>;
  /** Upload documents to a nella bucket. Must be idempotent by doc id. */
  index?(input: NellaIndexInput): Promise<NellaIndexResult>;
}

export interface NellaRawResult {
  id: string;
  text: string;
  title: string | null;
  url: string | null;
  score: number;
  /** Optional — nella may or may not return this. */
  heading_path?: string[];
  /** Optional — arbitrary metadata nella stored alongside the doc. */
  metadata?: Record<string, unknown>;
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
        transport.search({
          query: params.query,
          mode: 'hybrid',
          topK,
          bucket: params.bucket,
        }),
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
        metadata: r.metadata,
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

/**
 * Upload documents to a nella bucket. Throws if no transport is configured
 * (indexing is a write — there is no fallback). Returns the indexed/skipped
 * split so callers can log incremental progress.
 */
export async function nellaIndex(
  input: NellaIndexInput,
  deps: Pick<NellaClientDeps, 'transport'>,
): Promise<NellaIndexResult> {
  const transport = deps.transport ?? defaultNellaTransport();
  if (!transport || !transport.index) {
    throw new Error(
      'nellaIndex: no transport with index() configured. Set NELLA_MCP_ENDPOINT + NELLA_MCP_TOKEN or inject a transport.',
    );
  }
  if (input.documents.length === 0) {
    return { indexed: [], skipped: [] };
  }
  return transport.index(input);
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
 * `NELLA_MCP_TOKEN`. The endpoint is expected to accept a JSON body of
 * `{ tool, arguments }` and return `{ results }` for search or
 * `{ indexed, skipped }` for index. Point it at the MCP SSE proxy
 * described in `docs/nella-n8n-mcp-guide.md` or at a thin HTTP gateway
 * that forwards to nella's SSE tools.
 *
 * Returns `null` when either env var is missing so the caller can skip
 * the nella hop entirely (rather than racing against a guaranteed-failing
 * request).
 */
export function defaultNellaTransport(): NellaTransport | null {
  const endpoint = process.env.NELLA_MCP_ENDPOINT;
  const token = process.env.NELLA_MCP_TOKEN;
  if (!endpoint || !token) return null;

  const searchTool = process.env.NELLA_MCP_SEARCH_TOOL ?? 'nella_search';
  const indexTool = process.env.NELLA_MCP_INDEX_TOOL ?? 'nella_index';

  async function post(tool: string, args: unknown): Promise<unknown> {
    const resp = await fetch(endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tool, arguments: args }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`nella MCP ${tool} ${resp.status}: ${body}`);
    }
    return resp.json();
  }

  return {
    async search(input) {
      const json = (await post(searchTool, input)) as { results?: NellaRawResult[] };
      return Array.isArray(json.results) ? json.results : [];
    },
    async index(input) {
      const json = (await post(indexTool, input)) as {
        indexed?: string[];
        skipped?: string[];
      };
      return {
        indexed: Array.isArray(json.indexed) ? json.indexed : [],
        skipped: Array.isArray(json.skipped) ? json.skipped : [],
      };
    },
  };
}
