import { describe, expect, test } from "vitest";
import {
  buildPqrTagUpsertData,
  buildPqrTagUpsertSql,
  buildQueueTagFilterSql,
  parseQueueTagFilters,
} from "../src/index.js";
import { loadFixtureTaxonomy } from "./helpers.js";

const PQR_ID = "00000000-0000-0000-0000-000000000111";

describe("pqr tag store helpers", () => {
  test("builds parameterized SQL that resolves tags before pqr_tags upsert", () => {
    const query = buildPqrTagUpsertSql(PQR_ID, [
      { id: "tema:huecos-malla-vial", source: "heuristic", confidence: 0.84 },
      { id: "keyword:lluvias", source: "keyword", confidence: 0.7 },
    ]);

    expect(query.text).toContain("INSERT INTO pqr_tags");
    expect(query.text).toContain("unnest($2::text[], $3::text[], $4::text[], $5::real[])");
    expect(query.text).toContain("JOIN tags t ON t.namespace = incoming.namespace");
    expect(query.text).toContain("ON CONFLICT (pqr_id, tag_id, source)");
    expect(query.params).toEqual([
      PQR_ID,
      ["tema", "keyword"],
      ["huecos-malla-vial", "lluvias"],
      ["heuristic", "keyword"],
      [0.84, 0.7],
    ]);
  });

  test("builds pqr_tags upsert rows from a database tag id resolver", () => {
    const rows = buildPqrTagUpsertData(
      PQR_ID,
      [
        { id: "tema:huecos-malla-vial", source: "heuristic", confidence: 0.8 },
        { id: "tema:huecos-malla-vial", source: "heuristic", confidence: 0.9 },
      ],
      new Map([["tema:huecos-malla-vial", "tag-db-1"]]),
    );

    expect(rows).toEqual([
      {
        pqr_id: PQR_ID,
        tag_id: "tag-db-1",
        source: "heuristic",
        confidence: 0.9,
      },
    ]);
  });
});

describe("queue tag filter helpers", () => {
  test("parses AND and OR queue tag params and builds parameterized SQL", () => {
    const { lookup } = loadFixtureTaxonomy();
    const filters = parseQueueTagFilters(
      "?tags=tema:huecos-malla-vial,territorio:comuna-11-laureles-estadio&tags_any=keyword:lluvias&tags_any=tema:residuos-solidos",
      lookup,
    );

    expect(filters).toEqual({
      all: ["tema:huecos-malla-vial", "territorio:comuna-11-laureles-estadio"],
      any: ["keyword:lluvias", "tema:residuos-solidos"],
    });

    const sql = buildQueueTagFilterSql(filters, 4);
    expect(sql.text).toContain("HAVING COUNT(DISTINCT");
    expect(sql.text).toContain("= ANY($4::text[])");
    expect(sql.text).toContain("= $5::int");
    expect(sql.text).toContain("= ANY($6::text[])");
    expect(sql.params).toEqual([
      ["tema:huecos-malla-vial", "territorio:comuna-11-laureles-estadio"],
      2,
      ["keyword:lluvias", "tema:residuos-solidos"],
    ]);
    expect(sql.nextParamIndex).toBe(7);
  });
});
