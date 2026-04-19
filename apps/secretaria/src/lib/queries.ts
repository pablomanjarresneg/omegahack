import type { Database } from "@omega/db/types";
import { getServerSupabase } from "./supabase-server";
import { env } from "./env";

type Pqr = Database["public"]["Tables"]["pqr"]["Row"];
type Secretaria = Database["public"]["Tables"]["secretarias"]["Row"];
type Comuna = Database["public"]["Tables"]["comunas"]["Row"];
type Functionary = Database["public"]["Tables"]["functionaries"]["Row"];
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

export async function getSecretaria(
  id: string,
): Promise<Secretaria | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("secretarias")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
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

export async function listSecretariaFunctionaries(
  secretariaId: string,
): Promise<Functionary[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("functionaries")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .eq("secretaria_id", secretariaId)
    .eq("active", true)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type QueuePqr = Pick<
  Pqr,
  | "id"
  | "radicado"
  | "status"
  | "channel"
  | "tipo"
  | "priority_level"
  | "priority_score"
  | "lead"
  | "display_text"
  | "issued_at"
  | "legal_deadline"
  | "secretaria_id"
  | "comuna_id"
  | "captured_by"
  | "tutela_risk_score"
>;

export type QueueScope = {
  secretariaId: string;
  mineUserId?: string | null;
  includeClosed?: boolean;
  priorityLevel?: PriorityLevel | null;
  urgency?: "overdue" | "at_risk" | "on_track" | null;
  limit?: number;
};

export async function listSecretariaQueue(
  scope: QueueScope,
): Promise<QueuePqr[]> {
  const supabase = getServerSupabase();
  let q = supabase
    .from("pqr")
    .select(
      "id, radicado, status, channel, tipo, priority_level, priority_score, lead, display_text, issued_at, legal_deadline, secretaria_id, comuna_id, captured_by, tutela_risk_score",
    )
    .eq("tenant_id", env.demoTenantId)
    .eq("secretaria_id", scope.secretariaId);

  if (!scope.includeClosed) q = q.in("status", OPEN_STATUSES);
  if (scope.priorityLevel) q = q.eq("priority_level", scope.priorityLevel);
  if (scope.mineUserId) q = q.eq("captured_by", scope.mineUserId);

  if (scope.urgency === "overdue") {
    q = q.lt("legal_deadline", new Date().toISOString());
  }

  q = q
    .order("priority_score", { ascending: false, nullsFirst: false })
    .order("legal_deadline", { ascending: true, nullsFirst: false })
    .order("issued_at", { ascending: false })
    .limit(scope.limit ?? 250);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as QueuePqr[];
}

export type DirectorBoard = {
  total: number;
  open: number;
  overdue: number;
  sentToday: number;
  escalationCount: number;
  tutelaRiskCount: number;
  p0Open: number;
  byStatus: Array<{ status: PqrStatus; count: number }>;
  byPriority: Array<{ level: PriorityLevel | "unset"; count: number }>;
  byChannel: Array<{ channel: Channel; count: number }>;
  aging: {
    bucket_0_3: number;
    bucket_4_7: number;
    bucket_8_15: number;
    bucket_15_plus: number;
  };
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

export async function getDirectorBoard(
  secretariaId: string,
): Promise<DirectorBoard> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "id, status, channel, priority_level, legal_deadline, issued_at, updated_at, tutela_risk_score",
    )
    .eq("tenant_id", env.demoTenantId)
    .eq("secretaria_id", secretariaId);
  if (error) throw error;

  const rows = (data ?? []) as Array<
    Pick<
      Pqr,
      | "id"
      | "status"
      | "channel"
      | "priority_level"
      | "legal_deadline"
      | "issued_at"
      | "updated_at"
      | "tutela_risk_score"
    >
  >;

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const overdue = open.filter(
    (r) => r.legal_deadline && new Date(r.legal_deadline).getTime() < now,
  ).length;
  const sentToday = rows.filter(
    (r) =>
      r.status === "sent" &&
      new Date(r.updated_at).getTime() >= todayStartMs,
  ).length;
  const p0Open = open.filter((r) => r.priority_level === "P0_critica").length;
  const escalationCount = rows.filter(
    (r) => r.status === "transferred" || r.status === "bounced_incomplete",
  ).length;
  const tutelaRiskCount = open.filter(
    (r) => (r.tutela_risk_score ?? 0) >= 0.5,
  ).length;

  const byStatus = [...countBy(rows, (r) => r.status as PqrStatus).entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  const byPriority = [
    ...countBy(
      rows,
      (r) => (r.priority_level ?? "unset") as PriorityLevel | "unset",
    ).entries(),
  ].map(([level, count]) => ({ level, count }));
  const byChannel = [...countBy(rows, (r) => r.channel as Channel).entries()]
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count);

  // Aging buckets on *open* PQR by business-ish age in calendar days from
  // issued_at. For director view it's fine to use calendar days here.
  const day = 24 * 60 * 60 * 1000;
  let b03 = 0,
    b47 = 0,
    b815 = 0,
    b15 = 0;
  for (const r of open) {
    const ageDays = (now - new Date(r.issued_at).getTime()) / day;
    if (ageDays <= 3) b03 += 1;
    else if (ageDays <= 7) b47 += 1;
    else if (ageDays <= 15) b815 += 1;
    else b15 += 1;
  }

  return {
    total: rows.length,
    open: open.length,
    overdue,
    sentToday,
    escalationCount,
    tutelaRiskCount,
    p0Open,
    byStatus,
    byPriority,
    byChannel,
    aging: {
      bucket_0_3: b03,
      bucket_4_7: b47,
      bucket_8_15: b815,
      bucket_15_plus: b15,
    },
  };
}

export type MineStats = {
  total: number;
  inDraft: number;
  inReview: number;
  overdue: number;
};

export async function getMineStats(
  secretariaId: string,
  userId: string,
): Promise<MineStats> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pqr")
    .select("id, status, legal_deadline")
    .eq("tenant_id", env.demoTenantId)
    .eq("secretaria_id", secretariaId)
    .eq("captured_by", userId);
  if (error) throw error;
  const rows = data ?? [];
  const now = Date.now();
  return {
    total: rows.length,
    inDraft: rows.filter((r) => r.status === "in_draft").length,
    inReview: rows.filter((r) => r.status === "in_review").length,
    overdue: rows.filter(
      (r) =>
        r.status &&
        OPEN_STATUSES.includes(r.status) &&
        r.legal_deadline &&
        new Date(r.legal_deadline).getTime() < now,
    ).length,
  };
}
