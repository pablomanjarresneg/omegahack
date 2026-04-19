// Public export endpoint for the transparencia dashboard.
//
// Aggregates only. Rows that the k-anonymity layer marked as suppressed are
// returned with null cells so downstream consumers can still see the entity
// exists but can't reconstruct the count.
//
//   GET /api/transparencia/export?format=csv|json&scope=secretaria|comuna|trend|all
//
// Scope defaults to `all`. Format defaults to `json`.

import { NextResponse, type NextRequest } from "next/server";
import { loadTransparenciaSnapshot } from "@/lib/transparencia";
import { listComunas, listSecretarias } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Scope = "secretaria" | "comuna" | "trend" | "all";
type Format = "csv" | "json";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const scope = (url.searchParams.get("scope") ?? "all") as Scope;
  const format = (url.searchParams.get("format") ?? "json") as Format;

  if (!isScope(scope)) {
    return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  }
  if (!isFormat(format)) {
    return NextResponse.json({ error: "invalid format" }, { status: 400 });
  }

  const [snapshot, secretarias, comunas] = await Promise.all([
    loadTransparenciaSnapshot(),
    listSecretarias(),
    listComunas(),
  ]);

  const secretariaById = new Map(secretarias.map((s) => [s.id, s]));
  const comunaById = new Map(comunas.map((c) => [c.id, c]));

  const payload = {
    generated_at: new Date().toISOString(),
    disclaimer:
      "Datos agregados. Celdas con menos de 5 casos se suprimen por privacidad (k-anon).",
    kpis: snapshot.kpis,
    secretaria:
      scope === "secretaria" || scope === "all"
        ? snapshot.secretarias.map((r) => ({
            secretaria_id: r.secretariaId,
            codigo: r.secretariaId
              ? secretariaById.get(r.secretariaId)?.codigo ?? null
              : null,
            nombre: r.secretariaId
              ? secretariaById.get(r.secretariaId)?.nombre ?? null
              : null,
            suppressed: r.suppressed,
            total: r.suppressed ? null : r.total,
            closed: r.suppressed ? null : r.closed,
            overdue_open: r.suppressed ? null : r.overdueOpen,
            sla_breach_rate: r.suppressed ? null : r.slaBreachRate,
          }))
        : undefined,
    comuna:
      scope === "comuna" || scope === "all"
        ? snapshot.comunas.map((r) => ({
            comuna_id: r.comunaId,
            numero: r.comunaId ? comunaById.get(r.comunaId)?.numero ?? null : null,
            nombre: r.comunaId ? comunaById.get(r.comunaId)?.nombre ?? null : null,
            suppressed: r.suppressed,
            pqr_count: r.suppressed ? null : r.pqrCount,
            closed_count: r.suppressed ? null : r.closedCount,
            avg_response_hours: r.suppressed ? null : r.avgResponseHours,
          }))
        : undefined,
    trend:
      scope === "trend" || scope === "all"
        ? snapshot.trend.map((p) => ({ month: p.month, pqr_count: p.pqrCount }))
        : undefined,
  };

  if (format === "json") {
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="transparencia-${scope}-${today()}.json"`,
      },
    });
  }

  // CSV — one table per scope. For scope=all we emit the first non-empty table.
  const csv = toCsv(scope, payload);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transparencia-${scope}-${today()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function isScope(s: string): s is Scope {
  return s === "secretaria" || s === "comuna" || s === "trend" || s === "all";
}
function isFormat(s: string): s is Format {
  return s === "csv" || s === "json";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Row = Record<string, string | number | boolean | null | undefined>;

function toCsv(scope: Scope, payload: {
  secretaria?: Row[];
  comuna?: Row[];
  trend?: Row[];
}): string {
  const effective = (scope === "all" ? "secretaria" : scope) as
    | "secretaria"
    | "comuna"
    | "trend";
  const rows = payload[effective];
  if (!rows || rows.length === 0) return "";
  const first = rows[0];
  if (!first) return "";
  const headers = Object.keys(first);
  const escape = (v: Row[string]) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}
