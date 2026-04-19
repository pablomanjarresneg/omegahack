import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMonthlyTrend, isSuppressed } from "@omega/db/queries/transparency";
import { getServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { loadTransparenciaSnapshot } from "@/lib/transparencia";
import { listComunas } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const comunas = await listComunas();
  const com = comunas.find((c) => c.id === params.id);
  const name = com
    ? com.numero < 100
      ? `Comuna ${com.numero} — ${com.nombre}`
      : com.nombre
    : "Territorio";
  return {
    title: `Transparencia · ${name}`,
    description: `Indicadores agregados de PQR para ${name} en la Alcaldía de Medellín.`,
  };
}

export default async function ComunaDetailPage({ params }: Props) {
  const [{ comunas: overview }, comunas] = await Promise.all([
    loadTransparenciaSnapshot(),
    listComunas(),
  ]);

  const comuna = comunas.find((c) => c.id === params.id);
  if (!comuna) notFound();

  const myRow = overview.find((r) => r.comunaId === comuna.id);

  const supabase = getServerSupabase();
  const trendRaw = await getMonthlyTrend(supabase, env.demoTenantId, {
    comunaId: comuna.id,
  });
  const trend = trendRaw.map((p) =>
    isSuppressed(p)
      ? { month: p.month, pqrCount: null as number | null, suppressed: true }
      : { month: p.month, pqrCount: p.pqrCount, suppressed: false },
  );

  const label =
    comuna.numero < 100 ? `Comuna ${comuna.numero} — ${comuna.nombre}` : comuna.nombre;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10 text-stone-900">
      <nav aria-label="Breadcrumb" className="text-xs text-stone-600">
        <a href="/transparencia" className="underline hover:text-emerald-700">
          Transparencia
        </a>
        <span aria-hidden> / </span>
        <span>{label}</span>
      </nav>

      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          {comuna.tipo === "corregimiento" ? "Corregimiento" : "Comuna"}
        </p>
        <h1 className="text-3xl font-semibold">{label}</h1>
        <p className="text-sm text-stone-600">
          {comuna.barrios.length} barrios · Tenant: Medellín
        </p>
      </header>

      <section
        aria-label="Indicadores del territorio"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <Stat
          label="PQR totales"
          value={
            !myRow || myRow.suppressed
              ? "—"
              : myRow.pqrCount.toLocaleString("es-CO")
          }
        />
        <Stat
          label="Cerradas"
          value={
            !myRow || myRow.suppressed
              ? "—"
              : myRow.closedCount.toLocaleString("es-CO")
          }
        />
        <Stat
          label="Tiempo medio (h)"
          value={
            !myRow || myRow.suppressed || myRow.avgResponseHours === null
              ? "—"
              : myRow.avgResponseHours.toFixed(1)
          }
        />
        <Stat
          label="Barrios"
          value={comuna.barrios.length.toString()}
        />
      </section>

      <section aria-labelledby="trend-heading" className="flex flex-col gap-3">
        <h2 id="trend-heading" className="text-lg font-semibold">
          Tendencia mensual
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Volumen mensual de PQR para {label}</caption>
            <thead>
              <tr className="border-b border-stone-300 text-left">
                <th scope="col" className="px-2 py-1.5">Mes</th>
                <th scope="col" className="px-2 py-1.5 text-right">PQR</th>
              </tr>
            </thead>
            <tbody>
              {trend.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-2 py-6 text-center text-stone-500">
                    Sin datos publicables
                  </td>
                </tr>
              ) : (
                trend.map((p) => (
                  <tr key={p.month} className="border-b border-stone-200">
                    <td className="px-2 py-1.5">{formatMonth(p.month)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {p.suppressed ? "suprimido (k<5)" : p.pqrCount?.toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="barrios-heading" className="flex flex-col gap-3">
        <h2 id="barrios-heading" className="text-lg font-semibold">
          Barrios incluidos
        </h2>
        <ul className="flex flex-wrap gap-2 text-xs">
          {comuna.barrios.map((b) => (
            <li
              key={b}
              className="rounded border border-stone-200 bg-stone-50 px-2 py-1"
            >
              {b}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-stone-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
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
