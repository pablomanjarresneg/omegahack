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

export type PqrDetail = Pqr & {
  secretaria: Pick<Secretaria, "id" | "nombre" | "codigo"> | null;
  comuna: Pick<Comuna, "id" | "nombre" | "numero" | "tipo"> | null;
};

export async function getPqrDetail(id: string): Promise<PqrDetail | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "*, secretaria:secretarias(id, nombre, codigo), comuna:comunas(id, nombre, numero, tipo)",
    )
    .eq("tenant_id", env.demoTenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PqrDetail) ?? null;
}

export type PqrEvent = Database["public"]["Tables"]["pqr_events"]["Row"];
export type PqrAudit = Database["public"]["Tables"]["pqr_audit"]["Row"];

export type ProblemGroupRow =
  Database["public"]["Tables"]["problem_groups"]["Row"];

export async function listProblemGroups(
  limit = 100,
): Promise<ProblemGroupRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("problem_groups")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .order("hot", { ascending: false })
    .order("member_count", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ProblemGroupRow[];
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
