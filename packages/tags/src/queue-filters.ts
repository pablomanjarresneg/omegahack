import type { BuiltSql, CanonicalTagId, TagLookup } from "./types.js";
import { TagValidationError, assertValidTagIds, uniqueTagIds } from "./taxonomy.js";

export const QUEUE_TAGS_ALL_PARAM = "tags";
export const QUEUE_TAGS_ANY_PARAM = "tags_any";

export const QUEUE_TAG_FILTER_SQL_CONTRACT =
  "?tags= applies AND semantics: every listed canonical tag id must be present. " +
  "?tags_any= applies OR semantics: at least one listed canonical tag id must be present. " +
  "SQL helpers use pqr_tags joined to tags and pass all tag ids as text[] parameters.";

export interface QueueTagFilters {
  all: readonly CanonicalTagId[];
  any: readonly CanonicalTagId[];
}

export type QueueTagParamSource =
  | string
  | URLSearchParams
  | Record<string, string | readonly string[] | undefined>;

export function parseQueueTagFilters(
  source: QueueTagParamSource,
  lookup: TagLookup,
): QueueTagFilters {
  const allRaw = readParam(source, QUEUE_TAGS_ALL_PARAM);
  const anyRaw = readParam(source, QUEUE_TAGS_ANY_PARAM);
  try {
    return {
      all: uniqueTagIds(assertValidTagIds(lookup, allRaw)),
      any: uniqueTagIds(assertValidTagIds(lookup, anyRaw)),
    };
  } catch (error) {
    if (error instanceof TagValidationError) throw error;
    throw error;
  }
}

export function buildQueueTagFilterSql(
  filters: QueueTagFilters,
  startIndex = 1,
): BuiltSql & { clauses: string[]; nextParamIndex: number } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let index = startIndex;

  if (filters.all.length > 0) {
    const idsIndex = index++;
    const countIndex = index++;
    // AND semantics: the grouped subquery must see every requested full tag id.
    clauses.push(
      `p.id IN (
  SELECT pt.pqr_id
  FROM pqr_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE (t.namespace || ':' || t.slug) = ANY($${idsIndex}::text[])
  GROUP BY pt.pqr_id
  HAVING COUNT(DISTINCT (t.namespace || ':' || t.slug)) = $${countIndex}::int
)`,
    );
    params.push([...filters.all], filters.all.length);
  }

  if (filters.any.length > 0) {
    const idsIndex = index++;
    // OR semantics: a single matching tag is enough.
    clauses.push(
      `EXISTS (
  SELECT 1
  FROM pqr_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.pqr_id = p.id
    AND (t.namespace || ':' || t.slug) = ANY($${idsIndex}::text[])
)`,
    );
    params.push([...filters.any]);
  }

  return {
    text: clauses.join("\nAND "),
    clauses,
    params,
    nextParamIndex: index,
  };
}

function readParam(source: QueueTagParamSource, key: string): string[] {
  if (typeof source === "string") {
    const params = new URLSearchParams(source.startsWith("?") ? source.slice(1) : source);
    return splitParamValues(params.getAll(key));
  }

  if (source instanceof URLSearchParams) {
    return splitParamValues(source.getAll(key));
  }

  const value = source[key];
  if (typeof value === "string") return splitParamValues([value]);
  if (Array.isArray(value)) return splitParamValues(value);
  return [];
}

function splitParamValues(values: readonly string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
