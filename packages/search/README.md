# @omega/search

Búsqueda de PQRs combinando vector (pgvector), FTS (tsvector) y filtros estructurados. Consumido por el workbench y la vista de secretaría.

## Superficie pública

```ts
import { searchPqrs } from '@omega/search';
import type {
  SearchPqrsParams,
  SearchFilters,
  SearchMode,
  SearchResult,
  RankSource,
  PqrStatus,
  PqrTipo,
  PriorityLevel,
} from '@omega/search';
```

## Modos

- `SearchMode = 'vector' | 'fts' | 'hybrid'`.
- `hybrid` corre ambos y fusiona con un ranking combinado.

## Filtros

`SearchFilters` incluye:

- `tenantId` (obligatorio).
- `secretariaId`, `comunaId`.
- `status[]`, `tipo[]`, `priorityLevel[]`.
- `tagIds` con semántica `any` o `all` (ver `@omega/tags/queue-filters`).
- `dateRange`.

## Ranking

Cada `SearchResult` lleva `rankSource` — indica si vino del camino vectorial, FTS o del merge — para que la UI pueda explicar por qué apareció un resultado.

## Dependencias

- `@omega/db`
- `pg` (peer)

## Tests

```bash
pnpm --filter @omega/search test
```
