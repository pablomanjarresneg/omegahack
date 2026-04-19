import { describe, expect, test } from "vitest";
import {
  TagTaxonomyError,
  TagValidationError,
  assertValidTagIds,
  getTag,
  listTags,
  loadTagTaxonomy,
  validateTagId,
} from "../src/index.js";
import { loadFixtureTaxonomy } from "./helpers.js";

describe("tag taxonomy loading and lookup", () => {
  test("loads the Medellin fixture into closed namespaces", () => {
    const { taxonomy, lookup } = loadFixtureTaxonomy();

    expect(taxonomy.schema).toBe("omega.tags-taxonomy.v1");
    expect(taxonomy.tags.length).toBeGreaterThan(40);
    expect(taxonomy.namespaces.map((ns) => ns.namespace)).toEqual([
      "tema",
      "riesgo",
      "entidad",
      "territorio",
      "pqr",
    ]);
    expect(getTag(lookup, "tema:huecos-malla-vial")?.label).toBe(
      "Huecos y malla vial",
    );
    expect(listTags(lookup, "territorio").length).toBe(21);
  });

  test("rejects malformed taxonomy data", () => {
    expect(() =>
      loadFixtureLike({
        schema: "omega.tags-taxonomy.v1",
        version: 1,
        locale: "es-CO",
        namespaces: [
          {
            namespace: "keyword",
            label: "Keyword",
            tags: [{ id: "keyword:foo", label: "Foo" }],
          },
        ],
      }),
    ).toThrow(TagTaxonomyError);
  });

  test("validates closed tags and the open keyword namespace", () => {
    const { lookup } = loadFixtureTaxonomy();

    expect(validateTagId(lookup, "tema:huecos-malla-vial")).toMatchObject({
      valid: true,
      open: false,
      namespace: "tema",
    });
    expect(validateTagId(lookup, "keyword:lluvias")).toMatchObject({
      valid: true,
      open: true,
      label: "Lluvias",
    });
    expect(validateTagId(lookup, "otra:lluvias")).toMatchObject({
      valid: false,
    });
    expect(validateTagId(lookup, "tema:no-existe")).toMatchObject({
      valid: false,
    });
    expect(() => assertValidTagIds(lookup, ["tema:huecos-malla-vial", "otra:x"])).toThrow(
      TagValidationError,
    );
  });
});

function loadFixtureLike(value: unknown) {
  return loadTagTaxonomy(value);
}
