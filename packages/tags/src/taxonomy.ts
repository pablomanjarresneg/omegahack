import type {
  CanonicalTagId,
  RawTagTaxonomy,
  TagIdParts,
  TagLookup,
  TagNamespaceDefinition,
  TagTaxonomy,
  TagValidationResult,
  TaxonomyTag,
} from "./types.js";

export const TAG_TAXONOMY_SCHEMA = "omega.tags-taxonomy.v1";
export const OPEN_KEYWORD_NAMESPACE = "keyword";

const NAMESPACE_RE = /^[a-z][a-z0-9-]*$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const TAG_ID_RE = /^([a-z][a-z0-9-]*):([a-z0-9][a-z0-9-]*)$/;
const DIACRITIC_RE = /[\u0300-\u036f]/g;

export class TagTaxonomyError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid tag taxonomy: ${issues.join("; ")}`);
    this.name = "TagTaxonomyError";
    this.issues = issues;
  }
}

export class TagValidationError extends Error {
  readonly invalid: readonly TagValidationResult[];

  constructor(invalid: readonly TagValidationResult[]) {
    const values = invalid
      .filter((item) => !item.valid)
      .map((item) => (item.valid ? "" : `${item.value} (${item.reason})`));
    super(`Invalid tag ids: ${values.join(", ")}`);
    this.name = "TagValidationError";
    this.invalid = invalid;
  }
}

export function slugifyTagPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITIC_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function makeTagId(namespace: string, slug: string): CanonicalTagId {
  return `${namespace}:${slug}` as CanonicalTagId;
}

export function toKeywordTagId(value: string): CanonicalTagId {
  const slug = slugifyTagPart(value);
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Cannot build keyword tag from empty value: ${value}`);
  }
  return makeTagId(OPEN_KEYWORD_NAMESPACE, slug);
}

export function parseTagId(value: string): TagIdParts | null {
  const normalized = value.trim().toLowerCase();
  const match = TAG_ID_RE.exec(normalized);
  if (!match) return null;
  const namespace = match[1];
  const slug = match[2];
  if (!namespace || !slug) return null;
  return {
    id: makeTagId(namespace, slug),
    namespace,
    slug,
  };
}

export function loadTagTaxonomy(raw: unknown): TagTaxonomy {
  const issues: string[] = [];
  if (!isRecord(raw)) {
    throw new TagTaxonomyError(["root must be an object"]);
  }

  const schema = readString(raw, "schema", issues, "root") ?? TAG_TAXONOMY_SCHEMA;
  if (schema !== TAG_TAXONOMY_SCHEMA) {
    issues.push(`root.schema must be ${TAG_TAXONOMY_SCHEMA}`);
  }

  const versionValue = raw.version;
  const version =
    typeof versionValue === "number" && Number.isInteger(versionValue) && versionValue > 0
      ? versionValue
      : 0;
  if (version === 0) issues.push("root.version must be a positive integer");

  const locale = readString(raw, "locale", issues, "root") ?? "";
  const description = readOptionalString(raw, "description", issues, "root");
  const namespacesRaw = raw.namespaces;
  if (!Array.isArray(namespacesRaw) || namespacesRaw.length === 0) {
    issues.push("root.namespaces must be a non-empty array");
  }

  const namespaces: TagNamespaceDefinition[] = [];
  const tags: TaxonomyTag[] = [];
  const seenNamespaces = new Set<string>();
  const seenTagIds = new Set<CanonicalTagId>();

  if (Array.isArray(namespacesRaw)) {
    namespacesRaw.forEach((namespaceRaw, namespaceIndex) => {
      const path = `namespaces[${namespaceIndex}]`;
      if (!isRecord(namespaceRaw)) {
        issues.push(`${path} must be an object`);
        return;
      }

      const namespace = readString(namespaceRaw, "namespace", issues, path) ?? "";
      if (!NAMESPACE_RE.test(namespace)) {
        issues.push(`${path}.namespace must be a lowercase slug`);
      }
      if (namespace === OPEN_KEYWORD_NAMESPACE) {
        issues.push(`${path}.namespace is reserved for open keyword tags`);
      }
      if (seenNamespaces.has(namespace)) {
        issues.push(`${path}.namespace duplicates ${namespace}`);
      }
      seenNamespaces.add(namespace);

      const label = readString(namespaceRaw, "label", issues, path) ?? namespace;
      const nsDescription = readOptionalString(namespaceRaw, "description", issues, path);
      const tagsRaw = namespaceRaw.tags;
      if (!Array.isArray(tagsRaw) || tagsRaw.length === 0) {
        issues.push(`${path}.tags must be a non-empty array`);
      }

      const tagIds: CanonicalTagId[] = [];
      if (Array.isArray(tagsRaw)) {
        tagsRaw.forEach((tagRaw, tagIndex) => {
          const tagPath = `${path}.tags[${tagIndex}]`;
          if (!isRecord(tagRaw)) {
            issues.push(`${tagPath} must be an object`);
            return;
          }
          const idValue = readString(tagRaw, "id", issues, tagPath) ?? "";
          const parts = parseTagId(idValue);
          if (!parts) {
            issues.push(`${tagPath}.id must be namespace:slug`);
            return;
          }
          if (parts.namespace !== namespace) {
            issues.push(`${tagPath}.id namespace must match ${namespace}`);
          }
          if (seenTagIds.has(parts.id)) {
            issues.push(`${tagPath}.id duplicates ${parts.id}`);
          }
          seenTagIds.add(parts.id);
          tagIds.push(parts.id);

          const tagLabel = readString(tagRaw, "label", issues, tagPath) ?? parts.slug;
          const tagDescription = readOptionalString(tagRaw, "description", issues, tagPath);
          const keywords = readOptionalStringArray(tagRaw, "keywords", issues, tagPath);
          const aliases = readOptionalStringArray(tagRaw, "aliases", issues, tagPath);
          const parentRaw = readOptionalString(tagRaw, "parent", issues, tagPath);
          const parent = parentRaw ? parseTagId(parentRaw)?.id : undefined;
          if (parentRaw && !parent) {
            issues.push(`${tagPath}.parent must be namespace:slug`);
          }

          const tag: TaxonomyTag = {
            id: parts.id,
            namespace: parts.namespace,
            slug: parts.slug,
            label: tagLabel,
            keywords,
            aliases,
          };
          if (tagDescription) tag.description = tagDescription;
          if (parent) tag.parent = parent;
          tags.push(tag);
        });
      }

      const namespaceDef: TagNamespaceDefinition = {
        namespace,
        label,
        tagIds,
      };
      if (nsDescription) namespaceDef.description = nsDescription;
      namespaces.push(namespaceDef);
    });
  }

  for (const tag of tags) {
    if (tag.parent && !seenTagIds.has(tag.parent)) {
      issues.push(`${tag.id}.parent references missing tag ${tag.parent}`);
    }
  }

  if (issues.length > 0) {
    throw new TagTaxonomyError(issues);
  }

  const taxonomy: TagTaxonomy = {
    schema,
    version,
    locale,
    namespaces,
    tags,
  };
  if (description) taxonomy.description = description;
  return taxonomy;
}

export function createTagLookup(taxonomy: TagTaxonomy): TagLookup {
  const byId = new Map<CanonicalTagId, TaxonomyTag>();
  const grouped = new Map<string, TaxonomyTag[]>();
  for (const tag of taxonomy.tags) {
    byId.set(tag.id, tag);
    const group = grouped.get(tag.namespace) ?? [];
    group.push(tag);
    grouped.set(tag.namespace, group);
  }
  return {
    taxonomy,
    byId,
    byNamespace: grouped,
  };
}

export function listTags(
  lookup: TagLookup,
  namespace?: string,
): readonly TaxonomyTag[] {
  if (!namespace) return lookup.taxonomy.tags;
  return lookup.byNamespace.get(namespace) ?? [];
}

export function getTag(
  lookup: TagLookup,
  value: string,
): TaxonomyTag | undefined {
  const parts = parseTagId(value);
  return parts ? lookup.byId.get(parts.id) : undefined;
}

export function validateTagId(
  lookup: TagLookup,
  value: string,
): TagValidationResult {
  const parts = parseTagId(value);
  if (!parts) {
    return {
      valid: false,
      value,
      reason: "expected namespace:slug using lowercase ascii slugs",
    };
  }

  const tag = lookup.byId.get(parts.id);
  if (tag) {
    return {
      valid: true,
      id: parts.id,
      namespace: parts.namespace,
      slug: parts.slug,
      label: tag.label,
      open: false,
      tag,
    };
  }

  if (parts.namespace === OPEN_KEYWORD_NAMESPACE) {
    return {
      valid: true,
      id: parts.id,
      namespace: parts.namespace,
      slug: parts.slug,
      label: keywordLabel(parts.slug),
      open: true,
    };
  }

  return {
    valid: false,
    value,
    reason: `unknown closed taxonomy tag ${parts.id}`,
  };
}

export function assertValidTagIds(
  lookup: TagLookup,
  values: readonly string[],
): CanonicalTagId[] {
  const results = values.map((value) => validateTagId(lookup, value));
  const invalid = results.filter((result) => !result.valid);
  if (invalid.length > 0) {
    throw new TagValidationError(invalid);
  }
  return results.map((result) => {
    if (!result.valid) {
      throw new TagValidationError([result]);
    }
    return result.id;
  });
}

export function uniqueTagIds(values: readonly CanonicalTagId[]): CanonicalTagId[] {
  return [...new Set(values)];
}

export function keywordLabel(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readString(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  path: string,
): string | undefined {
  const item = value[key];
  if (typeof item !== "string" || item.trim().length === 0) {
    issues.push(`${path}.${key} must be a non-empty string`);
    return undefined;
  }
  return item.trim();
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  path: string,
): string | undefined {
  const item = value[key];
  if (item === undefined) return undefined;
  if (typeof item !== "string") {
    issues.push(`${path}.${key} must be a string`);
    return undefined;
  }
  const trimmed = item.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalStringArray(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  path: string,
): string[] {
  const item = value[key];
  if (item === undefined) return [];
  if (!Array.isArray(item)) {
    issues.push(`${path}.${key} must be a string array`);
    return [];
  }
  const strings: string[] = [];
  item.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      issues.push(`${path}.${key}[${index}] must be a non-empty string`);
    } else {
      strings.push(entry.trim());
    }
  });
  return strings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { RawTagTaxonomy };
