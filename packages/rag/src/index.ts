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

export { nellaSearch, defaultNellaTransport } from './nella-client.js';
export type {
  HopSource,
  HopTelemetry,
  NellaClientDeps,
  NellaRawResult,
  NellaSearchParams,
  NellaTransport,
} from './nella-client.js';
