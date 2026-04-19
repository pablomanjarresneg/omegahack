import type {
  CanonicalTagId,
  ExtractedTag,
  TagLookup,
  TagTaxonomy,
  TagValidationResult,
} from "./types.js";
import {
  TagValidationError,
  createTagLookup,
  toKeywordTagId,
  validateTagId,
} from "./taxonomy.js";

const DIACRITIC_RE = /[\u0300-\u036f]/g;

export interface TagExtractionInput {
  text?: string | null;
  subject?: string | null;
  description?: string | null;
  rawText?: string | null;
  locationText?: string | null;
  candidateTagIds?: readonly string[];
  keywordHints?: readonly string[];
}

export interface ExtractTagsOptions {
  candidateTagIds?: readonly string[];
  keywordHints?: readonly string[];
  maxTags?: number;
  minConfidence?: number;
}

export function extractTags(
  input: string | TagExtractionInput,
  taxonomyOrLookup: TagTaxonomy | TagLookup,
  options: ExtractTagsOptions = {},
): ExtractedTag[] {
  const lookup = asLookup(taxonomyOrLookup);
  const normalizedText = normalizeForSearch(collectText(input).join(" "));
  const paddedText = ` ${normalizedText} `;
  const byId = new Map<CanonicalTagId, ExtractedTag>();

  const candidateTagIds = [
    ...(typeof input === "string" ? [] : (input.candidateTagIds ?? [])),
    ...(options.candidateTagIds ?? []),
  ];
  addValidatedCandidates(byId, lookup, candidateTagIds);

  const keywordHints = [
    ...(typeof input === "string" ? [] : (input.keywordHints ?? [])),
    ...(options.keywordHints ?? []),
  ];
  for (const hint of keywordHints) {
    const id = toKeywordTagId(hint);
    const valid = validateTagId(lookup, id);
    if (valid.valid) {
      upsertExtracted(byId, valid, "keyword", 0.7, [hint]);
    }
  }

  if (normalizedText.length > 0) {
    for (const tag of lookup.taxonomy.tags) {
      const terms = uniqueStrings([tag.label, ...tag.keywords, ...tag.aliases]);
      const matches = terms.filter((term) => containsTerm(paddedText, term));
      if (matches.length === 0) continue;
      const valid = validateTagId(lookup, tag.id);
      if (valid.valid) {
        const confidence = Math.min(0.95, 0.62 + matches.length * 0.08);
        upsertExtracted(byId, valid, "heuristic", confidence, matches);
      }
    }
  }

  const minConfidence = options.minConfidence ?? 0;
  const maxTags = options.maxTags ?? 16;
  return [...byId.values()]
    .filter((tag) => tag.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))
    .slice(0, maxTags);
}

function addValidatedCandidates(
  byId: Map<CanonicalTagId, ExtractedTag>,
  lookup: TagLookup,
  candidateTagIds: readonly string[],
) {
  const results = candidateTagIds.map((id) => validateTagId(lookup, id));
  const invalid = results.filter((result) => !result.valid);
  if (invalid.length > 0) {
    throw new TagValidationError(invalid);
  }
  for (const result of results) {
    if (result.valid) {
      upsertExtracted(byId, result, "candidate", 0.95, [result.id]);
    }
  }
}

function upsertExtracted(
  byId: Map<CanonicalTagId, ExtractedTag>,
  valid: Extract<TagValidationResult, { valid: true }>,
  source: ExtractedTag["source"],
  confidence: number,
  matches: readonly string[],
) {
  const existing = byId.get(valid.id);
  if (!existing) {
    byId.set(valid.id, {
      id: valid.id,
      namespace: valid.namespace,
      slug: valid.slug,
      label: valid.label,
      confidence,
      source,
      matches: uniqueStrings(matches),
    });
    return;
  }

  byId.set(valid.id, {
    ...existing,
    confidence: Math.max(existing.confidence, confidence),
    source: existing.source === "candidate" ? existing.source : source,
    matches: uniqueStrings([...existing.matches, ...matches]),
  });
}

function collectText(input: string | TagExtractionInput): string[] {
  if (typeof input === "string") return [input];
  return [
    input.subject,
    input.description,
    input.rawText,
    input.text,
    input.locationText,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function containsTerm(paddedText: string, term: string): boolean {
  const normalized = normalizeForSearch(term);
  return normalized.length > 0 && paddedText.includes(` ${normalized} `);
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITIC_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function asLookup(value: TagTaxonomy | TagLookup): TagLookup {
  if ("byId" in value && "byNamespace" in value) return value;
  return createTagLookup(value);
}
