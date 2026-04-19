import nextDynamic from "next/dynamic";
import type { Metadata } from "next";
import type { ComponentType } from "react";
import { loadTransparenciaSnapshot } from "@/lib/transparencia";
import { listComunas, listSecretarias } from "@/lib/queries";
import { COMUNA_CENTROIDS } from "@/lib/comuna-centroids";
import { SlaBarChart, type SlaBarDatum } from "@/components/sla-bar-chart";
import type { ComunaMapPoint } from "@/components/comuna-map";

const ComunaMap = nextDynamic(
  () => import("@/components/comuna-map").then((m) => m.ComunaMap),
  { ssr: false, loading: () => <MapSkeleton /> },
) as ComponentType<{
  points: ComunaMapPoint[];
  ariaLabel: string;
}>;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Transparencia · PQR Medellín",
  description:
    "Indicadores públicos de atención a peticiones, quejas y reclamos de la Alcaldía de Medellín. Datos agregados, sin información personal identificable.",
};

export default async function TransparenciaPage() {
  const [snapshot, secretarias, comunas] = await Promise.all([
    loadTransparenciaSnapshot(),
    listSecretarias(),
    listComunas(),
  ]);

  const secretariaById = new Map(secretarias.map((s) => [s.id, s]));
  const comunaById = new Map(comunas.map((c) => [c.id, c]));
  const centroidByNumero = new Map(
    COMUNA_CENTROIDS.map((c) => [c.numero, c] as const),
  );

  const rankingViewModels = snapshot.secretarias
    .map((row) => {
      const sec = row.secretariaId
        ? secretariaById.get(row.secretariaId)
        : null;
      const compliance =
        row.closed > 0 && row.slaBreachRate !== null
          ? Math.max(0, 100 - row.slaBreachRate * 100)
          : null;
      return {
        id: row.secretariaId ?? "unknown",
        codigo: sec?.codigo ?? "—",
        nombre: sec?.nombre ?? "Sin asignación",
        total: row.total,
        closed: row.closed,
        overdueOpen: row.overdueOpen,
        compliance,
        suppressed: row.suppressed,
      };
    })
    .sort((a, b) => (b.compliance ?? -1) - (a.compliance ?? -1));

  const chartData: SlaBarDatum[] = rankingViewModels
    .filter((r) => !r.suppressed && r.compliance !== null)
    .slice(0, 12)
    .map((r) => ({
      key: r.id,
      label: r.codigo,
      compliance: r.compliance ?? 0,
    }));

  const mapPoints: ComunaMapPoint[] = snapshot.comunas
    .map((row) => {
      const com = row.comunaId ? comunaById.get(row.comunaId) : null;
      const centroid = com ? centroidByNumero.get(com.numero) : null;
      if (!com || !centroid) return null;
      return {
        id: com.id,
        label:
          com.numero < 100 ? `Comuna ${com.numero} — ${com.nombre}` : com.nombre,
        lat: centroid.lat,
        lng: centroid.lng,
        pqrCount: row.pqrCount,
        suppressed: row.suppressed,
      } satisfies ComunaMapPoint;
    })
    .filter((p): p is ComunaMapPoint => p !== null);

  const kpis = snapshot.kpis;
  const topBreachName = kpis.topSecretariaBreach?.id
    ? secretariaById.get(kpis.topSecretariaBreach.id)?.nombre ?? "—"
    : "—";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 text-stone-900">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Transparencia PQRSD · Alcaldía de Medellín
        </p>
        <h1 className="text-balance text-3xl font-semibold leading-tight md:text-4xl">
          Cómo la ciudad está respondiendo
        </h1>
        <p className="max-w-2xl text-sm text-stone-600">
          Datos públicos y agregados sobre peticiones, quejas y reclamos. No se
          publica información personal: las celdas con menos de 5 casos se
          suprimen por privacidad (k-anonimato, k = 5).
        </p>
        <nav aria-label="Descarga de datos" className="mt-2 flex flex-wrap gap-3 text-xs">
          <a
            href="/api/transparencia/export?format=csv&scope=secretaria"
            className="rounded border border-emerald-700 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-50"
            download
          >
            Descargar CSV · Secretarías
          </a>
          <a
            href="/api/transparencia/export?format=csv&scope=comuna"
            className="rounded border border-emerald-700 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-50"
            download
          >
            Descargar CSV · Comunas
          </a>
          <a
            href="/api/transparencia/export?format=json&scope=all"
            className="rounded border border-stone-400 px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-50"
            download
          >
            Descargar JSON · Todo
          </a>
        </nav>
      </header>

      <section aria-label="Indicadores clave" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="PQR totales" value={kpis.totalPqr.toLocaleString("es-CO")} />
        <Kpi label="PQR cerradas" value={kpis.closedPqr.toLocaleString("es-CO")} />
        <Kpi
          label="Tiempo medio (h)"
          value={
            kpis.avgResponseHours === null
              ? "—"
              : kpis.avgResponseHours.toFixed(1)
          }
        />
        <Kpi
          label="Vencidas abiertas"
          value={kpis.overdueOpen.toLocaleString("es-CO")}
          tone={kpis.overdueOpen > 0 ? "warn" : "ok"}
        />
      </section>

      <section aria-labelledby="sla-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="sla-heading" className="text-lg font-semibold">
            Cumplimiento SLA por secretaría
          </h2>
          <p className="text-xs text-stone-500">
            Top {chartData.length} con datos publicables
          </p>
        </div>
        <SlaBarChart
          data={chartData}
          titleText="Cumplimiento SLA por secretaría"
          descText={`Porcentaje de PQR cerradas dentro del plazo legal, para las ${chartData.length} secretarías con al menos 5 casos cerrados. ${
            kpis.topSecretariaBreach
              ? `La secretaría con mayor incumplimiento es ${topBreachName} con ${(kpis.topSecretariaBreach.rate * 100).toFixed(1)}% de incumplimiento.`
              : ""
          }`}
        />

        <details className="group rounded border border-stone-200 bg-stone-50 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-stone-700">
            Ver tabla accesible completa
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <caption className="sr-only">
                Ranking de secretarías por cumplimiento SLA
              </caption>
              <thead>
                <tr className="border-b border-stone-300 text-left">
                  <th scope="col" className="px-2 py-1.5">Código</th>
                  <th scope="col" className="px-2 py-1.5">Secretaría</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Total</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Cerradas</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Vencidas</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {rankingViewModels.map((r) => (
                  <tr key={r.id} className="border-b border-stone-200">
                    <td className="px-2 py-1.5 font-mono text-stone-700">{r.codigo}</td>
                    <td className="px-2 py-1.5">{r.nombre}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.suppressed ? "—" : r.total.toLocaleString("es-CO")}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.suppressed ? "—" : r.closed.toLocaleString("es-CO")}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.suppressed ? "—" : r.overdueOpen.toLocaleString("es-CO")}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {r.suppressed
                        ? "suprimido (k<5)"
                        : r.compliance === null
                        ? "—"
                        : `${r.compliance.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section aria-labelledby="map-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="map-heading" className="text-lg font-semibold">
            Densidad por territorio
          </h2>
          <p className="text-xs text-stone-500">
            Tamaño del círculo = volumen de PQR
          </p>
        </div>
        <ComunaMap
          points={mapPoints}
          ariaLabel="Mapa de PQR por comuna. Use la tabla debajo para navegación por teclado."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <caption className="sr-only">
              Tabla navegable con el conteo de PQR por comuna (alternativa al mapa)
            </caption>
            <thead>
              <tr className="border-b border-stone-300 text-left">
                <th scope="col" className="px-2 py-1.5">Comuna / corregimiento</th>
                <th scope="col" className="px-2 py-1.5 text-right">PQR</th>
                <th scope="col" className="px-2 py-1.5 text-right">Cerradas</th>
                <th scope="col" className="px-2 py-1.5 text-right">Tiempo medio (h)</th>
                <th scope="col" className="px-2 py-1.5">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.comunas
                .map((row) => {
                  const com = row.comunaId ? comunaById.get(row.comunaId) : null;
                  return { row, com };
                })
                .filter((e) => e.com !== null)
                .sort(
                  (a, b) => (b.row.pqrCount ?? 0) - (a.row.pqrCount ?? 0),
                )
                .map(({ row, com }) => {
                  if (!com) return null;
                  return (
                    <tr
                      key={com.id}
                      className="border-b border-stone-200 focus-within:bg-stone-50"
                    >
                      <td className="px-2 py-1.5">
                        {com.numero < 100
                          ? `Comuna ${com.numero} — ${com.nombre}`
                          : com.nombre}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.suppressed ? "—" : row.pqrCount.toLocaleString("es-CO")}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.suppressed ? "—" : row.closedCount.toLocaleString("es-CO")}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {row.suppressed || row.avgResponseHours === null
                          ? "—"
                          : row.avgResponseHours.toFixed(1)}
                      </td>
                      <td className="px-2 py-1.5">
                        <a
                          href={`/transparencia/comuna/${com.id}`}
                          className="text-emerald-700 underline underline-offset-2 hover:text-emerald-800 focus:outline focus:outline-2 focus:outline-emerald-700"
                        >
                          Ver
                        </a>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="trend-heading" className="flex flex-col gap-3">
        <h2 id="trend-heading" className="text-lg font-semibold">
          Tendencia mensual
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <caption className="sr-only">Tendencia histórica agregada</caption>
            <thead>
              <tr className="border-b border-stone-300 text-left">
                <th scope="col" className="px-2 py-1.5">Mes</th>
                <th scope="col" className="px-2 py-1.5 text-right">PQR registradas</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.trend.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-2 py-6 text-center text-stone-500"
                  >
                    Sin datos históricos publicables
                  </td>
                </tr>
              ) : (
                snapshot.trend.map((p) => (
                  <tr key={p.month} className="border-b border-stone-200">
                    <td className="px-2 py-1.5">{formatMonth(p.month)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {p.pqrCount.toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-6 border-t border-stone-200 pt-4 text-xs text-stone-500">
        Los datos se actualizan en tiempo real con la operación interna de la
        Alcaldía. Las cifras pueden variar al cierre del día. Documentación
        técnica:{" "}
        <a href="/api/transparencia/export?format=json&scope=all" className="underline">
          API pública JSON
        </a>
        .
      </footer>
    </main>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <div className="rounded border border-stone-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "ok"
            ? "text-emerald-700"
            : tone === "warn"
            ? "text-amber-700"
            : "text-stone-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[420px] w-full animate-pulse rounded border border-stone-200 bg-stone-100"
    />
  );
}

function formatMonth(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "long",
      timeZone: "America/Bogota",
    }).format(d);
  } catch {
    return iso;
  }
}
