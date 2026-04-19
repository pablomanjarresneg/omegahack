import type { Database } from "@omega/db/types";
import { getServerSupabase } from "./supabase-server";
import { env } from "./env";

type Pqr = Database["public"]["Tables"]["pqr"]["Row"];
type Secretaria = Database["public"]["Tables"]["secretarias"]["Row"];
type Comuna = Database["public"]["Tables"]["comunas"]["Row"];
type PqrStatus = Database["public"]["Enums"]["pqr_status"];
type PriorityLevel = Database["public"]["Enums"]["priority_level"];
type Channel = Database["public"]["Enums"]["pqr_channel"];

const OPEN_STATUSES: PqrStatus[] = [
  "received",
  "accepted",
  "assigned",
  "in_draft",
  "in_review",
  "approved",
];

const CLOSED_STATUSES: PqrStatus[] = ["sent", "closed"];

export async function listSecretarias(): Promise<Secretaria[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("secretarias")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listComunas(): Promise<Comuna[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("comunas")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .order("numero", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type DashboardStats = {
  total: number;
  open: number;
  closed: number;
  p0Open: number;
  overdue: number;
  sentToday: number;
  byStatus: Array<{ status: PqrStatus; count: number }>;
  byChannel: Array<{ channel: Channel; count: number }>;
  byPriority: Array<{ level: PriorityLevel | "unset"; count: number }>;
  bySecretaria: Array<{ secretariaId: string | null; count: number }>;
  byComuna: Array<{ comunaId: string | null; count: number }>;
};

function countBy<T, K extends string | null>(
  rows: readonly T[],
  key: (row: T) => K,
): Map<K, number> {
  const m = new Map<K, number>();
  for (const row of rows) {
    const k = key(row);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "id, status, channel, priority_level, secretaria_id, comuna_id, legal_deadline, issued_at, updated_at",
    )
    .eq("tenant_id", env.demoTenantId);
  if (error) throw error;

  const rows = (data ?? []) as Array<
    Pick<
      Pqr,
      | "id"
      | "status"
      | "channel"
      | "priority_level"
      | "secretaria_id"
      | "comuna_id"
      | "legal_deadline"
      | "issued_at"
      | "updated_at"
    >
  >;

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const closed = rows.filter((r) => CLOSED_STATUSES.includes(r.status));

  const p0Open = open.filter((r) => r.priority_level === "P0_critica").length;
  const overdue = open.filter(
    (r) => r.legal_deadline && new Date(r.legal_deadline).getTime() < now,
  ).length;
  const sentToday = rows.filter(
    (r) => r.status === "sent" && new Date(r.updated_at).getTime() >= todayStart.getTime(),
  ).length;

  const byStatus = [...countBy(rows, (r) => r.status as PqrStatus).entries()].map(
    ([status, count]) => ({ status, count }),
  );
  const byChannel = [...countBy(rows, (r) => r.channel as Channel).entries()].map(
    ([channel, count]) => ({ channel, count }),
  );
  const byPriority = [
    ...countBy(rows, (r) => (r.priority_level ?? "unset") as PriorityLevel | "unset").entries(),
  ].map(([level, count]) => ({ level, count }));
  const bySecretaria = [...countBy(rows, (r) => r.secretaria_id).entries()].map(
    ([secretariaId, count]) => ({ secretariaId, count }),
  );
  const byComuna = [...countBy(rows, (r) => r.comuna_id).entries()].map(
    ([comunaId, count]) => ({ comunaId, count }),
  );

  return {
    total: rows.length,
    open: open.length,
    closed: closed.length,
    p0Open,
    overdue,
    sentToday,
    byStatus: byStatus.sort((a, b) => b.count - a.count),
    byChannel: byChannel.sort((a, b) => b.count - a.count),
    byPriority,
    bySecretaria: bySecretaria.sort((a, b) => b.count - a.count),
    byComuna: byComuna.sort((a, b) => b.count - a.count),
  };
}

export type RecentPqr = Pick<
  Pqr,
  | "id"
  | "radicado"
  | "status"
  | "channel"
  | "tipo"
  | "priority_level"
  | "lead"
  | "issued_at"
  | "legal_deadline"
  | "secretaria_id"
  | "comuna_id"
>;

export async function getRecentPqrs(limit = 12): Promise<RecentPqr[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "id, radicado, status, channel, tipo, priority_level, lead, issued_at, legal_deadline, secretaria_id, comuna_id",
    )
    .eq("tenant_id", env.demoTenantId)
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RecentPqr[];
}

export type QueuePqr = RecentPqr & {
  priority_score: number | null;
  display_text: string | null;
};

export type QueueFilters = {
  secretariaId?: string | null;
  comunaId?: string | null;
  channel?: Channel | null;
  priorityLevel?: PriorityLevel | null;
  status?: PqrStatus | null;
  sort?: "priority" | "deadline" | "recent";
  limit?: number;
};

export async function listQueue(filters: QueueFilters = {}): Promise<QueuePqr[]> {
  const supabase = getServerSupabase();
  let q = supabase
    .from("pqr")
    .select(
      "id, radicado, status, channel, tipo, priority_level, priority_score, lead, display_text, issued_at, legal_deadline, secretaria_id, comuna_id",
    )
    .eq("tenant_id", env.demoTenantId);

  if (filters.secretariaId) q = q.eq("secretaria_id", filters.secretariaId);
  if (filters.comunaId) q = q.eq("comuna_id", filters.comunaId);
  if (filters.channel) q = q.eq("channel", filters.channel);
  if (filters.priorityLevel) q = q.eq("priority_level", filters.priorityLevel);
  if (filters.status) q = q.eq("status", filters.status);

  const sort = filters.sort ?? "priority";
  if (sort === "priority") {
    q = q
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("issued_at", { ascending: false });
  } else if (sort === "deadline") {
    q = q.order("legal_deadline", { ascending: true, nullsFirst: false });
  } else {
    q = q.order("issued_at", { ascending: false });
  }

  q = q.limit(filters.limit ?? 100);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as QueuePqr[];
}

export async function listActiveQueue(limit = 300): Promise<QueuePqr[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "id, radicado, status, channel, tipo, priority_level, priority_score, lead, display_text, issued_at, legal_deadline, secretaria_id, comuna_id",
    )
    .eq("tenant_id", env.demoTenantId)
    .in("status", [
      "received",
      "accepted",
      "assigned",
      "in_draft",
      "in_review",
      "approved",
    ])
    .order("priority_score", { ascending: false, nullsFirst: false })
    .order("legal_deadline", { ascending: true, nullsFirst: false })
    .order("issued_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as QueuePqr[];
}

export type PqrDetail = Pqr & {
  secretaria: Pick<Secretaria, "id" | "nombre" | "codigo"> | null;
  comuna: Pick<Comuna, "id" | "nombre" | "numero" | "tipo"> | null;
  citizen: Pick<
    Database["public"]["Tables"]["citizens"]["Row"],
    "id" | "nombre" | "email" | "telefono"
  > | null;
};

export async function getPqrDetail(id: string): Promise<PqrDetail | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "*, secretaria:secretarias(id, nombre, codigo), comuna:comunas(id, nombre, numero, tipo), citizen:citizens(id, nombre, email, telefono)",
    )
    .eq("tenant_id", env.demoTenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PqrDetail) ?? null;
}

export type PqrEvent = Database["public"]["Tables"]["pqr_events"]["Row"];
export type PqrAudit = Database["public"]["Tables"]["pqr_audit"]["Row"];
export type ResponseRow = Database["public"]["Tables"]["responses"]["Row"];

export async function getLatestResponse(
  pqrId: string,
): Promise<ResponseRow | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("responses")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .eq("pqr_id", pqrId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ResponseRow | null) ?? null;
}

export type ProblemGroupRow =
  Database["public"]["Tables"]["problem_groups"]["Row"];

export type PriorityCounts = Record<PriorityLevel | "unset", number>;

export type ProblemGroupWithBreakdown = ProblemGroupRow & {
  priority_counts: PriorityCounts;
  top_secretarias: Array<{ id: string; nombre: string; codigo: string; count: number }>;
};

export type ProblemGroupFilters = {
  hotOnly?: boolean;
  priorityLevel?: PriorityLevel | null;
  secretariaId?: string | null;
};

function emptyPriorityCounts(): PriorityCounts {
  return {
    P0_critica: 0,
    P1_alta: 0,
    P2_media: 0,
    P3_baja: 0,
    unset: 0,
  };
}

/**
 * Fetches problem_groups plus per-group priority histograms and the top 2
 * secretarías by member count. One round-trip per section — keeps the
 * /grupos page fast even when the filter drawer narrows the result set.
 */
export async function listProblemGroups(
  limit = 100,
  filters: ProblemGroupFilters = {},
): Promise<ProblemGroupWithBreakdown[]> {
  const supabase = getServerSupabase();
  let q = supabase
    .from("problem_groups")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .order("hot", { ascending: false })
    .order("member_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (filters.hotOnly) q = q.eq("hot", true);

  const { data: groups, error } = await q;
  if (error) throw error;
  const groupRows = (groups ?? []) as ProblemGroupRow[];
  if (groupRows.length === 0) return [];

  const groupIds = groupRows.map((g) => g.id);

  const { data: members, error: memErr } = await supabase
    .from("pqr_problem_group_members")
    .select(
      "group_id, pqr:pqr(id, priority_level, secretaria_id, secretaria:secretarias(id, nombre, codigo))",
    )
    .in("group_id", groupIds);
  if (memErr) throw memErr;

  type MemberRow = {
    group_id: string;
    pqr: {
      id: string;
      priority_level: PriorityLevel | null;
      secretaria_id: string | null;
      secretaria: { id: string; nombre: string; codigo: string } | null;
    } | null;
  };

  const countsByGroup = new Map<string, PriorityCounts>();
  const secretariasByGroup = new Map<
    string,
    Map<string, { id: string; nombre: string; codigo: string; count: number }>
  >();

  for (const raw of (members ?? []) as MemberRow[]) {
    if (!raw.pqr) continue;
    const pc = countsByGroup.get(raw.group_id) ?? emptyPriorityCounts();
    const bucket = raw.pqr.priority_level ?? "unset";
    pc[bucket] += 1;
    countsByGroup.set(raw.group_id, pc);

    if (raw.pqr.secretaria) {
      const sMap =
        secretariasByGroup.get(raw.group_id) ??
        new Map<string, { id: string; nombre: string; codigo: string; count: number }>();
      const existing = sMap.get(raw.pqr.secretaria.id);
      if (existing) {
        existing.count += 1;
      } else {
        sMap.set(raw.pqr.secretaria.id, {
          id: raw.pqr.secretaria.id,
          nombre: raw.pqr.secretaria.nombre,
          codigo: raw.pqr.secretaria.codigo,
          count: 1,
        });
      }
      secretariasByGroup.set(raw.group_id, sMap);
    }
  }

  let enriched: ProblemGroupWithBreakdown[] = groupRows.map((g) => {
    const pc = countsByGroup.get(g.id) ?? emptyPriorityCounts();
    const sMap = secretariasByGroup.get(g.id);
    const top_secretarias = sMap
      ? [...sMap.values()].sort((a, b) => b.count - a.count).slice(0, 2)
      : [];
    return { ...g, priority_counts: pc, top_secretarias };
  });

  if (filters.priorityLevel) {
    enriched = enriched.filter(
      (g) => (g.priority_counts[filters.priorityLevel!] ?? 0) > 0,
    );
  }
  if (filters.secretariaId) {
    enriched = enriched.filter((g) =>
      g.top_secretarias.some((s) => s.id === filters.secretariaId),
    );
  }

  return enriched;
}

export type AuditEntry = Database["public"]["Tables"]["pqr_audit"]["Row"];

export async function listRecentAudit(limit = 100): Promise<AuditEntry[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr_audit")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

export async function getPqrTimeline(pqrId: string): Promise<{
  events: PqrEvent[];
  audits: PqrAudit[];
}> {
  const supabase = getServerSupabase();
  const [eventsRes, auditsRes] = await Promise.all([
    supabase
      .from("pqr_events")
      .select("*")
      .eq("tenant_id", env.demoTenantId)
      .eq("pqr_id", pqrId)
      .order("created_at", { ascending: true }),
    supabase
      .from("pqr_audit")
      .select("*")
      .eq("tenant_id", env.demoTenantId)
      .eq("row_id", pqrId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  if (eventsRes.error) throw eventsRes.error;
  if (auditsRes.error) throw auditsRes.error;
  return {
    events: (eventsRes.data ?? []) as PqrEvent[],
    audits: (auditsRes.data ?? []) as PqrAudit[],
  };
}
