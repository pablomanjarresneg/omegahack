import type { BuiltSql, CanonicalTagId, ExtractedTag } from "./types.js";
import { parseTagId } from "./taxonomy.js";

export const PQR_TAG_UPSERT_SQL_CONTRACT =
  "Upserts pqr_tags by resolving validated canonical tag ids against tags(namespace, slug). " +
  "All user values are passed as parameters: $1 pqr_id, $2 namespaces, $3 slugs, $4 sources, $5 confidences.";

export interface PqrTagAssignment {
  id: string;
  source?: string;
  confidence?: number | null;
}

export interface PqrTagUpsertRow {
  pqr_id: string;
  tag_id: string;
  source: string;
  confidence: number | null;
}

export type TagIdResolver =
  | ReadonlyMap<string, string>
  | Record<string, string>
  | ((tagId: CanonicalTagId) => string | undefined);

export interface BuildPqrTagOptions {
  defaultSource?: string;
  skipMissingTagIds?: boolean;
}

export function buildPqrTagUpsertSql(
  pqrId: string,
  tags: readonly (PqrTagAssignment | ExtractedTag)[],
  options: BuildPqrTagOptions = {},
): BuiltSql {
  const assignments = normalizeAssignments(tags, options.defaultSource ?? "heuristic");

  return {
    text: `
WITH incoming(namespace, slug, source, confidence) AS (
  SELECT * FROM unnest($2::text[], $3::text[], $4::text[], $5::real[])
)
INSERT INTO pqr_tags (pqr_id, tag_id, source, confidence)
SELECT $1::uuid, t.id, incoming.source, incoming.confidence
FROM incoming
JOIN tags t ON t.namespace = incoming.namespace AND t.slug = incoming.slug
ON CONFLICT (pqr_id, tag_id, source)
DO UPDATE SET confidence = EXCLUDED.confidence
RETURNING pqr_id, tag_id, source, confidence
`.trim(),
    params: [
      pqrId,
      assignments.map((tag) => tag.namespace),
      assignments.map((tag) => tag.slug),
      assignments.map((tag) => tag.source),
      assignments.map((tag) => tag.confidence),
    ],
  };
}

export function buildPqrTagUpsertData(
  pqrId: string,
  tags: readonly (PqrTagAssignment | ExtractedTag)[],
  tagIdResolver: TagIdResolver,
  options: BuildPqrTagOptions = {},
): PqrTagUpsertRow[] {
  const assignments = normalizeAssignments(tags, options.defaultSource ?? "heuristic");
  const rows: PqrTagUpsertRow[] = [];

  for (const assignment of assignments) {
    const tagId = resolveTagId(tagIdResolver, assignment.id);
    if (!tagId) {
      if (options.skipMissingTagIds) continue;
      throw new Error(`Missing database tag id for ${assignment.id}`);
    }
    rows.push({
      pqr_id: pqrId,
      tag_id: tagId,
      source: assignment.source,
      confidence: assignment.confidence,
    });
  }

  return rows;
}

interface NormalizedAssignment {
  id: CanonicalTagId;
  namespace: string;
  slug: string;
  source: string;
  confidence: number | null;
}

function normalizeAssignments(
  tags: readonly (PqrTagAssignment | ExtractedTag)[],
  defaultSource: string,
): NormalizedAssignment[] {
  const byKey = new Map<string, NormalizedAssignment>();

  for (const tag of tags) {
    const parts = parseTagId(tag.id);
    if (!parts) {
      throw new Error(`Invalid canonical tag id: ${tag.id}`);
    }
    const source = tag.source ?? defaultSource;
    const confidence = tag.confidence ?? null;
    const key = `${parts.id}\u0000${source}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        id: parts.id,
        namespace: parts.namespace,
        slug: parts.slug,
        source,
        confidence,
      });
      continue;
    }
    if (existing.confidence === null || (confidence !== null && confidence > existing.confidence)) {
      existing.confidence = confidence;
    }
  }

  return [...byKey.values()];
}

function resolveTagId(
  resolver: TagIdResolver,
  tagId: CanonicalTagId,
): string | undefined {
  if (typeof resolver === "function") return resolver(tagId);
  if (isMapLike(resolver)) return resolver.get(tagId);
  return resolver[tagId];
}

function isMapLike(value: unknown): value is ReadonlyMap<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof (value as { get?: unknown }).get === "function"
  );
}
