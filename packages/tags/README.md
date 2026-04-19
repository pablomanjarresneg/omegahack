# @omega/tags

Taxonomía de tags namespaced + extractor + builders SQL para persistencia y filtros de cola.

## Superficie pública

```ts
import {
  loadTagTaxonomy,
  listTags,
  getTag,
  createTagLookup,
  TAG_TAXONOMY_SCHEMA,
  TagTaxonomyError,
  TagValidationError,
  validateTagId,
  assertValidTagIds,
  uniqueTagIds,
  makeTagId,
  parseTagId,
  slugifyTagPart,
  keywordLabel,
  toKeywordTagId,
  OPEN_KEYWORD_NAMESPACE,
  // extracción
  extractTags,
  // persistencia
  buildPqrTagUpsertSql,
  buildPqrTagUpsertData,
  PQR_TAG_UPSERT_SQL_CONTRACT,
  // filtros de cola
  buildQueueTagFilterSql,
  parseQueueTagFilters,
  QUEUE_TAG_FILTER_SQL_CONTRACT,
  QUEUE_TAGS_ALL_PARAM,
  QUEUE_TAGS_ANY_PARAM,
} from '@omega/tags';
```

## Namespaces

Los ids de tag siguen el patrón `<namespace>:<value>` o `<namespace>:<subns>:<value>`:

- `tema:*` — movilidad, salud, seguridad, servicios-publicos, educacion, vivienda, ambiente, empleo, cultura, deporte, discapacidad, genero, infancia, adulto-mayor.
- `subtema:*` — ej. `subtema:movilidad:huecos`, `subtema:salud:ips`.
- `ubicacion:comuna:N`, `ubicacion:corregimiento:N`.
- `infraestructura:*` — via, alumbrado, acueducto, alcantarillado, parque, puente, edificio-publico.
- `actor:*` — epm, afinia, eps-sura, contratista, policia, fiscalia.
- `vulnerabilidad:*` — menor-de-edad, adulto-mayor, persona-con-discapacidad, victima-conflicto, mujer-embarazada.
- `sentimiento:*` — neutro, frustrado, enojado, urgente, agradecido.
- `keyword:*` — namespace abierto para keywords emergentes.

La taxonomía viva en `fixtures/tags-taxonomy.json`. `loadTagTaxonomy()` la parsea con validación de esquema.

## Filtros de cola

`parseQueueTagFilters(searchParams)` lee los parámetros `tags-any` y `tags-all` del querystring del workbench y devuelve `{ any, all }`. `buildQueueTagFilterSql({any, all})` genera el fragmento SQL para la lista de PQRs.

## Persistencia

`buildPqrTagUpsertSql()` + `buildPqrTagUpsertData(pqrId, tags)` generan el upsert atómico que el intake-agent usa tras la clasificación.

## Tests

```bash
pnpm --filter @omega/tags test
```
