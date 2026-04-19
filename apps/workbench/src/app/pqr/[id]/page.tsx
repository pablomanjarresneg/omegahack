import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusPill } from "@/components/status-pill";
import { ChannelIcon, channelLabel } from "@/components/channel-icon";
import { DeadlineCell } from "@/components/deadline-cell";
import { Timeline, type TimelineEntry } from "@/components/timeline";
import { ActionCard } from "@/components/action-card";
import { getPqrDetail, getPqrTimeline } from "@/lib/queries";
import { pqrProgress } from "@/lib/deadline";
import { nextActionFor } from "@/lib/next-action";
import { formatDateTimeCO } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const AUDIT_TONE: Record<string, TimelineEntry["tone"]> = {
  INSERT: "brand",
  UPDATE: "default",
  DELETE: "danger",
};

export default async function PqrDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const pqr = await getPqrDetail(params.id);
  if (!pqr) notFound();

  const progress = pqrProgress({
    issuedAt: pqr.issued_at,
    deadlineAt: pqr.legal_deadline,
    tipo: pqr.tipo,
  });

  const { events, audits } = await getPqrTimeline(pqr.id);

  const intakeEntry: TimelineEntry = {
    id: "intake",
    at: pqr.issued_at,
    title: `Ingreso por ${channelLabel(pqr.channel)}`,
    description: pqr.source_url ? (
      <a
        href={pqr.source_url}
        target="_blank"
        rel="noreferrer"
        className="text-brand hover:underline"
      >
        origen
      </a>
    ) : (
      "Canal registrado automáticamente."
    ),
    tone: "brand",
  };

  const eventEntries: TimelineEntry[] = events.map((e) => ({
    id: `ev-${e.id}`,
    at: e.created_at,
    title: humanizeEventKind(e.kind),
    description: renderJsonPayload(e.payload),
    tone: "default",
  }));

  const auditEntries: TimelineEntry[] = audits.map((a) => ({
    id: `au-${a.id}`,
    at: a.created_at,
    title: `Auditoría · ${a.operation} ${a.table_name}`,
    description: renderAudit(a),
    tone: AUDIT_TONE[a.operation] ?? "default",
  }));

  const timelineEntries: TimelineEntry[] = [
    intakeEntry,
    ...eventEntries,
    ...auditEntries,
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const subject =
    pqr.lead ||
    pqr.display_text ||
    (pqr.tipo
      ? `${pqr.tipo.charAt(0).toUpperCase()}${pqr.tipo.slice(1)} sin resumen`
      : "PQR sin clasificar");

  return (
    <>
      <Topbar
        title={pqr.radicado ?? `PQR ${pqr.id.slice(0, 8)}`}
        subtitle={`Ingresada ${formatDateTimeCO(pqr.issued_at)}`}
      />
      <div className="border-b border-border bg-surface px-6 py-3">
        <Link
          href="/queue"
          className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Volver a la cola
        </Link>
      </div>

      <main className="grid flex-1 gap-6 p-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <ActionCard action={nextActionFor(pqr.status)} />

          <header className="rounded border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge level={pqr.priority_level} />
              <StatusPill status={pqr.status} />
              <ChannelIcon channel={pqr.channel} withLabel />
              {pqr.tipo ? (
                <span className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-[11px] text-fg-muted">
                  {pqr.tipo}
                </span>
              ) : null}
              {pqr.anonimato ? (
                <span className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-[11px] text-fg-muted">
                  Anónima
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-fg">{subject}</h2>
            {pqr.display_text && pqr.display_text !== pqr.lead ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-fg-muted">
                {pqr.display_text}
              </p>
            ) : null}
          </header>

          <Section title="Hechos">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {pqr.hechos?.trim() || "—"}
            </pre>
          </Section>

          <Section title="Petición concreta">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {pqr.peticion?.trim() || "—"}
            </pre>
          </Section>

          {pqr.raw_text ? (
            <Section title="Texto original">
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-fg-muted">
                {pqr.raw_text}
              </pre>
            </Section>
          ) : null}

          <Section title="Trazabilidad">
            <Timeline entries={timelineEntries} />
          </Section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded border border-border bg-surface p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              Plazo Ley 1755
            </h3>
            <DeadlineCell
              progress={progress}
              deadlineIso={pqr.legal_deadline}
            />
            {pqr.legal_deadline ? (
              <p className="mt-3 text-[11px] text-fg-subtle">
                Vence {formatDateTimeCO(pqr.legal_deadline)}
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-fg-subtle">
                Plazo no calculado todavía.
              </p>
            )}
          </div>

          <MetaCard
            title="Enrutamiento"
            rows={[
              ["Secretaría", pqr.secretaria?.nombre ?? "—"],
              [
                "Comuna",
                pqr.comuna
                  ? pqr.comuna.numero < 100
                    ? `Comuna ${pqr.comuna.numero} — ${pqr.comuna.nombre}`
                    : pqr.comuna.nombre
                  : "—",
              ],
              ["Tipo", pqr.tipo ?? "sin clasificar"],
              ["Canal", channelLabel(pqr.channel)],
            ]}
          />

          <MetaCard
            title="Priorización"
            rows={[
              ["Nivel", pqr.priority_level ?? "—"],
              [
                "Puntaje",
                pqr.priority_score !== null
                  ? pqr.priority_score.toFixed(2)
                  : "—",
              ],
              ["Riesgo tutela", formatTutela(pqr.tutela_risk_score)],
              [
                "Fijada por",
                pqr.priority_locked_by ? "reviewer (manual)" : "automática",
              ],
            ]}
          />

          <MetaCard
            title="Validez formal"
            rows={[
              ["Respeto", fmtBool(pqr.respeto_ok)],
              ["Estructura mínima", structuraLabel(pqr.estructura_minima)],
              ["Anonimato", fmtBool(pqr.anonimato)],
              ["Clasificación", pqr.classification_status],
            ]}
          />
        </aside>
      </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-border bg-surface p-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetaCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {title}
      </h3>
      <dl className="flex flex-col gap-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-fg-subtle">{k}</dt>
            <dd className="truncate text-right text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function humanizeEventKind(kind: string): string {
  const map: Record<string, string> = {
    pqr_received: "Recibida en intake",
    pqr_accepted: "Aceptada por jurídica",
    pqr_assigned: "Asignada a funcionario",
    pqr_transferred: "Trasladada a otra secretaría",
    pqr_bounced: "Devuelta · información incompleta",
    pqr_rejected: "Rechazada · irrespetuosa",
    pqr_draft_created: "Borrador de respuesta creado",
    pqr_approved: "Respuesta aprobada",
    pqr_sent: "Respuesta enviada al ciudadano",
    pqr_closed: "Cerrada",
  };
  return map[kind] ?? kind.replace(/_/g, " ");
}

function renderJsonPayload(payload: unknown): React.ReactNode {
  if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
    return null;
  }
  return (
    <pre className="mt-1 max-h-40 overflow-auto rounded bg-bg-subtle p-2 font-mono text-[11px] leading-tight text-fg-muted">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

function renderAudit(a: {
  before: unknown;
  after: unknown;
  operation: string;
}): React.ReactNode {
  const diff: string[] = [];
  if (a.operation === "UPDATE" && a.before && a.after) {
    const b = a.before as Record<string, unknown>;
    const c = a.after as Record<string, unknown>;
    for (const k of Object.keys(c)) {
      if (JSON.stringify(b[k]) !== JSON.stringify(c[k])) {
        diff.push(`${k}: ${shortJson(b[k])} → ${shortJson(c[k])}`);
      }
    }
  }
  if (diff.length > 0) {
    return (
      <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-fg-muted">
        {diff.slice(0, 8).map((line) => (
          <li key={line} className="truncate">
            {line}
          </li>
        ))}
        {diff.length > 8 ? (
          <li className="italic text-fg-subtle">
            + {diff.length - 8} cambios más
          </li>
        ) : null}
      </ul>
    );
  }
  return null;
}

function shortJson(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 32 ? `${s.slice(0, 29)}…` : s;
}

function fmtBool(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v ? "Sí" : "No";
}

function structuraLabel(v: unknown): string {
  if (!v || typeof v !== "object") return "—";
  const obj = v as Record<string, boolean>;
  const present = Object.entries(obj).filter(([, ok]) => ok).map(([k]) => k);
  if (present.length === 0) return "faltan campos";
  return `${present.length} de ${Object.keys(obj).length}`;
}

function formatTutela(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  const pct = Math.round(score * 100);
  return `${pct}%`;
}
