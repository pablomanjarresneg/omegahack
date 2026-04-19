// pqr-nella-indexer — pushes PQR rows into the shared nella bucket
// (`omega-pqr-corpus`). Idempotent: nella skips doc ids it has already seen.
//
// Called by:
//   * the intake-agent orchestrator (fire-and-forget after insert)
//   * the n8n intake workflow's `Indexar en Nella (post-insert)` node
//   * the Schedule Trigger branch of the same workflow (backfill)
//
// Auth: service-role bearer token required — this function writes to an
// external index on behalf of the whole tenant.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import {
  indexPqrBatch,
  type NellaTransport,
  type PqrRenderRow,
} from '../../../packages/rag/src/index.ts';

const DEFAULT_BUCKET = 'omega-pqr-corpus';
const DEFAULT_LIMIT = 500;

const INDEXABLE_STATUSES = [
  'accepted',
  'assigned',
  'in_draft',
  'in_review',
  'approved',
  'sent',
  'closed',
] as const;

interface RequestBody {
  ids?: string[];
  since?: string;
  limit?: number;
  bucket?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  const token = auth.slice(7).trim();
  return token === serviceRoleKey;
}

/**
 * Builds a nella transport that posts to the configured MCP endpoint.
 * Deno-native: uses `Deno.env` directly so we never import the Node-only
 * `defaultNellaTransport()`.
 */
function buildTransport(): NellaTransport | null {
  const endpoint = Deno.env.get('NELLA_MCP_ENDPOINT');
  const token = Deno.env.get('NELLA_MCP_TOKEN');
  if (!endpoint || !token) return null;

  const searchTool = Deno.env.get('NELLA_MCP_SEARCH_TOOL') ?? 'nella_search';
  const indexTool = Deno.env.get('NELLA_MCP_INDEX_TOOL') ?? 'nella_index';

  async function post(tool: string, args: unknown): Promise<unknown> {
    const resp = await fetch(endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tool, arguments: args }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`nella MCP ${tool} ${resp.status}: ${body}`);
    }
    return resp.json();
  }

  return {
    async search(input) {
      const res = (await post(searchTool, input)) as { results?: unknown[] };
      return Array.isArray(res.results)
        ? (res.results as NonNullable<Awaited<ReturnType<NellaTransport['search']>>>)
        : [];
    },
    async index(input) {
      const res = (await post(indexTool, input)) as {
        indexed?: string[];
        skipped?: string[];
      };
      return {
        indexed: Array.isArray(res.indexed) ? res.indexed : [],
        skipped: Array.isArray(res.skipped) ? res.skipped : [],
      };
    },
  };
}

async function loadRows(
  supabase: SupabaseClient,
  body: RequestBody,
): Promise<PqrRenderRow[]> {
  const columns =
    'id, radicado, tipo, status, hechos, peticion, lead, secretaria_id, comuna_id, priority_level, priority_score, issued_at';

  if (body.ids && body.ids.length > 0) {
    const { data, error } = await supabase
      .from('pqr')
      .select(columns)
      .in('id', body.ids);
    if (error) throw new Error(`pqr select (ids): ${error.message}`);
    return (data ?? []) as PqrRenderRow[];
  }

  const limit = Math.max(1, Math.min(body.limit ?? DEFAULT_LIMIT, 2000));
  let q = supabase
    .from('pqr')
    .select(columns)
    .in('status', INDEXABLE_STATUSES as unknown as string[])
    .order('issued_at', { ascending: false })
    .limit(limit);
  if (body.since) {
    q = q.gte('updated_at', body.since);
  }
  const { data, error } = await q;
  if (error) throw new Error(`pqr select (batch): ${error.message}`);
  return (data ?? []) as PqrRenderRow[];
}

async function emitRunEvent(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('pqr_events').insert({
    tenant_id: Deno.env.get('DEFAULT_TENANT_ID') ?? '00000000-0000-0000-0000-000000000001',
    pqr_id: null,
    kind: 'nella_index_run',
    payload,
  });
  if (error) {
    console.warn('nella_index_run event insert failed:', error.message);
  }
}

export async function handleIndexerRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' },
      500,
    );
  }
  if (!isAuthorized(req, serviceRoleKey)) {
    return json({ error: 'service role bearer token required' }, 401);
  }

  const transport = buildTransport();
  if (!transport) {
    return json(
      { error: 'NELLA_MCP_ENDPOINT / NELLA_MCP_TOKEN not configured' },
      503,
    );
  }

  let body: RequestBody = {};
  if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return json({ error: 'Request body must be valid JSON' }, 400);
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let rows: PqrRenderRow[];
  try {
    rows = await loadRows(supabase, body);
  } catch (err) {
    console.error('loadRows failed:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  const bucket = body.bucket ?? DEFAULT_BUCKET;
  const startedAt = Date.now();
  const result = await indexPqrBatch(rows, { transport, bucket });
  const durationMs = Date.now() - startedAt;

  await emitRunEvent(supabase, {
    bucket,
    requested: rows.length,
    indexed: result.indexed.length,
    skipped: result.skipped.length,
    errors: result.errors.length,
    duration_ms: durationMs,
  });

  return json({
    bucket,
    requested: rows.length,
    indexed: result.indexed.length,
    skipped: result.skipped.length,
    errors: result.errors,
    duration_ms: durationMs,
  });
}

serve(handleIndexerRequest);
