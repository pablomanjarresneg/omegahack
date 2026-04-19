// Thin wrapper over Azure `nella-embeddings` used by both the RAG retriever and
// the qa-ingest edge function. Mirrors the interface in
// services/edge-functions/reembed-pqr/embed.ts — identical dimension (1024),
// identical env var names — but is callable from Node (not Deno).

export const EMBEDDING_DIM = 1024;
export const EMBEDDING_MODEL = 'azure-nella-embeddings-1024';

export interface AzureEmbeddingConfig {
  endpoint: string;
  apiKey: string;
}

export function loadAzureConfig(): AzureEmbeddingConfig | null {
  const endpoint = process.env.AZURE_EMBEDDINGS_ENDPOINT;
  const apiKey = process.env.AZURE_EMBEDDINGS_KEY;
  if (!endpoint || !apiKey) return null;
  return { endpoint, apiKey };
}

/**
 * Embed `text`. Returns a 1024-dim `number[]`.
 *
 * When `AZURE_EMBEDDINGS_ENDPOINT` / `AZURE_EMBEDDINGS_KEY` are absent we throw
 * — we intentionally do NOT fall back to a deterministic stub here, because
 * this entry point is used by production ingestion. For dev/test pipelines
 * that need a stub, set the env vars to the shared test endpoint.
 */
export async function embedText(
  text: string,
  cfg: AzureEmbeddingConfig | null = loadAzureConfig(),
): Promise<number[]> {
  if (!cfg) {
    throw new Error(
      'embedText: AZURE_EMBEDDINGS_ENDPOINT / AZURE_EMBEDDINGS_KEY not set',
    );
  }
  const resp = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey,
    },
    body: JSON.stringify({ input: text }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Azure embeddings ${resp.status}: ${body}`);
  }
  const json: unknown = await resp.json();
  const vec = pickVector(json);
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `Azure returned unexpected embedding shape (len=${Array.isArray(vec) ? vec.length : 'n/a'}, expected ${EMBEDDING_DIM})`,
    );
  }
  return vec as number[];
}

/**
 * Batch embed. Azure `nella-embeddings` accepts an array of inputs per call,
 * but we keep this conservative and round-trip one at a time so a single
 * oversize input can't poison a whole batch. Callers that need higher
 * throughput should parallelize with `Promise.all` at the caller level.
 */
export async function embedBatch(
  texts: readonly string[],
  cfg: AzureEmbeddingConfig | null = loadAzureConfig(),
): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    out.push(await embedText(t, cfg));
  }
  return out;
}

function pickVector(json: unknown): unknown {
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;
  if (Array.isArray(obj.embedding)) return obj.embedding;
  if (Array.isArray(obj.data)) {
    const first = obj.data[0];
    if (first && typeof first === 'object' && 'embedding' in first) {
      return (first as { embedding: unknown }).embedding;
    }
  }
  return null;
}

/**
 * Serialize a JS number array into a pgvector string literal. Reused between
 * retriever.ts and test code so we don't get two serializers out of sync.
 */
export function toVectorLiteral(arr: readonly number[]): string {
  if (arr.length !== EMBEDDING_DIM) {
    throw new Error(
      `toVectorLiteral: expected ${EMBEDDING_DIM} dims, got ${arr.length}`,
    );
  }
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`toVectorLiteral: non-finite value at index ${i}`);
    }
  }
  return `[${arr.join(',')}]`;
}
