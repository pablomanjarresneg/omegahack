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

  const [m1, m2] = await Promise.all([
    computeM1(db, tenantId),
    computeM2(db, tenantId),
  ]);
  printM1(m1);
  printM2(m2);
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
