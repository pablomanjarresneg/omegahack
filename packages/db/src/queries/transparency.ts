// Transparency queries — aggregate-only reads for the public
// `apps/web/transparencia` dashboard.
//
// All functions enforce k-anonymity (k = 5 by default): any bucket with fewer
// than K observations is returned as `{ suppressed: true }` instead of a
// numeric value. The DB views already aggregate so no PII reaches this layer,
// but small cells can still deanonymise (e.g. "3 PQR in Comuna 50 about X")
// — k-anonymity prevents that.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types.js";

/** Minimum cell size for public disclosure (k-anonymity). */
export const K_ANON_THRESHOLD = 5;

/** A cell that may have been suppressed for k-anonymity. */
export type MaybeSuppressed<T> = T | { suppressed: true; reason: "k_anonymity" };

export type ComunaDensityRow = {
  comunaId: string | null;
  pqrCount: number;
  closedCount: number;
  avgResponseHours: number | null;
};

export type SecretariaRankingRow = {
  secretariaId: string | null;
  total: number;
  closed: number;
  overdueOpen: number;
  slaBreachRate: number | null;
};

export type MonthlyTrendRow = {
  month: string; // ISO date (YYYY-MM-DD, always first of month)
  comunaId: string | null;
  pqrCount: number;
};

/**
 * Apply k-anonymity suppression to a row.
 *
 * Returns `{ suppressed: true, reason: "k_anonymity" }` when `count` is below
 * the configured threshold; otherwise returns the original value unchanged.
 *
 * Callers use this in the UI to show "data withheld for privacy" instead of
 * a real number.
 */
export function suppressIfSmall<T>(
  count: number,
  value: T,
  threshold = K_ANON_THRESHOLD,
): MaybeSuppressed<T> {
  if (count < threshold) {
    return { suppressed: true, reason: "k_anonymity" };
  }
  return value;
}

/** Type guard — narrows a MaybeSuppressed to its suppressed variant. */
export function isSuppressed<T>(
  v: MaybeSuppressed<T>,
): v is { suppressed: true; reason: "k_anonymity" } {
  return typeof v === "object" && v !== null && "suppressed" in v && v.suppressed === true;
}

// =============================================================================
// Fetchers
// =============================================================================

type DbClient = SupabaseClient<Database>;

export async function getComunaDensity(
  supabase: DbClient,
  tenantId: string,
): Promise<Array<MaybeSuppressed<ComunaDensityRow> & { comunaId: string | null }>> {
  const { data, error } = await supabase
    .from("transparency_comuna_density")
    .select("comuna_id, pqr_count, closed_count, avg_response_hours")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const full: ComunaDensityRow = {
      comunaId: row.comuna_id,
      pqrCount: Number(row.pqr_count ?? 0),
      closedCount: Number(row.closed_count ?? 0),
      avgResponseHours:
        row.avg_response_hours == null ? null : Number(row.avg_response_hours),
    };
    const maybe = suppressIfSmall(full.pqrCount, full);
    return { ...maybe, comunaId: full.comunaId };
  });
}

export async function getSecretariaRanking(
  supabase: DbClient,
  tenantId: string,
): Promise<
  Array<MaybeSuppressed<SecretariaRankingRow> & { secretariaId: string | null }>
> {
  const { data, error } = await supabase
    .from("transparency_secretaria_ranking")
    .select("secretaria_id, total, closed, overdue_open, sla_breach_rate")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const full: SecretariaRankingRow = {
      secretariaId: row.secretaria_id,
      total: Number(row.total ?? 0),
      closed: Number(row.closed ?? 0),
      overdueOpen: Number(row.overdue_open ?? 0),
      slaBreachRate:
        row.sla_breach_rate == null ? null : Number(row.sla_breach_rate),
    };
    const maybe = suppressIfSmall(full.total, full);
    return { ...maybe, secretariaId: full.secretariaId };
  });
}

export async function getMonthlyTrend(
  supabase: DbClient,
  tenantId: string,
  opts: { sinceMonth?: string; comunaId?: string | null } = {},
): Promise<Array<MaybeSuppressed<MonthlyTrendRow> & { month: string; comunaId: string | null }>> {
  let q = supabase
    .from("transparency_monthly_trend")
    .select("month, comuna_id, pqr_count")
    .eq("tenant_id", tenantId);
  if (opts.sinceMonth) q = q.gte("month", opts.sinceMonth);
  if (opts.comunaId !== undefined) {
    if (opts.comunaId === null) q = q.is("comuna_id", null);
    else q = q.eq("comuna_id", opts.comunaId);
  }
  q = q.order("month", { ascending: true });

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const full: MonthlyTrendRow = {
      month: row.month ?? "",
      comunaId: row.comuna_id,
      pqrCount: Number(row.pqr_count ?? 0),
    };
    const maybe = suppressIfSmall(full.pqrCount, full);
    return {
      ...maybe,
      month: full.month,
      comunaId: full.comunaId,
    };
  });
}
