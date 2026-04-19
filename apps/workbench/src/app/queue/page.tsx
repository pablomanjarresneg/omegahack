import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { QueueFilterBar, type QueueSort } from "@/components/queue-filter-bar";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusPill } from "@/components/status-pill";
import { ChannelIcon } from "@/components/channel-icon";
import { DeadlineCell } from "@/components/deadline-cell";
import { listComunas, listQueue, listSecretarias } from "@/lib/queries";
import { pqrProgress } from "@/lib/deadline";
import type { Database } from "@omega/db/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Channel = Database["public"]["Enums"]["pqr_channel"];
type PriorityLevel = Database["public"]["Enums"]["priority_level"];
type Status = Database["public"]["Enums"]["pqr_status"];

const CHANNEL_SET = new Set<Channel>([
  "web",
  "email",
  "mercurio_csv",
  "verbal",
  "social_manual",
]);
const PRIORITY_SET = new Set<PriorityLevel>([
  "P0_critica",
  "P1_alta",
  "P2_media",
  "P3_baja",
]);
const STATUS_SET = new Set<Status>([
  "received",
  "accepted",
  "bounced_incomplete",
  "rejected_disrespectful",
  "transferred",
  "assigned",
  "in_draft",
  "in_review",
  "approved",
  "sent",
  "closed",
]);

function parseSearchParams(sp: Record<string, string | string[] | undefined>) {
  const sort = (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort) ?? "priority";
  const normalizedSort: QueueSort =
    sort === "deadline" || sort === "recent" ? sort : "priority";
  const get = (k: string) => {
    const v = Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k];
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const channel = get("channel");
  const priority = get("p");
  const status = get("status");
  return {
    sort: normalizedSort,
    secretariaId: get("secretaria"),
    comunaId: get("comuna"),
    channel: channel && CHANNEL_SET.has(channel as Channel) ? (channel as Channel) : null,
    priorityLevel:
      priority && PRIORITY_SET.has(priority as PriorityLevel)
        ? (priority as PriorityLevel)
        : null,
    status: status && STATUS_SET.has(status as Status) ? (status as Status) : null,
  };
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const selected = parseSearchParams(searchParams);
  const [secretarias, comunas, rows] = await Promise.all([
    listSecretarias(),
    listComunas(),
    listQueue({
      sort: selected.sort,
      secretariaId: selected.secretariaId,
      comunaId: selected.comunaId,
      channel: selected.channel,
      priorityLevel: selected.priorityLevel,
      status: selected.status,
      limit: 200,
    }),
  ]);

  const secretariaById = new Map(secretarias.map((s) => [s.id, s]));
  const comunaById = new Map(comunas.map((c) => [c.id, c]));

  return (
    <>
      <Topbar
        title="Cola de revisión"
        subtitle={`${rows.length.toLocaleString("es-CO")} PQR${rows.length === 1 ? "" : "s"} · ${sortLabel(selected.sort)}`}
      />
      <QueueFilterBar
        selected={selected}
        secretarias={secretarias.map((s) => ({ id: s.id, nombre: s.nombre }))}
        comunas={comunas.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          numero: c.numero,
        }))}
      />

      <main className="flex flex-1 flex-col p-6">
        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-bg-subtle px-6 py-14 text-center">
            <p className="text-sm font-medium">Sin PQR en la cola</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-fg-subtle">
              Ajusta los filtros o espera a que lleguen nuevas PQR desde los canales de ingreso.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-left text-[11px] uppercase tracking-wide text-fg-subtle">
                  <Th className="w-[64px]">Prio</Th>
                  <Th>Asunto</Th>
                  <Th className="w-[120px]">Radicado</Th>
                  <Th className="w-[120px]">Estado</Th>
                  <Th className="w-[72px]">Canal</Th>
                  <Th className="w-[160px]">Secretaría</Th>
                  <Th className="w-[120px]">Territorio</Th>
                  <Th className="w-[180px]">Plazo</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((pqr) => {
                  const progress = pqrProgress({
                    issuedAt: pqr.issued_at,
                    deadlineAt: pqr.legal_deadline,
                    tipo: pqr.tipo,
                  });
                  const secretaria = pqr.secretaria_id
                    ? secretariaById.get(pqr.secretaria_id)
                    : null;
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
                      <Td>
                        <Link
                          href={`/pqr/${pqr.id}`}
                          className="line-clamp-2 text-sm text-fg hover:text-brand"
                        >
                          {subject}
                        </Link>
                      </Td>
                      <Td className="tnum text-[11px] text-fg-muted">
                        {pqr.radicado ?? `#${pqr.id.slice(0, 8)}`}
                      </Td>
                      <Td>
                        <StatusPill status={pqr.status} size="xs" />
                      </Td>
                      <Td>
                        <ChannelIcon channel={pqr.channel} withLabel />
                      </Td>
                      <Td className="truncate text-xs text-fg-muted">
                        {secretaria?.nombre ?? "—"}
                      </Td>
                      <Td className="text-xs text-fg-muted">
                        {comuna
                          ? comuna.numero < 100
                            ? `Comuna ${comuna.numero}`
                            : comuna.nombre
                          : "—"}
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

function sortLabel(sort: QueueSort): string {
  if (sort === "deadline") return "ordenado por plazo";
  if (sort === "recent") return "ordenado por fecha";
  return "ordenado por prioridad";
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 font-medium ${className}`.trim()}>{children}</th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`.trim()}>{children}</td>;
}
