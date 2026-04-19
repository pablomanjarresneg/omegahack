// Server-side helpers for the transparencia dashboard. Wraps the
// k-anonymity-aware transparency queries with the demo tenant scope.

import {
  getComunaDensity,
  getMonthlyTrend,
  getSecretariaRanking,
  isSuppressed,
  type MaybeSuppressed,
} from "@omega/db/queries/transparency";
import { getServerSupabase } from "./supabase-server";
import { env } from "./env";

export type KpiSnapshot = {
  totalPqr: number;
  closedPqr: number;
  avgResponseHours: number | null;
  overdueOpen: number;
  topSecretariaBreach: { id: string | null; rate: number } | null;
};

export type SecretariaRankingVM = {
  secretariaId: string | null;
  total: number;
  closed: number;
  overdueOpen: number;
  slaBreachRate: number | null;
  suppressed: boolean;
};

export type ComunaDensityVM = {
  comunaId: string | null;
  pqrCount: number;
  closedCount: number;
  avgResponseHours: number | null;
  suppressed: boolean;
};

export type MonthlyPoint = {
  month: string;
  pqrCount: number;
};

export async function loadTransparenciaSnapshot(): Promise<{
  kpis: KpiSnapshot;
  secretarias: SecretariaRankingVM[];
  comunas: ComunaDensityVM[];
  trend: MonthlyPoint[];
}> {
  const supabase = getServerSupabase();
  const tenantId = env.demoTenantId;

  const [rankingRaw, comunaRaw, trendRaw] = await Promise.all([
    getSecretariaRanking(supabase, tenantId),
    getComunaDensity(supabase, tenantId),
    getMonthlyTrend(supabase, tenantId),
  ]);

  const secretarias: SecretariaRankingVM[] = rankingRaw.map((row) => {
    if (isSuppressed(row)) {
      return {
        secretariaId: row.secretariaId,
        total: 0,
        closed: 0,
        overdueOpen: 0,
        slaBreachRate: null,
        suppressed: true,
      };
    }
    return {
      secretariaId: row.secretariaId,
      total: row.total,
      closed: row.closed,
      overdueOpen: row.overdueOpen,
      slaBreachRate: row.slaBreachRate,
      suppressed: false,
    };
  });

  const comunas: ComunaDensityVM[] = comunaRaw.map((row) => {
    if (isSuppressed(row)) {
      return {
        comunaId: row.comunaId,
        pqrCount: 0,
        closedCount: 0,
        avgResponseHours: null,
        suppressed: true,
      };
    }
    return {
      comunaId: row.comunaId,
      pqrCount: row.pqrCount,
      closedCount: row.closedCount,
      avgResponseHours: row.avgResponseHours,
      suppressed: false,
    };
  });

  // Roll up monthly trend by month (sum across comunas). Suppressed cells
  // contribute 0 to the roll-up so the trend doesn't leak small buckets.
  const trendByMonth = new Map<string, number>();
  for (const row of trendRaw) {
    const add = isSuppressed(row) ? 0 : row.pqrCount;
    trendByMonth.set(row.month, (trendByMonth.get(row.month) ?? 0) + add);
  }
  const trend: MonthlyPoint[] = [...trendByMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, pqrCount]) => ({ month, pqrCount }));

  // Aggregate KPIs from the ranking (which already ignores rows without secretaría).
  const totalPqr = secretarias.reduce((s, r) => s + r.total, 0);
  const closedPqr = secretarias.reduce((s, r) => s + r.closed, 0);
  const overdueOpen = secretarias.reduce((s, r) => s + r.overdueOpen, 0);
  const avgResponseHours = avgNonNull(comunas.map((c) => c.avgResponseHours));
  const topSecretariaBreach = secretarias
    .filter((s) => !s.suppressed && s.slaBreachRate !== null)
    .sort((a, b) => (b.slaBreachRate ?? 0) - (a.slaBreachRate ?? 0))[0];

  return {
    kpis: {
      totalPqr,
      closedPqr,
      avgResponseHours,
      overdueOpen,
      topSecretariaBreach: topSecretariaBreach
        ? {
            id: topSecretariaBreach.secretariaId,
            rate: topSecretariaBreach.slaBreachRate ?? 0,
          }
        : null,
    },
    secretarias,
    comunas,
    trend,
  };
}

function avgNonNull(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (xs.length === 0) return null;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

export type { MaybeSuppressed };
