// reembed-pqr — drains public.pqr_embedding_jobs, computes 1024-dim embeddings
// for each PQR's (full|lead|peticion) text, and upserts them into
// public.pqr_embeddings. Invoked on a cron schedule via Supabase.
//
// Auth: the public URL is protected by Supabase; the caller (cron) must supply
// the service-role bearer token. This function does not trust any caller that
// is not the service role.
//
// Embedding logic lives in ./embed.ts so it can be unit-tested without
// triggering the top-level serve() call here.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { embed } from './embed.ts';

const MODEL_VERSION = Deno.env.get('EMBEDDING_MODEL_VERSION') ?? 'stub-deterministic-v1';
const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Queue processing
// ---------------------------------------------------------------------------

interface JobRow {
  id: string;
  tenant_id: string;
  pqr_id: string;
  reason: string;
  attempt_count: number;
}

interface PqrTextRow {
  id: string;
  tenant_id: string;
  hechos: string | null;
  peticion: string | null;
  lead: string | null;
}

async function processJob(supabase: SupabaseClient, job: JobRow): Promise<void> {
  const { data: pqr, error: pqrErr } = await supabase
    .from('pqr')
    .select('id, tenant_id, hechos, peticion, lead')
    .eq('id', job.pqr_id)
    .maybeSingle();

  if (pqrErr) throw new Error(`load pqr: ${pqrErr.message}`);
  if (!pqr) throw new Error(`pqr ${job.pqr_id} not found`);

  const row = pqr as PqrTextRow;
  const hechos = row.hechos ?? '';
  const peticion = row.peticion ?? '';
  const lead = row.lead ?? '';
  const full = [hechos, peticion, lead].filter((s) => s.length > 0).join('\n\n');

  const payloads: Array<{ kind: 'full' | 'lead' | 'peticion'; text: string }> = [
    { kind: 'full', text: full },
    { kind: 'lead', text: lead },
    { kind: 'peticion', text: peticion },
  ];

  const rows = [];
  for (const p of payloads) {
    const vec = await embed(p.text);
    rows.push({
      tenant_id: row.tenant_id,
      pqr_id: row.id,
      kind: p.kind,
      embedding: vec as unknown as string, // pgvector accepts number[] via PostgREST
      model_version: MODEL_VERSION,
    });
  }

  const { error: upErr } = await supabase
    .from('pqr_embeddings')
    .upsert(rows, { onConflict: 'pqr_id,kind,model_version' });
  if (upErr) throw new Error(`upsert embeddings: ${upErr.message}`);

  const { error: doneErr } = await supabase
    .from('pqr_embedding_jobs')
    .update({
      status: 'done',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  if (doneErr) throw new Error(`mark job done: ${doneErr.message}`);
}

async function recordFailure(
  supabase: SupabaseClient,
  job: JobRow,
  error: unknown,
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);
  const nextAttempts = (job.attempt_count ?? 0) + 1;
  // The RPC already flipped the job to 'running'. If we still have retries
  // left, put it back in 'queued' so the next invocation picks it up; once
  // we've burned MAX_ATTEMPTS, mark it 'failed' terminally.
  const nextStatus = nextAttempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
  const { error: updateErr } = await supabase
    .from('pqr_embedding_jobs')
    .update({
      status: nextStatus,
      attempt_count: nextAttempts,
      last_error: msg.slice(0, 4000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  if (updateErr) {
    console.error(`failed to record job failure ${job.id}:`, updateErr);
  }
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

function unauthorized(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  const token = auth.slice(7).trim();
  return token === serviceRoleKey;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!isAuthorized(req, serviceRoleKey)) {
    return unauthorized('service role bearer token required');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const batchSize = Math.max(1, Number(Deno.env.get('REEMBED_BATCH_SIZE') ?? '10') | 0);

  const { data: jobs, error: drainErr } = await supabase.rpc('drain_reembed_batch', {
    batch_size: batchSize,
  });
  if (drainErr) {
    return new Response(
      JSON.stringify({ error: `drain_reembed_batch: ${drainErr.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const jobList = (jobs ?? []) as JobRow[];
  let succeeded = 0;
  let failed = 0;
  for (const job of jobList) {
    try {
      await processJob(supabase, job);
      succeeded++;
    } catch (err) {
      console.error(`job ${job.id} failed:`, err);
      await recordFailure(supabase, job, err);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      processed: jobList.length,
      succeeded,
      failed,
      batch_size: batchSize,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
