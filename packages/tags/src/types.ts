export type CanonicalTagId = `${string}:${string}`;

export interface RawTagTaxonomy {
  schema: string;
  version: number;
  locale: string;
  description?: string;
  namespaces: RawTagNamespace[];
}

export interface RawTagNamespace {
  namespace: string;
  label: string;
  description?: string;
  tags: RawTaxonomyTag[];
}

export interface RawTaxonomyTag {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  aliases?: string[];
  parent?: string;
}

export interface TagNamespaceDefinition {
  namespace: string;
  label: string;
  description?: string;
  tagIds: readonly CanonicalTagId[];
}

export interface TaxonomyTag {
  id: CanonicalTagId;
  namespace: string;
  slug: string;
  label: string;
  description?: string;
  keywords: readonly string[];
  aliases: readonly string[];
  parent?: CanonicalTagId;
}

export interface TagTaxonomy {
  schema: string;
  version: number;
  locale: string;
  description?: string;
  namespaces: readonly TagNamespaceDefinition[];
  tags: readonly TaxonomyTag[];
}

export interface TagLookup {
  taxonomy: TagTaxonomy;
  byId: ReadonlyMap<CanonicalTagId, TaxonomyTag>;
  byNamespace: ReadonlyMap<string, readonly TaxonomyTag[]>;
}

export interface TagIdParts {
  id: CanonicalTagId;
  namespace: string;
  slug: string;
}

export type TagValidationResult =
  | {
      valid: true;
      id: CanonicalTagId;
      namespace: string;
      slug: string;
      label: string;
      open: boolean;
      tag?: TaxonomyTag;
    }
  | {
      valid: false;
      value: string;
      reason: string;
    };

export interface ExtractedTag {
  id: CanonicalTagId;
  namespace: string;
  slug: string;
  label: string;
  confidence: number;
  source: "candidate" | "heuristic" | "keyword";
  matches: readonly string[];
}

export interface BuiltSql {
  text: string;
  params: unknown[];
}
