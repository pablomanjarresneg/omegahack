# @omega/rag

Utilidades de Retrieval-Augmented Generation: chunking consciente de encabezados, embeddings Azure y búsqueda híbrida (vector + FTS). Alimenta el Q&A sobre ley, jurisprudencia y protocolos internos.

## Superficie pública

```ts
import {
  chunkMarkdown,
  estimateTokens,
  embedText,
  embedBatch,
  toVectorLiteral,
  loadAzureConfig,
  EMBEDDING_DIM,          // 1024
  EMBEDDING_MODEL,        // 'nella-embeddings'
  searchSimilar,
  searchFts,
  nellaSearch,
  defaultNellaTransport,
} from '@omega/rag';

import type {
  Chunk,
  AzureEmbeddingConfig,
  CorpusKind,
  RetrievedChunk,
  SearchOptions,
  HopSource,
  HopTelemetry,
  NellaTransport,
  NellaClientDeps,
  NellaSearchParams,
  NellaRawResult,
} from '@omega/rag';
```

## Chunking

`chunkMarkdown(markdown, { maxTokens })` parte un documento manteniendo `heading_path[]` por chunk. El retriever lo usa después para filtrar por sección o reconstruir contexto.

## Embeddings

`embedText` / `embedBatch` llaman a Azure `nella-embeddings` (1024-dim). Si no hay `AZURE_EMBEDDINGS_ENDPOINT` + `AZURE_EMBEDDINGS_KEY`, lanza error; el stub determinístico vive en `services/edge-functions/reembed-pqr/embed.ts` para contextos sin credenciales.

## Retriever

- `searchSimilar(pool, { corpus, embedding, topK, filters })` — vector search sobre `qa_bank.qa_embeddings` o `public.pqr_embeddings`.
- `searchFts(pool, { corpus, query, topK, filters })` — full text search en paralelo.

El caller combina ambos y rankea (hybrid score = α·vector + β·fts).

## Cliente Nella

`nellaSearch` encapsula llamadas a la API interna Nella — una capa superior que combina vector + FTS + re-rank. `defaultNellaTransport` usa `fetch`; las pruebas lo reemplazan con transportes fakes.

## Dependencias

- `pg` (peer) para los queries del retriever.

## Tests

```bash
pnpm --filter @omega/rag test
```
