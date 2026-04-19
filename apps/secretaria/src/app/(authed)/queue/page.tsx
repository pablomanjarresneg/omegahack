import Link from "next/link";
import clsx from "clsx";
import { Topbar } from "@/components/topbar";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusPill } from "@/components/status-pill";
import { ChannelIcon } from "@/components/channel-icon";
import { DeadlineCell } from "@/components/deadline-cell";
import { getSession } from "@/lib/session";
import { listComunas, listSecretariaQueue } from "@/lib/queries";
import { pqrProgress } from "@/lib/deadline";
import type { Database } from "@omega/db/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PriorityLevel = Database["public"]["Enums"]["priority_level"];
type Urgency = "overdue" | "at_risk" | "on_track";

const PRIORITY_SET = new Set<PriorityLevel>([
  "P0_critica",
  "P1_alta",
  "P2_media",
  "P3_baja",
]);
const URGENCY_SET = new Set<Urgency>(["overdue", "at_risk", "on_track"]);

type SP = Record<string, string | string[] | undefined>;

function readTab(sp: SP): "mine" | "team" {
  const v = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  return v === "mine" ? "mine" : "team";
}

function readOpt(sp: SP, key: string): string | null {
  const v = Array.isArray(sp[key]) ? sp[key]?.[0] : sp[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const session = await getSession();
  if (!session.user?.secretaria_id) {
    return null;
  }

  const tab = readTab(searchParams);
  const priorityRaw = readOpt(searchParams, "p");
  const urgencyRaw = readOpt(searchParams, "urgency");
  const priorityLevel = priorityRaw && PRIORITY_SET.has(priorityRaw as PriorityLevel)
    ? (priorityRaw as PriorityLevel)
    : null;
  const urgency = urgencyRaw && URGENCY_SET.has(urgencyRaw as Urgency)
    ? (urgencyRaw as Urgency)
    : null;

  const [rows, comunas] = await Promise.all([
    listSecretariaQueue({
      secretariaId: session.user.secretaria_id,
      mineUserId: tab === "mine" ? session.user.id : null,
      priorityLevel,
      urgency,
    }),
    listComunas(),
  ]);

  const comunaById = new Map(comunas.map((c) => [c.id, c]));

  // Urgency counts (derived from the un-urgency-filtered set for the header).
  const heatMap = summariseUrgency(rows);

  return (
    <>
      <Topbar
        title="Cola del equipo"
        subtitle={`${rows.length.toLocaleString("es-CO")} PQR abiertas · mapa de calor SLA`}
      />
      <TabsBar current={tab} />
      <FiltersBar
        tab={tab}
        priority={priorityLevel}
        urgency={urgency}
        heatMap={heatMap}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-6">
        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-bg-subtle px-6 py-14 text-center">
            <p className="text-sm font-medium">Sin PQR que mostrar</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-fg-subtle">
              Ajusta los filtros o espera a que lleguen nuevas PQR desde el
              intake.
            </p>
          </div>
        ) : (
          <div className="min-w-0 overflow-hidden rounded border border-border bg-surface">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                  <Th className="w-[64px]">Prio</Th>
                  <Th>Asunto</Th>
                  <Th className="hidden w-[120px] lg:table-cell">Radicado</Th>
                  <Th className="w-[112px]">Estado</Th>
                  <Th className="hidden w-[72px] md:table-cell">Canal</Th>
                  <Th className="hidden w-[120px] lg:table-cell">Territorio</Th>
                  <Th className="w-[140px] sm:w-[180px]">Plazo</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pqr) => {
                  const progress = pqrProgress({
                    issuedAt: pqr.issued_at,
                    deadlineAt: pqr.legal_deadline,
                    tipo: pqr.tipo,
                  });
                  const comuna = pqr.comuna_id
                    ? comunaById.get(pqr.comuna_id)
                    : null;
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
                      <Td>
                        <PriorityBadge level={pqr.priority_level} />
                      </Td>
                      <Td className="min-w-0">
                        <span className="line-clamp-2 break-words text-sm text-fg">{subject}</span>
                      </Td>
                      <Td className="hidden tnum text-[11px] text-fg-muted lg:table-cell">
                        <span className="block truncate">
                          {pqr.radicado ?? `#${pqr.id.slice(0, 8)}`}
                        </span>
                      </Td>
                      <Td>
                        <StatusPill status={pqr.status} size="xs" />
                      </Td>
                      <Td className="hidden md:table-cell">
                        <ChannelIcon channel={pqr.channel} />
                      </Td>
                      <Td className="hidden text-xs text-fg-muted lg:table-cell">
                        <span className="block truncate">
                          {comuna
                            ? comuna.numero < 100
                              ? `Comuna ${comuna.numero}`
                              : comuna.nombre
                            : "—"}
                        </span>
                      </Td>
                      <Td>
                        <DeadlineCell
                          progress={progress}
                          deadlineIso={pqr.legal_deadline}
                        />
                      </Td>
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

function summariseUrgency(rows: Array<{
  issued_at: string;
  legal_deadline: string | null;
  tipo: Database["public"]["Enums"]["pqr_tipo"] | null;
}>) {
  let overdue = 0;
  let at_risk = 0;
  let on_track = 0;
  for (const r of rows) {
    const prog = pqrProgress({
      issuedAt: r.issued_at,
      deadlineAt: r.legal_deadline,
      tipo: r.tipo,
    });
    if (!prog) continue;
    if (prog.status === "overdue") overdue += 1;
    else if (prog.status === "at_risk") at_risk += 1;
    else on_track += 1;
  }
  return { overdue, at_risk, on_track };
}

function TabsBar({ current }: { current: "mine" | "team" }) {
  return (
    <nav
      aria-label="Mis PQR vs. cola del equipo"
      className="flex min-w-0 flex-wrap gap-1 border-b border-border bg-surface px-6 py-2 text-xs"
    >
      <TabLink label="Cola del equipo" href="/queue?tab=team" active={current === "team"} />
      <TabLink label="Asignadas a mí" href="/queue?tab=mine" active={current === "mine"} />
    </nav>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "rounded px-3 py-1.5 text-xs transition-colors",
        active
          ? "bg-brand/10 font-medium text-brand"
          : "text-fg-muted hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}

function FiltersBar({
  tab,
  priority,
  urgency,
  heatMap,
}: {
  tab: "mine" | "team";
  priority: PriorityLevel | null;
  urgency: Urgency | null;
  heatMap: { overdue: number; at_risk: number; on_track: number };
}) {
  const base = { tab } as Record<string, string>;
  const heat = (u: Urgency, tone: string, count: number, label: string) => (
    <Link
      href={qs({ ...base, urgency: urgency === u ? "" : u, p: priority ?? "" })}
      aria-pressed={urgency === u}
      className={clsx(
        "flex items-center gap-2 rounded border px-2.5 py-1 text-[11px] transition-colors",
        urgency === u
          ? `${tone} border-current`
          : "border-border text-fg-muted hover:text-fg",
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      <span>{label}</span>
      <span className="tnum font-semibold">{count}</span>
    </Link>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-6 py-2.5">
      <div className="flex min-w-0 flex-wrap gap-1.5" role="group" aria-label="Filtro por urgencia SLA">
        {heat("overdue", "text-overdue", heatMap.overdue, "Vencidas")}
        {heat("at_risk", "text-at-risk", heatMap.at_risk, "En riesgo")}
        {heat("on_track", "text-ok", heatMap.on_track, "En plazo")}
      </div>
      <form action="/queue" method="get" className="ml-auto flex flex-wrap items-center gap-2 text-xs">
        <input type="hidden" name="tab" value={tab} />
        {urgency ? <input type="hidden" name="urgency" value={urgency} /> : null}
        <label className="inline-flex min-w-0 items-center gap-1">
          <span className="text-fg-subtle">Prioridad</span>
          <select
            name="p"
            defaultValue={priority ?? ""}
            className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]"
          >
            <option value="">Todas</option>
            <option value="P0_critica">P0 · crítica</option>
            <option value="P1_alta">P1 · alta</option>
            <option value="P2_media">P2 · media</option>
            <option value="P3_baja">P3 · baja</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-brand px-2.5 py-1 text-[11px] font-medium text-brand-fg hover:bg-brand-hover"
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}

function qs(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== "");
  if (entries.length === 0) return "/queue";
  return `/queue?${new URLSearchParams(entries).toString()}`;
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`.trim()}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`.trim()}>{children}</td>;
}
