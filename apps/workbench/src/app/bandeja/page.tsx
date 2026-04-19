import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { BandejaRow } from "@/components/bandeja-row";
import {
  listActiveQueue,
  listComunas,
  listSecretarias,
  type QueuePqr,
} from "@/lib/queries";
import {
  ACTIVE_STAGES,
  STAGE_COPY,
  STAGE_LABEL,
  nextActionFor,
  type Stage,
} from "@/lib/next-action";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BandejaPage() {
  const [rows, secretarias, comunas] = await Promise.all([
    listActiveQueue(300),
    listSecretarias(),
    listComunas(),
  ]);
  const secretariaById = new Map(secretarias.map((s) => [s.id, s]));
  const comunaById = new Map(comunas.map((c) => [c.id, c]));

  const byStage = new Map<Stage, QueuePqr[]>();
  for (const stage of ACTIVE_STAGES) byStage.set(stage, []);
  for (const pqr of rows) {
    const stage = nextActionFor(pqr.status).stage;
    byStage.get(stage)?.push(pqr);
  }

  const p0Triage = (byStage.get("triaje") ?? []).filter(
    (r) => r.priority_level === "P0_critica",
  );
  const total = rows.length;

  return (
    <>
      <Topbar
        title="Bandeja del día"
        subtitle={
          total === 0
            ? "Todo al día ✨"
            : `${total.toLocaleString("es-CO")} PQR${total === 1 ? "" : "s"} activa${total === 1 ? "" : "s"} · priorización automática`
        }
      />

      <main className="flex flex-1 flex-col gap-6 p-6">
        <HeroCard
          total={total}
          byStage={byStage}
          p0TriageCount={p0Triage.length}
        />

        {ACTIVE_STAGES.map((stage) => {
          const stageRows = byStage.get(stage) ?? [];
          return (
            <section key={stage} aria-label={STAGE_LABEL[stage]}>
              <StageHeader
                stage={stage}
                count={stageRows.length}
              />

              {stageRows.length === 0 ? (
                <div className="rounded border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-fg-subtle">
                  Sin PQR en esta etapa.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stageRows.slice(0, 10).map((pqr) => {
                    const c = pqr.comuna_id
                      ? comunaById.get(pqr.comuna_id)
                      : null;
                    return (
                      <li key={pqr.id}>
                        <BandejaRow
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

              {stageRows.length > 10 ? (
                <Link
                  href={linkForStage(stage)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                >
                  Ver los {stageRows.length} en la cola completa
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              ) : null}
            </section>
          );
        })}
      </main>
    </>
  );
}

function HeroCard({
  total,
  byStage,
  p0TriageCount,
}: {
  total: number;
  byStage: Map<Stage, QueuePqr[]>;
  p0TriageCount: number;
}) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-3 rounded border border-ok/40 bg-ok/10 p-4 text-sm text-ok">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Todo al día.</p>
          <p className="text-xs text-ok/80">
            No hay PQR activas en ninguna etapa. Cuando llegue una nueva, aparecerá acá.
          </p>
        </div>
      </div>
    );
  }

  const triage = byStage.get("triaje")?.length ?? 0;
  const heroStage: Stage =
    triage > 0
      ? "triaje"
      : (ACTIVE_STAGES.find((s) => (byStage.get(s)?.length ?? 0) > 0) ?? "triaje");
  const heroCount = byStage.get(heroStage)?.length ?? 0;

  return (
    <div className="rounded border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
            Empieza por aquí
          </p>
          <h2 className="mt-1 text-xl font-semibold text-fg">
            {heroCount} PQR{heroCount === 1 ? "" : "s"} pendiente
            {heroCount === 1 ? "" : "s"} de {STAGE_LABEL[heroStage].toLowerCase()}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            {STAGE_COPY[heroStage].summary}
          </p>
        </div>
        <Link
          href={linkForStage(heroStage)}
          className="shrink-0 rounded bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg hover:bg-brand-hover"
        >
          {STAGE_COPY[heroStage].cta}
        </Link>
      </div>

      {p0TriageCount > 0 ? (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 flex items-start gap-2 rounded border border-p0/40 bg-p0/10 px-3 py-2 text-xs text-p0"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <strong>{p0TriageCount} P0 crítica{p0TriageCount === 1 ? "" : "s"}</strong>{" "}
            en triaje · atender primero
          </span>
        </div>
      ) : null}
    </div>
  );
}

function StageHeader({ stage, count }: { stage: Stage; count: number }) {
  return (
    <header className="mb-2 flex items-baseline justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-fg">
          {STAGE_LABEL[stage]}{" "}
          <span className="font-mono text-xs text-fg-subtle tnum">· {count}</span>
        </h2>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          {STAGE_COPY[stage].summary}
        </p>
      </div>
    </header>
  );
}

function linkForStage(stage: Stage): string {
  const map: Record<Stage, string> = {
    triaje: "/queue?status=received",
    asignacion: "/queue?status=accepted",
    borrador: "/queue?status=assigned",
    revision: "/queue?status=in_review",
    envio: "/queue?status=approved",
    cerrado: "/queue?status=sent",
    descartado: "/queue",
  };
  return map[stage];
}
