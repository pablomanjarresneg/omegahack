import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServiceRoleKey, requireSupabaseUrl } from "./env";

// ---------------------------------------------------------------------------
// Q&A retrieval for the case-detail page.
//
// Thin wrapper over the qa_bank.* tables that uses the Supabase PostgREST
// client with the service-role key. RLS is bypassed (service role always
// bypasses), but we keep this read-only by only calling .select() — there is
// NO .insert / .update surface exposed from this module.
//
// Why not pg.Pool + @omega/rag directly? Keeping the workbench app free of a
// direct Postgres dependency simplifies Vercel deploys. The canonical query
// logic (chunking, nella fallback, etc.) still lives in @omega/rag for
// server-side (Node) consumers that want the full pool-scoped experience.
// ---------------------------------------------------------------------------

const DEFAULT_TOP_K = 5;

type QaBankTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type QaBankDatabase = {
  qa_bank: {
    Tables: Record<string, QaBankTable>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

type QaBankClient = SupabaseClient<QaBankDatabase, "qa_bank">;

// The generated @omega/db/types only cover the `public` schema. Keep the
// qa_bank client generic enough for PostgREST calls, then map rows through our
// own local shapes before exposing them to the UI.
let qaClient: QaBankClient | null = null;

function getQaClient(): QaBankClient {
  if (!qaClient) {
    qaClient = createClient<QaBankDatabase, "qa_bank">(
      requireSupabaseUrl(),
      requireServiceRoleKey(),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: "qa_bank" },
      },
    );
  }
  return qaClient;
}

export type CorpusKind =
  | "decreto"
  | "ley"
  | "canonical_response"
  | "internal_memo";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  sourceId: string;
  sourceTitle: string;
  sourceKind: CorpusKind;
  sourceUrl: string | null;
  headingPath: string[];
  chunkText: string;
  score: number;
  source: "nella" | "pgvector" | "fts";
}

export interface QaSearchOptions {
  topK?: number;
  corpusFilter?: readonly CorpusKind[];
  tenantId?: string | null;
}

interface ChunkRow {
  id: string;
  document_id: string;
  ord: number;
  text: string;
  heading_path: string[] | null;
  qa_documents: {
    id: string;
    kind: CorpusKind;
    tenant_id: string | null;
    qa_sources: {
      id: string;
      title: string;
      kind: CorpusKind;
      url: string | null;
    } | null;
  } | null;
}

/**
 * FTS retrieval against qa_bank.qa_chunks. Safe baseline when Azure
 * embeddings or nella MCP aren't configured in the deploy environment.
 * Returns up to `topK` matches ordered by rank.
 */
export async function searchQaByKeyword(
  query: string,
  options: QaSearchOptions = {},
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const topK = options.topK ?? DEFAULT_TOP_K;

  const client = getQaClient();

  // We can't do FTS via PostgREST builder directly, but we can call a plain
  // filter using the `textSearch` helper which builds a to_tsquery predicate.
  let q = client
    .from("qa_chunks")
    .select(
      `
        id,
        document_id,
        ord,
        text,
        heading_path,
        qa_documents!inner (
          id,
          kind,
          tenant_id,
          qa_sources!inner ( id, title, kind, url )
        )
      `,
    )
    .textSearch("text", trimmed, {
      type: "plain",
      config: "spanish",
    })
    .limit(topK);

  if (options.corpusFilter && options.corpusFilter.length > 0) {
    q = q.in("qa_documents.kind", [...options.corpusFilter]);
  }
  if (options.tenantId === null) {
    q = q.is("qa_documents.tenant_id", null);
  } else if (options.tenantId !== undefined) {
    q = q.eq("qa_documents.tenant_id", options.tenantId);
  }

  const { data, error } = await q;
  if (error) {
    console.error("searchQaByKeyword:", error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as ChunkRow[];
  return rows.flatMap((row) => {
    const src = row.qa_documents?.qa_sources;
    if (!src) return [];
    return [
      {
        chunkId: row.id,
        documentId: row.document_id,
        sourceId: src.id,
        sourceTitle: src.title,
        sourceKind: src.kind,
        sourceUrl: src.url,
        headingPath: row.heading_path ?? [],
        chunkText: row.text,
        // FTS doesn't give us a normalized [0..1] score via PostgREST alone,
        // so we surface position as an inverse rank. Good enough for a UI
        // badge that just wants "higher is better".
        score: 1 - row.ord / (topK * 2 + row.ord),
        source: "fts" as const,
      },
    ];
  });
}

/**
 * Top-level retrieval used by the workbench panels. Today this is a single
 * keyword fallback implementation — as soon as embeddings are available at
 * read time (or a nella MCP endpoint is configured via the `@omega/rag`
 * Node-side retriever), the panels can swap in that implementation here.
 */
export async function searchQa(
  query: string,
  options: QaSearchOptions = {},
): Promise<RetrievedChunk[]> {
  return searchQaByKeyword(query, options);
}
