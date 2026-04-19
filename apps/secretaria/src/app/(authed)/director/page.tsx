import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { KpiCard } from "@/components/kpi-card";
import { BarList } from "@/components/bar-list";
import { channelLabel } from "@/components/channel-icon";
import { getSession, isDirectorRole } from "@/lib/session";
import { getDirectorBoard } from "@/lib/queries";
import {
  AlertTriangle,
  CheckCheck,
  Clock,
  Inbox,
  ShieldAlert,
} from "lucide-react";

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

export default async function DirectorPage() {
  const session = await getSession();
  if (!session.user?.secretaria_id) return null;
  if (!isDirectorRole(session.user.role)) {
    redirect("/queue");
  }

  const board = await getDirectorBoard(session.user.secretaria_id);
  const slaCompliance =
    board.open > 0
      ? Math.round((1 - board.overdue / board.open) * 100)
      : 100;

  const byStatus = board.byStatus.map((r) => ({
    key: r.status,
    label: STATUS_LABELS[r.status] ?? r.status,
    count: r.count,
  }));
  const byPriority = board.byPriority.map((r) => ({
    key: r.level,
    label: PRIORITY_LABELS[r.level] ?? r.level,
    count: r.count,
  }));
  const byChannel = board.byChannel.map((r) => ({
    key: r.channel,
    label: channelLabel(r.channel),
    count: r.count,
  }));

  const agingItems = [
    {
      key: "0-3",
      label: "0 – 3 días",
      count: board.aging.bucket_0_3,
      note: "frescas",
    },
    {
      key: "4-7",
      label: "4 – 7 días",
      count: board.aging.bucket_4_7,
      note: "seguimiento",
    },
    {
      key: "8-15",
      label: "8 – 15 días",
      count: board.aging.bucket_8_15,
      note: "por vencer",
    },
    {
      key: "15+",
      label: "15+ días",
      count: board.aging.bucket_15_plus,
      note: "críticas",
    },
  ];

  return (
    <>
      <Topbar
        title="Panel director"
        subtitle="Salud operativa de la secretaría · cumplimiento SLA y riesgos"
      />
      <main className="flex flex-1 flex-col gap-6 p-6">
        {(board.p0Open > 0 || board.tutelaRiskCount > 0) ? (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-start gap-3 rounded border border-p0/40 bg-p0/10 px-4 py-3 text-sm text-p0"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                {board.p0Open} PQR P0 abiertas ·{" "}
                {board.tutelaRiskCount} con riesgo de tutela.
              </p>
              <p className="mt-0.5 text-xs text-p0/80">
                Revisa estos casos con prioridad para evitar escalamientos
                judiciales.
              </p>
            </div>
          </div>
        ) : null}

        <section
          aria-label="Indicadores clave"
          className="grid grid-cols-2 gap-3 lg:grid-cols-5"
        >
          <KpiCard
            label="PQR abiertas"
            value={board.open.toLocaleString("es-CO")}
            hint={`${board.total.toLocaleString("es-CO")} totales`}
            icon={<Inbox className="h-4 w-4" />}
            tone="brand"
          />
          <KpiCard
            label="Vencidas"
            value={board.overdue}
            hint="Plazo Ley 1755 superado"
            icon={<Clock className="h-4 w-4" />}
            tone={board.overdue > 0 ? "danger" : "ok"}
          />
          <KpiCard
            label="Cumplimiento SLA"
            value={`${slaCompliance}%`}
            hint="Abiertas dentro de plazo"
            tone={slaCompliance >= 95 ? "ok" : slaCompliance >= 85 ? "warn" : "danger"}
          />
          <KpiCard
            label="Escalamientos"
            value={board.escalationCount}
            hint="Traslados + devoluciones"
            icon={<ShieldAlert className="h-4 w-4" />}
            tone={board.escalationCount > 0 ? "warn" : "default"}
          />
          <KpiCard
            label="Enviadas hoy"
            value={board.sentToday}
            hint="Respuestas entregadas"
            icon={<CheckCheck className="h-4 w-4" />}
            tone="ok"
          />
        </section>

        <section className="rounded border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Backlog por antigüedad</h2>
          <BarList
            items={agingItems}
            total={board.open}
            barClassName="bg-p1/70"
            emptyLabel="Sin PQR abiertas"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Distribución por estado</h2>
            <BarList items={byStatus} total={board.total} />
          </section>
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Prioridad</h2>
            <BarList items={byPriority} total={board.total} barClassName="bg-p1/70" />
          </section>
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">Canal de ingreso</h2>
            <BarList items={byChannel} total={board.total} barClassName="bg-p2/70" />
          </section>
        </div>
      </main>
    </>
  );
}
