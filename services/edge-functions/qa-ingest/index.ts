// qa-ingest — pulls a markdown document from the qa-corpus Storage bucket,
// chunks it heading-aware, computes 1024-dim embeddings, and writes rows into
// qa_bank.qa_documents, qa_bank.qa_chunks, qa_bank.qa_embeddings.
//
// Auth: POST with `Authorization: Bearer <admin key>` where admin key comes
// from the QA_INGEST_ADMIN_KEY env var. We DON'T accept the service-role key
// directly from arbitrary callers — the admin key is narrower and rotatable
// without touching Supabase creds.
//
// Request body:
//   { sourceId: string  (uuid of an existing qa_bank.qa_sources row)
//   , storagePath: string (object key inside the qa-corpus bucket)
//   , title?: string
//   , tenantId?: string | null
//   }
//
// The function itself executes against Supabase using the service-role client
// (which bypasses RLS); the admin key is the outer authorization layer.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { chunkMarkdown, estimateTokens } from './chunking.ts';
import { embed, EMBEDDING_MODEL } from './embed.ts';

interface IngestBody {
  sourceId: string;
  storagePath: string;
  title?: string;
  tenantId?: string | null;
}

interface SourceRow {
  id: string;
  title: string;
  kind: 'decreto' | 'ley' | 'canonical_response' | 'internal_memo';
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function unauthorized(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request, adminKey: string): boolean {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  const token = auth.slice(7).trim();
  // Constant-time-ish comparison — for small keys this is a best-effort
  // defense against trivial timing attacks. The underlying Supabase gateway
  // also gates on its own auth, so this is extra.
  if (token.length !== adminKey.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ adminKey.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

async function fetchMarkdown(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<{ text: string; checksum: string }> {
  const { data, error } = await supabase.storage.from('qa-corpus').download(storagePath);
  if (error) throw new Error(`storage.download: ${error.message}`);
  if (!data) throw new Error('storage.download returned no data');
  const buf = new Uint8Array(await data.arrayBuffer());
  const text = new TextDecoder('utf-8').decode(buf);
  const checksum = await sha256Hex(buf);
  return { text, checksum };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(digest);
  let out = '';
  for (const b of arr) out += b.toString(16).padStart(2, '0');
  return out;
}

async function getSource(
  supabase: SupabaseClient,
  sourceId: string,
): Promise<SourceRow> {
  const { data, error } = await supabase
    .schema('qa_bank')
    .from('qa_sources')
    .select('id, title, kind')
    .eq('id', sourceId)
    .maybeSingle();
  if (error) throw new Error(`qa_sources select: ${error.message}`);
  if (!data) throw new Error(`qa_sources: no row with id ${sourceId}`);
  return data as SourceRow;
}

async function insertDocument(
  supabase: SupabaseClient,
  args: {
    sourceId: string;
    tenantId: string | null;
    title: string;
    kind: SourceRow['kind'];
    uri: string;
    checksum: string;
  },
): Promise<string> {
  const { data, error } = await supabase
    .schema('qa_bank')
    .from('qa_documents')
    .insert({
      source_id: args.sourceId,
      tenant_id: args.tenantId,
      title: args.title,
      kind: args.kind,
      uri: args.uri,
      checksum: args.checksum,
    })
    .select('id')
    .single();
  if (error) throw new Error(`qa_documents insert: ${error.message}`);
  return (data as { id: string }).id;
}

async function insertChunksAndEmbeddings(
  supabase: SupabaseClient,
  documentId: string,
  markdown: string,
): Promise<{ chunks: number }> {
  const chunks = chunkMarkdown(markdown);
  if (chunks.length === 0) return { chunks: 0 };

  // Insert chunks first so we get back ids in the same order.
  const chunkRows = chunks.map((c) => ({
    document_id: documentId,
    ord: c.ord,
    text: c.text,
    heading_path: c.heading_path,
    token_count: c.token_count || estimateTokens(c.text),
  }));
  const { data: chunkData, error: chunkErr } = await supabase
    .schema('qa_bank')
    .from('qa_chunks')
    .insert(chunkRows)
    .select('id, ord');
  if (chunkErr) throw new Error(`qa_chunks insert: ${chunkErr.message}`);
  const chunkIds = new Map<number, string>();
  for (const row of chunkData as Array<{ id: string; ord: number }>) {
    chunkIds.set(row.ord, row.id);
  }

  // Batch-embed, one chunk at a time. Azure nella-embeddings typically
  // handles ~8k token inputs so 800-token chunks are well within bounds.
  const embedRows: Array<{
    chunk_id: string;
    embedding: string;
    model: string;
  }> = [];
  for (const c of chunks) {
    const id = chunkIds.get(c.ord);
    if (!id) throw new Error(`missing chunk id for ord=${c.ord}`);
    const vec = await embed(c.text);
    embedRows.push({
      chunk_id: id,
      // pgvector accepts number[] serialized by PostgREST; explicit literal
      // is safer across client versions.
      embedding: `[${vec.join(',')}]`,
      model: EMBEDDING_MODEL,
    });
  }
  const { error: embErr } = await supabase
    .schema('qa_bank')
    .from('qa_embeddings')
    .insert(embedRows);
  if (embErr) throw new Error(`qa_embeddings insert: ${embErr.message}`);

  return { chunks: chunks.length };
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminKey = Deno.env.get('QA_INGEST_ADMIN_KEY');
  if (!supabaseUrl || !serviceRoleKey || !adminKey) {
    return new Response(
      JSON.stringify({
        error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / QA_INGEST_ADMIN_KEY not configured',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!isAuthorized(req, adminKey)) {
    return unauthorized('admin bearer token required');
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!body.sourceId || !body.storagePath) {
    return new Response(
      JSON.stringify({ error: 'sourceId and storagePath are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const source = await getSource(supabase, body.sourceId);
    const { text, checksum } = await fetchMarkdown(supabase, body.storagePath);
    const documentId = await insertDocument(supabase, {
      sourceId: source.id,
      tenantId: body.tenantId ?? null,
      title: body.title ?? source.title,
      kind: source.kind,
      uri: `storage://qa-corpus/${body.storagePath}`,
      checksum,
    });
    const { chunks } = await insertChunksAndEmbeddings(supabase, documentId, text);
    return new Response(
      JSON.stringify({
        ok: true,
        documentId,
        chunks,
        checksum,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('qa-ingest failure:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
