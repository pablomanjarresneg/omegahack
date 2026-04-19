import { Topbar } from "@/components/topbar";
import { KpiCard } from "@/components/kpi-card";
import { BarList } from "@/components/bar-list";
import { RecentIntakeRow } from "@/components/recent-intake-row";
import { channelLabel } from "@/components/channel-icon";
import {
  getDashboardStats,
  getRecentPqrs,
  listComunas,
  listSecretarias,
} from "@/lib/queries";
import { AlertTriangle, Clock, Inbox, CheckCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_LABELS: Record<string, string> = {
  received: "Recibida",
  accepted: "Aceptada",
  bounced_incomplete: "Devuelta · incompleta",
  rejected_disrespectful: "Rechazada",
  transferred: "Trasladada",
  assigned: "Asignada",
  in_draft: "En borrador",
  in_review: "En revisión",
  approved: "Aprobada",
  sent: "Enviada",
  closed: "Cerrada",
};

const PRIORITY_LABELS: Record<string, string> = {
  P0_critica: "P0 · crítica",
  P1_alta: "P1 · alta",
  P2_media: "P2 · media",
  P3_baja: "P3 · baja",
  unset: "Sin priorizar",
};

export default async function AlcaldiaPage() {
  const [stats, recent, secretarias, comunas] = await Promise.all([
    getDashboardStats(),
    getRecentPqrs(10),
    listSecretarias(),
    listComunas(),
  ]);

  const secretariaById = new Map(secretarias.map((s) => [s.id, s]));
  const comunaById = new Map(comunas.map((c) => [c.id, c]));

  const bySecretaria = stats.bySecretaria
    .filter((r) => r.secretariaId)
    .slice(0, 8)
    .map((r) => ({
      key: r.secretariaId ?? "?",
      label: secretariaById.get(r.secretariaId ?? "")?.nombre ?? "— sin secretaría",
      count: r.count,
    }));

  const byComuna = stats.byComuna
    .filter((r) => r.comunaId)
    .slice(0, 8)
    .map((r) => {
      const c = comunaById.get(r.comunaId ?? "");
      return {
        key: r.comunaId ?? "?",
        label: c ? `${c.numero < 100 ? `Comuna ${c.numero}` : c.nombre} — ${c.nombre}` : "—",
        count: r.count,
      };
    });

  const byStatus = stats.byStatus.map((r) => ({
    key: r.status,
    label: STATUS_LABELS[r.status] ?? r.status,
    count: r.count,
  }));

  const byPriority = stats.byPriority.map((r) => ({
    key: r.level,
    label: PRIORITY_LABELS[r.level] ?? r.level,
    count: r.count,
  }));

  const byChannel = stats.byChannel.map((r) => ({
    key: r.channel,
    label: channelLabel(r.channel),
    count: r.count,
  }));

  const slaCompliance =
    stats.open > 0
      ? Math.round((1 - stats.overdue / stats.open) * 100)
      : 100;

  return (
    <>
      <Topbar
        title="Panel Alcaldía"
        subtitle="Operación PQRSD · Secretaría de Desarrollo Económico · tiempo real"
      />

      <main className="flex flex-1 flex-col gap-6 p-6">
        {stats.p0Open > 0 ? (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-3 rounded border border-p0/40 bg-p0/10 px-4 py-3 text-sm text-p0"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                {stats.p0Open} PQR{stats.p0Open === 1 ? "" : "s"} P0 abiertas requieren atención inmediata.
              </p>
              <p className="mt-0.5 text-xs text-p0/80">
                Priorización crítica por riesgo de tutela o impacto en población vulnerable.
              </p>
            </div>
          </div>
        ) : null}

        <section aria-label="Indicadores clave" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            label="PQR abiertas"
            value={stats.open.toLocaleString("es-CO")}
            hint={`${stats.total.toLocaleString("es-CO")} totales en el sistema`}
            icon={<Inbox className="h-4 w-4" />}
            tone="brand"
          />
          <KpiCard
            label="P0 críticas"
            value={stats.p0Open}
            hint="Abiertas · requieren escalamiento"
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={stats.p0Open > 0 ? "danger" : "default"}
          />
          <KpiCard
            label="Vencidas"
            value={stats.overdue}
            hint="Plazo Ley 1755 superado"
            icon={<Clock className="h-4 w-4" />}
            tone={stats.overdue > 0 ? "warn" : "ok"}
          />
          <KpiCard
            label="Cumplimiento SLA"
            value={`${slaCompliance}%`}
            hint="Abiertas dentro de plazo"
            tone={slaCompliance >= 95 ? "ok" : slaCompliance >= 85 ? "warn" : "danger"}
          />
          <KpiCard
            label="Enviadas hoy"
            value={stats.sentToday}
            hint="Respuestas entregadas"
            icon={<CheckCheck className="h-4 w-4" />}
            tone="ok"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded border border-border bg-surface p-4 xl:col-span-2">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Ingreso reciente</h2>
              <span className="text-[11px] text-fg-subtle">
                Últimas {recent.length} PQR
              </span>
            </header>
            {recent.length === 0 ? (
              <EmptyState
                title="Sin PQR aún"
                description="Los canales de ingreso (web, correo, verbal, redes) enviarán PQR aquí cuando lleguen."
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {recent.map((pqr) => {
                  const c = pqr.comuna_id ? comunaById.get(pqr.comuna_id) : null;
                  return (
                    <li key={pqr.id}>
                      <RecentIntakeRow
                        pqr={pqr}
                        secretariaName={
                          pqr.secretaria_id
                            ? secretariaById.get(pqr.secretaria_id)?.nombre
                            : null
                        }
                        comunaLabel={
                          c
                            ? c.numero < 100
                              ? `Comuna ${c.numero}`
                              : c.nombre
                            : null
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Distribución por estado</h2>
            <BarList items={byStatus} total={stats.total} />
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Prioridad</h2>
            <BarList items={byPriority} total={stats.total} barClassName="bg-p1/70" />
          </section>
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Canal de ingreso</h2>
            <BarList items={byChannel} total={stats.total} barClassName="bg-p2/70" />
          </section>
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Top secretarías</h2>
            <BarList
              items={bySecretaria}
              total={stats.total}
              barClassName="bg-brand/70"
              emptyLabel="Sin asignación a secretaría aún"
            />
          </section>
        </div>

        <section className="rounded border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Territorio · top comunas / corregimientos</h2>
          <BarList
            items={byComuna}
            total={stats.total}
            barClassName="bg-p3/70"
            emptyLabel="Sin geolocalización de PQR aún"
          />
        </section>
      </main>
    </>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-border bg-bg-subtle px-4 py-10 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="mt-1 max-w-md text-xs text-fg-subtle">{description}</p>
    </div>
  );
}
