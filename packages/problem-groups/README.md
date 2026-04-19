# @omega/problem-groups

Agrupación de PQRs recurrentes por tenant. Un problem-group reúne casos del mismo problema subyacente (hueco en la vía, tanda de cortes de energía, etc.) para que jurídica los trate como una única incidencia.

## Superficie pública

```ts
import {
  attachOrCreateProblemGroup,
  findCandidateGroups,
  evaluateMatchPolicy,
  isHotProblemGroup,
  shouldAttachToGroup,
  DEFAULT_HOT_POLICY,
  DEFAULT_MATCH_POLICY,
  resolveHotDetectionPolicy,
  resolveMatchPolicy,
  cosineSimilarity,
  parseVectorLiteral,
  runningCentroid,
  toVectorLiteral,
  EMBEDDING_DIM,
  // ...helpers SQL + tags
} from '@omega/problem-groups';
```

## Política de matching

Un PQR `attach`ea a un grupo candidato cuando:

1. Cosine similarity entre su embedding y el centroid ≥ umbral.
2. Comparten al menos una comuna (tag `ubicacion:comuna:N`).
3. Comparten ≥ N tags temáticos (configurable por tenant).

Todo lo anterior se evalúa en el mismo query para no pagar round-trips:

```ts
await attachOrCreateProblemGroup(pool, {
  tenantId,
  pqrId,
  canonicalTitle,
  resumen,
  location,
  embedding,      // 1024-dim
  tags,           // opcional: si se pasa, no se consulta pqr_tags
  matchPolicy,    // opcional: umbrales
  hotPolicy,      // opcional: umbrales de "hot"
  now,
});
```

Devuelve `{ action: 'attached' | 'created', groupId, group, similarityScore, sharedTagCount }`. El centroid se actualiza en línea con una media corriente (`runningCentroid`), sin releer todos los miembros.

## "Hot" groups

Un grupo se marca `hot` cuando cruza umbrales combinados de cantidad de miembros y velocidad de crecimiento (`DEFAULT_HOT_POLICY`). `apps/workbench/grupos` los resalta para que jurídica escale.

## Transacción opcional

`attachOrCreateProblemGroup` acepta `Pool | PoolClient | PgExecutor`. Con un `Pool` abre transacción propia; con un `PoolClient` se injerta en la transacción del caller.

## Dependencias

- `@omega/db`
- `pg` (peer)

## Tests

```bash
pnpm --filter @omega/problem-groups test
```
