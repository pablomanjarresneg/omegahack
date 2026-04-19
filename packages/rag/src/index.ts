export { chunkMarkdown, estimateTokens } from './chunking.js';
export type { Chunk } from './chunking.js';

export {
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  embedText,
  embedBatch,
  loadAzureConfig,
  toVectorLiteral,
} from './embedding.js';
export type { AzureEmbeddingConfig } from './embedding.js';

export { searchSimilar, searchFts } from './retriever.js';
export type {
  CorpusKind,
  RetrievedChunk,
  SearchOptions,
} from './retriever.js';

export {
  nellaSearch,
  nellaIndex,
  defaultNellaTransport,
  DEFAULT_PQR_BUCKET,
} from './nella-client.js';
export type {
  HopSource,
  HopTelemetry,
  NellaClientDeps,
  NellaRawResult,
  NellaSearchInput,
  NellaSearchParams,
  NellaIndexDoc,
  NellaIndexInput,
  NellaIndexResult,
  NellaTransport,
} from './nella-client.js';

export { renderPqrAsNellaDoc, renderPqrMarkdown } from './pqr-renderer.js';
export type { PqrRenderRow, PqrRenderedDoc } from './pqr-renderer.js';

export { indexPqrBatch } from './pqr-indexer.js';
export type { IndexPqrBatchDeps, IndexPqrBatchResult } from './pqr-indexer.js';
