import { afterEach, describe, expect, test, vi } from "vitest";
import { TagValidationError, extractTags } from "../src/index.js";
import { loadFixtureTaxonomy } from "./helpers.js";

describe("extractTags", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("extracts heuristic tags from local taxonomy without network calls", () => {
    const { lookup } = loadFixtureTaxonomy();
    const fetchSpy = vi.fn(() => {
      throw new Error("network disabled in tag extractor test");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const tags = extractTags(
      {
        subject: "Hueco en la via",
        description:
          "En la comuna 11 hay un hueco grande que esta causando accidentes a las motos.",
        locationText: "Laureles, Medellin",
      },
      lookup,
    );
    const ids = tags.map((tag) => tag.id);

    expect(ids).toContain("tema:huecos-malla-vial");
    expect(ids).toContain("territorio:comuna-11-laureles-estadio");
    expect(ids).toContain("riesgo:seguridad-vial");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("validates candidate tags and accepts keyword tags only in keyword namespace", () => {
    const { lookup } = loadFixtureTaxonomy();

    const tags = extractTags(
      {
        text: "Solicitud por lluvias",
        candidateTagIds: ["tema:agua-alcantarillado", "keyword:lluvias"],
      },
      lookup,
    );

    expect(tags.map((tag) => tag.id)).toContain("tema:agua-alcantarillado");
    expect(tags.map((tag) => tag.id)).toContain("keyword:lluvias");
    expect(() =>
      extractTags({ text: "x", candidateTagIds: ["abierto:lluvias"] }, lookup),
    ).toThrow(TagValidationError);
  });

  test("can add sanitized keyword hints", () => {
    const { lookup } = loadFixtureTaxonomy();
    const tags = extractTags("Reporte ciudadano", lookup, {
      keywordHints: ["Lluvias fuertes"],
    });
    expect(tags).toContainEqual(
      expect.objectContaining({
        id: "keyword:lluvias-fuertes",
        source: "keyword",
      }),
    );
  });
});
