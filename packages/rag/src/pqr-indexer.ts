// Idempotent PQR → nella batch indexer.
//
// Nella's index tool skips documents whose id already exists in the bucket,
// so calling this repeatedly with the same PQR ids is free. We just pass
// every row through the shared renderer and hand the batch to the transport.

import { DEFAULT_PQR_BUCKET, nellaIndex, type NellaTransport } from './nella-client.js';
import { renderPqrAsNellaDoc, type PqrRenderRow } from './pqr-renderer.js';

export interface IndexPqrBatchDeps {
  transport?: NellaTransport;
  bucket?: string;
}

export interface IndexPqrBatchResult {
  bucket: string;
  indexed: string[];
  skipped: string[];
  /** Rows that threw while being rendered — never fatal, caller chooses. */
  errors: Array<{ id: string; message: string }>;
}

/**
 * Render a batch of PQR rows to nella docs and push them to the `omega-pqr-corpus`
 * bucket (override via `bucket`). Returns the indexed/skipped split from nella
 * plus any local render errors.
 */
export async function indexPqrBatch(
  rows: readonly PqrRenderRow[],
  deps: IndexPqrBatchDeps = {},
): Promise<IndexPqrBatchResult> {
  const bucket = deps.bucket ?? DEFAULT_PQR_BUCKET;
  const errors: IndexPqrBatchResult['errors'] = [];
  const documents = [];
  for (const row of rows) {
    try {
      documents.push(renderPqrAsNellaDoc(row).nellaDoc);
    } catch (err) {
      errors.push({
        id: row.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (documents.length === 0) {
    return { bucket, indexed: [], skipped: [], errors };
  }

  const { indexed, skipped } = await nellaIndex(
    { bucket, documents },
    { transport: deps.transport },
  );

  return { bucket, indexed, skipped, errors };
}
