import { Topbar } from "@/components/topbar";
import { KpiCard } from "@/components/kpi-card";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusPill } from "@/components/status-pill";
import { DeadlineCell } from "@/components/deadline-cell";
import { getSession } from "@/lib/session";
import { getMineStats, listSecretariaQueue } from "@/lib/queries";
import { pqrProgress } from "@/lib/deadline";
import { Clock, FileEdit, Inbox, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MinePage() {
  const session = await getSession();
  if (!session.user?.secretaria_id) return null;

  const secretariaId = session.user.secretaria_id;
  const userId = session.user.id;

  const [stats, rows] = await Promise.all([
    getMineStats(secretariaId, userId),
    listSecretariaQueue({
      secretariaId,
      mineUserId: userId,
      limit: 200,
    }),
  ]);

  return (
    <>
      <Topbar
        title="Asignadas a mí"
        subtitle={`${session.user.nombre} · ${stats.total.toLocaleString("es-CO")} PQR en mi bandeja`}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-x-hidden p-6">
        <section
          aria-label="Resumen personal"
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          <KpiCard
            label="En mi bandeja"
            value={stats.total.toLocaleString("es-CO")}
            hint="Asignadas directamente"
            icon={<Inbox className="h-4 w-4" />}
            tone="brand"
          />
          <KpiCard
            label="En borrador"
            value={stats.inDraft}
            hint="Requieren respuesta"
            icon={<FileEdit className="h-4 w-4" />}
          />
          <KpiCard
            label="En revisión"
            value={stats.inReview}
            hint="Esperando aprobación"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <KpiCard
            label="Vencidas"
            value={stats.overdue}
            hint="Plazo Ley 1755 superado"
            icon={<Clock className="h-4 w-4" />}
            tone={stats.overdue > 0 ? "danger" : "ok"}
          />
        </section>

        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-bg-subtle px-6 py-14 text-center">
            <p className="text-sm font-medium">Sin PQR asignadas</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-fg-subtle">
              Tu director puede asignarte PQR desde la cola del equipo.
            </p>
          </div>
        ) : (
          <div className="min-w-0 overflow-hidden rounded border border-border bg-surface">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                  <th className="w-[64px] px-3 py-2 font-medium">Prio</th>
                  <th className="px-3 py-2 font-medium">Asunto</th>
                  <th className="hidden w-[120px] px-3 py-2 font-medium sm:table-cell">Radicado</th>
                  <th className="w-[112px] px-3 py-2 font-medium">Estado</th>
                  <th className="w-[140px] px-3 py-2 font-medium sm:w-[180px]">Plazo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pqr) => {
                  const progress = pqrProgress({
                    issuedAt: pqr.issued_at,
                    deadlineAt: pqr.legal_deadline,
                    tipo: pqr.tipo,
                  });
                  const subject =
                    pqr.lead ||
                    pqr.display_text ||
                    (pqr.tipo
                      ? `${pqr.tipo.charAt(0).toUpperCase()}${pqr.tipo.slice(1)} sin resumen`
                      : "PQR sin clasificar");
                  return (
                    <tr
                      key={pqr.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface-hover"
                    >
                      <td className="px-3 py-2">
                        <PriorityBadge level={pqr.priority_level} />
                      </td>
                      <td className="min-w-0 px-3 py-2">
                        <span className="line-clamp-2 break-words text-sm text-fg">{subject}</span>
                      </td>
                      <td className="hidden px-3 py-2 tnum text-[11px] text-fg-muted sm:table-cell">
                        <span className="block truncate">
                          {pqr.radicado ?? `#${pqr.id.slice(0, 8)}`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={pqr.status} size="xs" />
                      </td>
                      <td className="px-3 py-2">
                        <DeadlineCell
                          progress={progress}
                          deadlineIso={pqr.legal_deadline}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
