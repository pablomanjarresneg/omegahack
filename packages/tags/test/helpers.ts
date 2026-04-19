import { readFileSync } from "node:fs";
import {
  createTagLookup,
  loadTagTaxonomy,
  type TagLookup,
  type TagTaxonomy,
} from "../src/index.js";

export function loadFixtureTaxonomy(): {
  taxonomy: TagTaxonomy;
  lookup: TagLookup;
} {
  const fixtureUrl = new URL("../../../fixtures/tags-taxonomy.json", import.meta.url);
  const raw = JSON.parse(readFileSync(fixtureUrl, "utf8")) as unknown;
  const taxonomy = loadTagTaxonomy(raw);
  return {
    taxonomy,
    lookup: createTagLookup(taxonomy),
  };
}
