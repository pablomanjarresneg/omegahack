import "server-only";

import type { Database } from "@omega/db/types";
import { getServerSupabase } from "./supabase-server";
import { env } from "./env";

type PriorityLevel = Database["public"]["Enums"]["priority_level"];

export interface SimilarPqrHit {
  pqrId: string;
  radicado: string | null;
  title: string;
  snippet: string;
  score: number;
  source: "nella" | "pgvector";
  priorityLevel: PriorityLevel | null;
  problemGroupId: string | null;
  problemGroupTitle: string | null;
}

interface NellaRawResult {
  id: string;
  text: string;
  title: string | null;
  url: string | null;
  score: number;
  metadata?: Record<string, unknown>;
}

const PQR_BUCKET = "omega-pqr-corpus";
const DEFAULT_TOP_K = 5;
const NELLA_TIMEOUT_MS = 2500;

function readPriority(raw: unknown): PriorityLevel | null {
  if (
    raw === "P0_critica" ||
    raw === "P1_alta" ||
    raw === "P2_media" ||
    raw === "P3_baja"
  ) {
    return raw;
  }
  return null;
}

/**
 * Call the nella MCP search tool scoped to the PQR bucket. Returns null
 * when the MCP is unconfigured OR the call fails — caller falls back to
 * pgvector.
 */
async function searchNellaForPqrs(
  query: string,
  topK: number,
): Promise<NellaRawResult[] | null> {
  const endpoint = process.env.NELLA_MCP_ENDPOINT;
  const token = process.env.NELLA_MCP_TOKEN;
  if (!endpoint || !token) return null;
  const searchTool = process.env.NELLA_MCP_SEARCH_TOOL ?? "nella_search";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NELLA_TIMEOUT_MS);
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tool: searchTool,
        arguments: { query, mode: "hybrid", topK, bucket: PQR_BUCKET },
      }),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      console.warn(`nella search ${resp.status}: ${await resp.text()}`);
      return null;
    }
    const json = (await resp.json()) as { results?: NellaRawResult[] };
    return Array.isArray(json.results) ? json.results : null;
  } catch (err) {
    console.warn(
      `nella search error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * pgvector fallback over `public.pqr_embeddings.kind='full'`. Uses the SQL RPC
 * so PostgREST does cosine-distance ordering for us.
 */
async function searchPgvectorForPqrs(
  pqrId: string,
  topK: number,
): Promise<SimilarPqrHit[]> {
  const supabase = getServerSupabase();
  // The generated @omega/db types only surface RPCs that existed when
  // `pnpm db:types` last ran; this RPC ships in a newer migration. Cast
  // through `unknown` to sidestep the static list without widening the
  // whole client.
  type Row = {
    id: string;
    radicado: string | null;
    lead: string | null;
    peticion: string | null;
    similarity: number;
    priority_level: PriorityLevel | null;
    problem_group_id: string | null;
    problem_group_title: string | null;
  };
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ data: Row[] | null; error: { message: string } | null }>;
  }).rpc("find_similar_pqrs", {
    p_pqr_id: pqrId,
    p_limit: topK,
  });
  if (error) {
    console.warn(`find_similar_pqrs: ${error.message}`);
    return [];
  }

  const rows = data ?? [];
  return rows.map((r) => ({
    pqrId: r.id,
    radicado: r.radicado,
    title: r.lead ?? r.radicado ?? "PQR sin título",
    snippet: r.peticion ?? r.lead ?? "",
    score: Number(r.similarity),
    source: "pgvector" as const,
    priorityLevel: r.priority_level,
    problemGroupId: r.problem_group_id,
    problemGroupTitle: r.problem_group_title,
  }));
}

async function enrichNellaHits(
  selfPqrId: string,
  raws: NellaRawResult[],
): Promise<SimilarPqrHit[]> {
  const ids = raws
    .map((r) => r.id)
    .filter((id) => id && id !== selfPqrId);
  if (ids.length === 0) return [];

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "id, radicado, lead, peticion, priority_level, problem_group:pqr_problem_group_members(group_id, problem_groups(id, canonical_title))",
    )
    .eq("tenant_id", env.demoTenantId)
    .in("id", ids);
  if (error) {
    console.warn(`pqr lookup for nella hits: ${error.message}`);
    return [];
  }

  type Joined = {
    id: string;
    radicado: string | null;
    lead: string | null;
    peticion: string | null;
    priority_level: PriorityLevel | null;
    problem_group:
      | {
          group_id: string;
          problem_groups: { id: string; canonical_title: string | null } | null;
        }
      | Array<{
          group_id: string;
          problem_groups: { id: string; canonical_title: string | null } | null;
        }>
      | null;
  };

  const byId = new Map<string, Joined>();
  for (const row of (data ?? []) as Joined[]) {
    byId.set(row.id, row);
  }

  return raws
    .filter((r) => byId.has(r.id) && r.id !== selfPqrId)
    .map((r) => {
      const row = byId.get(r.id)!;
      const first = Array.isArray(row.problem_group)
        ? row.problem_group[0]
        : row.problem_group;
      const group = first?.problem_groups ?? null;
      const metaPriority = readPriority(r.metadata?.priority_level);
      return {
        pqrId: row.id,
        radicado: row.radicado,
        title: row.lead ?? r.title ?? row.radicado ?? "PQR sin título",
        snippet: row.peticion ?? row.lead ?? r.text.slice(0, 240),
        score: r.score,
        source: "nella" as const,
        priorityLevel: row.priority_level ?? metaPriority,
        problemGroupId: group?.id ?? null,
        problemGroupTitle: group?.canonical_title ?? null,
      };
    });
}

export interface SimilarPqrsResult {
  hits: SimilarPqrHit[];
  /** Hop that produced the result. Surfaces in the panel badge. */
  hop: "nella" | "pgvector" | "none";
  latencyMs: number;
}

/**
 * Hybrid similarity lookup for the PQR detail page. Tries nella first
 * (bucket `omega-pqr-corpus`), falls back to a pgvector RPC, and finally
 * returns `{ hits: [], hop: 'none' }`.
 */
export async function findSimilarPqrs(
  pqr: { id: string; lead: string | null; peticion: string | null; hechos: string | null },
  topK = DEFAULT_TOP_K,
): Promise<SimilarPqrsResult> {
  const query = [pqr.lead, pqr.peticion, pqr.hechos]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
  if (!query) return { hits: [], hop: "none", latencyMs: 0 };

  const startedAt = Date.now();
  const nellaRaw = await searchNellaForPqrs(query, topK + 1);
  if (nellaRaw && nellaRaw.length > 0) {
    const hits = await enrichNellaHits(pqr.id, nellaRaw);
    if (hits.length > 0) {
      return { hits: hits.slice(0, topK), hop: "nella", latencyMs: Date.now() - startedAt };
    }
  }

  const pgHits = await searchPgvectorForPqrs(pqr.id, topK);
  return {
    hits: pgHits,
    hop: pgHits.length > 0 ? "pgvector" : "none",
    latencyMs: Date.now() - startedAt,
  };
}
