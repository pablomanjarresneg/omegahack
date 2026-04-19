#!/usr/bin/env tsx
// benchmark — runs three indicators against the linked Supabase and prints a
// side-by-side "sin OmegaHack" vs "con OmegaHack" view. The three indicators
// mirror the reto-valor deck:
//   M1 repetición      — cuántos PQRs se agrupan (problem_groups)
//   M2 cargas          — cuántos se clasifican + enrutan automáticamente
//   M3 tiempo          — latencia del intake + salud de plazos
//
// Usage:
//   tsx scripts/benchmark.ts
//   tsx scripts/benchmark.ts --tenant 00000000-0000-0000-0000-000000000001
//
// Required env:
//   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@omega/db/types";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

type Db = SupabaseClient<Database>;

type CliArgs = {
  tenantId: string;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const tenantIdx = args.findIndex((a) => a === "--tenant");
  const tenantId =
    tenantIdx >= 0
      ? args[tenantIdx + 1]
      : (process.env.NEXT_PUBLIC_DEMO_TENANT_ID ?? DEFAULT_TENANT_ID);
  if (!tenantId) throw new Error("--tenant must be a uuid");
  return { tenantId };
}

function requireEnv(...names: string[]): string {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Missing env var: one of ${names.join(", ")}`);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

type M1 = {
  total_pqrs: number;
  grouped_pqrs: number;
  active_groups: number;
  hot_groups: number;
  dedup_rate: number;
  respuestas_ahorradas: number;
};

type SecretariaDist = { secretaria_id: string | null; nombre: string | null; count: number };

type M2 = {
  total_pqrs: number;
  classified_pqrs: number;
  priority_assigned: number;
  high_confidence_tagged_pqrs: number;
  auto_routing_rate: number;
  priority_rate: number;
  high_confidence_rate: number;
  top_secretarias: SecretariaDist[];
};

type Percentiles = { p50_ms: number; p90_ms: number; p99_ms: number; max_ms: number; sample: number };

type M3 = {
  intake_latency: Percentiles;
  end_to_end_latency: Percentiles;
  deadline_buckets: { on_track: number; at_risk: number; overdue: number };
  open_total: number;
};

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx] ?? 0;
}

function summarize(samples: number[]): Percentiles {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50_ms: percentile(sorted, 50),
    p90_ms: percentile(sorted, 90),
    p99_ms: percentile(sorted, 99),
    max_ms: sorted.length > 0 ? (sorted[sorted.length - 1] ?? 0) : 0,
    sample: sorted.length,
  };
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = (s / 3600).toFixed(1);
  return `${h}h`;
}

async function computeM1(db: Db, tenantId: string): Promise<M1> {
  const [totalRes, groupedRes, activeGroupsRes, hotGroupsRes] = await Promise.all([
    db
      .from("pqr")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    db
      .from("pqr_problem_group_members")
      .select("pqr_id, pqr!inner(tenant_id)", { count: "exact", head: true })
      .eq("pqr.tenant_id", tenantId),
    db
      .from("problem_groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("member_count", 2),
    db
      .from("problem_groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("hot", true),
  ]);

  for (const [label, res] of [
    ["pqr count", totalRes],
    ["grouped members", groupedRes],
    ["active groups", activeGroupsRes],
    ["hot groups", hotGroupsRes],
  ] as const) {
    if (res.error) throw new Error(`${label}: ${res.error.message}`);
  }

  const total = totalRes.count ?? 0;
  const grouped = groupedRes.count ?? 0;
  const active = activeGroupsRes.count ?? 0;
  const hot = hotGroupsRes.count ?? 0;

  return {
    total_pqrs: total,
    grouped_pqrs: grouped,
    active_groups: active,
    hot_groups: hot,
    dedup_rate: total > 0 ? grouped / total : 0,
    respuestas_ahorradas: Math.max(grouped - active, 0),
  };
}

async function computeM2(db: Db, tenantId: string): Promise<M2> {
  const [totalRes, classifiedRes, priorityRes, pqrsWithTagsRes, pqrRowsRes, secretariasRes] =
    await Promise.all([
      db
        .from("pqr")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      db
        .from("pqr")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("secretaria_id", "is", null),
      db
        .from("pqr")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .not("priority_level", "is", null),
      db
        .from("pqr_tags")
        .select("pqr_id, pqr!inner(tenant_id)")
        .eq("pqr.tenant_id", tenantId)
        .gte("confidence", 0.7),
      db
        .from("pqr")
        .select("secretaria_id")
        .eq("tenant_id", tenantId)
        .not("secretaria_id", "is", null),
      db
        .from("secretarias")
        .select("id, nombre")
        .eq("tenant_id", tenantId),
    ]);

  for (const [label, res] of [
    ["pqr count", totalRes],
    ["classified count", classifiedRes],
    ["priority count", priorityRes],
    ["high-conf tags", pqrsWithTagsRes],
    ["secretaria rows", pqrRowsRes],
    ["secretarias", secretariasRes],
  ] as const) {
    if (res.error) throw new Error(`${label}: ${res.error.message}`);
  }

  const total = totalRes.count ?? 0;
  const classified = classifiedRes.count ?? 0;
  const priority = priorityRes.count ?? 0;

  const tagRows = (pqrsWithTagsRes.data ?? []) as Array<{ pqr_id: string }>;
  const highConfPqrs = new Set(tagRows.map((r) => r.pqr_id)).size;

  const secretariaCounts = new Map<string, number>();
  for (const row of (pqrRowsRes.data ?? []) as Array<{ secretaria_id: string | null }>) {
    if (!row.secretaria_id) continue;
    secretariaCounts.set(
      row.secretaria_id,
      (secretariaCounts.get(row.secretaria_id) ?? 0) + 1,
    );
  }
  const nameById = new Map<string, string>();
  for (const row of (secretariasRes.data ?? []) as Array<{ id: string; nombre: string }>) {
    nameById.set(row.id, row.nombre);
  }
  const top: SecretariaDist[] = [...secretariaCounts.entries()]
    .map(([secretaria_id, count]) => ({
      secretaria_id,
      nombre: nameById.get(secretaria_id) ?? null,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total_pqrs: total,
    classified_pqrs: classified,
    priority_assigned: priority,
    high_confidence_tagged_pqrs: highConfPqrs,
    auto_routing_rate: total > 0 ? classified / total : 0,
    priority_rate: total > 0 ? priority / total : 0,
    high_confidence_rate: total > 0 ? highConfPqrs / total : 0,
    top_secretarias: top,
  };
}

const OPEN_STATUSES = new Set([
  "received",
  "accepted",
  "assigned",
  "in_draft",
  "in_review",
  "approved",
]);

const AT_RISK_WINDOW_MS = 48 * 60 * 60 * 1000;

async function computeM3(db: Db, tenantId: string): Promise<M3> {
  const [eventsRes, openPqrsRes] = await Promise.all([
    db
      .from("pqr_events")
      .select("pqr_id, kind, created_at")
      .eq("tenant_id", tenantId)
      .in("kind", ["received", "classified", "response_sent"]),
    db
      .from("pqr")
      .select("id, status, legal_deadline")
      .eq("tenant_id", tenantId),
  ]);

  if (eventsRes.error) throw new Error(`pqr_events: ${eventsRes.error.message}`);
  if (openPqrsRes.error) throw new Error(`pqr: ${openPqrsRes.error.message}`);

  const byPqr = new Map<string, { received?: number; classified?: number; response_sent?: number }>();
  for (const row of (eventsRes.data ?? []) as Array<{
    pqr_id: string;
    kind: string;
    created_at: string;
  }>) {
    const ts = new Date(row.created_at).getTime();
    const slot = byPqr.get(row.pqr_id) ?? {};
    if (row.kind === "received") slot.received = Math.min(slot.received ?? ts, ts);
    if (row.kind === "classified") slot.classified = Math.min(slot.classified ?? ts, ts);
    if (row.kind === "response_sent")
      slot.response_sent = Math.min(slot.response_sent ?? ts, ts);
    byPqr.set(row.pqr_id, slot);
  }

  const intakeSamples: number[] = [];
  const endToEndSamples: number[] = [];
  for (const slot of byPqr.values()) {
    if (slot.received !== undefined && slot.classified !== undefined) {
      intakeSamples.push(slot.classified - slot.received);
    }
    if (slot.received !== undefined && slot.response_sent !== undefined) {
      endToEndSamples.push(slot.response_sent - slot.received);
    }
  }

  const now = Date.now();
  const buckets = { on_track: 0, at_risk: 0, overdue: 0 };
  let openTotal = 0;
  for (const row of (openPqrsRes.data ?? []) as Array<{
    id: string;
    status: string;
    legal_deadline: string | null;
  }>) {
    if (!OPEN_STATUSES.has(row.status)) continue;
    openTotal++;
    if (!row.legal_deadline) continue;
    const delta = new Date(row.legal_deadline).getTime() - now;
    if (delta <= 0) buckets.overdue++;
    else if (delta < AT_RISK_WINDOW_MS) buckets.at_risk++;
    else buckets.on_track++;
  }

  return {
    intake_latency: summarize(intakeSamples),
    end_to_end_latency: summarize(endToEndSamples),
    deadline_buckets: buckets,
    open_total: openTotal,
  };
}

function printM3(m3: M3): void {
  console.log("");
  console.log("── M3 · Tiempo de respuesta ────────────────────────────────");
  const li = m3.intake_latency;
  console.log(
    `   Intake latency (n=${li.sample})   p50 ${fmtDuration(li.p50_ms)} · p90 ${fmtDuration(li.p90_ms)} · p99 ${fmtDuration(li.p99_ms)} · max ${fmtDuration(li.max_ms)}`,
  );
  const le = m3.end_to_end_latency;
  console.log(
    `   End-to-end (n=${le.sample})       p50 ${fmtDuration(le.p50_ms)} · p90 ${fmtDuration(le.p90_ms)} · p99 ${fmtDuration(le.p99_ms)} · max ${fmtDuration(le.max_ms)}`,
  );
  console.log("");
  console.log(`   Abiertos                ${m3.open_total.toLocaleString("es-CO")}`);
  console.log(`     on_track              ${m3.deadline_buckets.on_track.toLocaleString("es-CO")} (≥ 48h margen)`);
  console.log(`     at_risk               ${m3.deadline_buckets.at_risk.toLocaleString("es-CO")} (< 48h margen)`);
  console.log(`     overdue               ${m3.deadline_buckets.overdue.toLocaleString("es-CO")} (vencidos)`);
  console.log("");
  console.log(`   Sin OmegaHack           triage humano ≈ minutos-horas, plazos se pierden sin alertas`);
  console.log(
    `   Con OmegaHack           intake p50 ${fmtDuration(li.p50_ms)} · semáforo on_track/at_risk/overdue activo`,
  );
}

function printM1(m1: M1): void {
  console.log("");
  console.log("── M1 · Repetición de casos ────────────────────────────────");
  console.log(`   Total PQRs              ${m1.total_pqrs.toLocaleString("es-CO")}`);
  console.log(`   Agrupados               ${m1.grouped_pqrs.toLocaleString("es-CO")}`);
  console.log(`   Grupos activos (≥2)     ${m1.active_groups.toLocaleString("es-CO")}`);
  console.log(`   Grupos hot              ${m1.hot_groups.toLocaleString("es-CO")}`);
  console.log("");
  console.log(`   Sin OmegaHack           dedup 0.0% · 0 respuestas ahorradas`);
  console.log(
    `   Con OmegaHack           dedup ${fmtPct(m1.dedup_rate)} · ${m1.respuestas_ahorradas.toLocaleString("es-CO")} respuestas ahorradas`,
  );
}

async function main(): Promise<void> {
  const { tenantId } = parseArgs();
  const url = requireEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const db: Db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });

  console.log(`benchmark · tenant ${tenantId}`);
  console.log(`corrido:    ${new Date().toISOString()}`);

  const [m1, m2, m3] = await Promise.all([
    computeM1(db, tenantId),
    computeM2(db, tenantId),
    computeM3(db, tenantId),
  ]);
  printM1(m1);
  printM2(m2);
  printM3(m3);
}

function printM2(m2: M2): void {
  console.log("");
  console.log("── M2 · Cargas innecesarias ────────────────────────────────");
  console.log(`   Total PQRs              ${m2.total_pqrs.toLocaleString("es-CO")}`);
  console.log(`   Con secretaría asignada ${m2.classified_pqrs.toLocaleString("es-CO")}`);
  console.log(`   Con prioridad asignada  ${m2.priority_assigned.toLocaleString("es-CO")}`);
  console.log(
    `   Con tags de alta conf.  ${m2.high_confidence_tagged_pqrs.toLocaleString("es-CO")} (≥ 0.7)`,
  );
  console.log("");
  console.log(`   Sin OmegaHack           auto-routing 0.0% (todo manual)`);
  console.log(
    `   Con OmegaHack           auto-routing ${fmtPct(m2.auto_routing_rate)} · prioridad ${fmtPct(m2.priority_rate)} · tags ${fmtPct(m2.high_confidence_rate)}`,
  );
  if (m2.top_secretarias.length > 0) {
    console.log("");
    console.log("   Top secretarías (volumen):");
    for (const row of m2.top_secretarias) {
      const label = row.nombre ?? row.secretaria_id ?? "(sin asignar)";
      console.log(`     ${row.count.toString().padStart(4)}  ${label}`);
    }
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
});
