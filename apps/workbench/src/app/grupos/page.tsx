import { Topbar } from "@/components/topbar";
import { GruposFilterBar } from "@/components/grupos-filter-bar";
import { listProblemGroups, listSecretarias } from "@/lib/queries";
import { formatDateTimeCO } from "@/lib/format";
import { Flame, Users } from "lucide-react";
import type { Database } from "@omega/db/types";

type PriorityLevel = Database["public"]["Enums"]["priority_level"];

const PRIORITY_ORDER: Array<{ level: PriorityLevel; label: string; tone: string }> = [
  { level: "P0_critica", label: "P0", tone: "border-p0/40 bg-p0/10 text-p0" },
  { level: "P1_alta", label: "P1", tone: "border-p1/40 bg-p1/10 text-p1" },
  { level: "P2_media", label: "P2", tone: "border-p2/40 bg-p2/10 text-p2" },
  { level: "P3_baja", label: "P3", tone: "border-p3/40 bg-p3/10 text-p3" },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

function readPriority(raw: string | null | undefined): PriorityLevel | null {
  if (!raw) return null;
  if (
    raw === "P0_critica" ||
    raw === "P1_alta" ||
    raw === "P2_media" ||
    raw === "P3_baja"
  ) {
    return raw;
  }
  return null;
}

export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const hotOnly = sp.hot === "1";
  const priorityLevel = readPriority(typeof sp.p === "string" ? sp.p : null);
  const secretariaId =
    typeof sp.secretaria === "string" && sp.secretaria.length > 0
      ? sp.secretaria
      : null;

  const [groups, secretarias] = await Promise.all([
    listProblemGroups(100, { hotOnly, priorityLevel, secretariaId }),
    listSecretarias(),
  ]);

  return (
    <>
      <Topbar
        title="Grupos problema"
        subtitle={`${groups.length.toLocaleString("es-CO")} grupo${groups.length === 1 ? "" : "s"} ${hotOnly ? "hot" : "activo" + (groups.length === 1 ? "" : "s")}`}
      />
      <GruposFilterBar
        selected={{ hotOnly, priorityLevel, secretariaId }}
        secretarias={secretarias.map((s) => ({ id: s.id, nombre: s.nombre }))}
      />
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p className="max-w-3xl text-xs text-fg-muted">
          Clústeres detectados a partir de PQR similares (embeddings +
          geolocalización + nella). Un grupo con <strong>muchos miembros</strong>{" "}
          o marcado como <strong>hot</strong> revela un problema sistémico:
          resolverlo una vez responde a decenas de ciudadanos a la vez.
        </p>

        {groups.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-bg-subtle px-6 py-14 text-center">
            <p className="text-sm font-medium">
              {hotOnly || priorityLevel || secretariaId
                ? "Sin grupos para este filtro"
                : "Sin grupos problema todavía"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-fg-subtle">
              A medida que ingresen PQR similares, el agente de intake las
              agrupa automáticamente.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <li
                key={g.id}
                className="flex flex-col gap-3 rounded border border-border bg-surface p-4"
              >
                <header className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold leading-tight text-fg">
                    {g.canonical_title ?? "Grupo sin título"}
                  </h2>
                  {g.hot ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-p0/40 bg-p0/10 px-1.5 py-0.5 text-[10px] font-medium text-p0">
                      <Flame className="h-3 w-3" aria-hidden />
                      hot
                    </span>
                  ) : null}
                </header>

                {g.resumen ? (
                  <p className="line-clamp-3 text-xs text-fg-muted">
                    {g.resumen}
                  </p>
                ) : null}

                <PriorityStrip counts={g.priority_counts} />

                {g.top_secretarias.length > 0 ? (
                  <p className="text-[11px] text-fg-subtle">
                    {g.top_secretarias
                      .map((s) => `${s.codigo} · ${s.count}`)
                      .join(" · ")}
                  </p>
                ) : null}

                <footer className="mt-auto flex items-center justify-between border-t border-border pt-2 text-[11px] text-fg-subtle">
                  <span className="inline-flex items-center gap-1 tnum">
                    <Users className="h-3 w-3" aria-hidden />
                    {g.member_count.toLocaleString("es-CO")} miembro
                    {g.member_count === 1 ? "" : "s"}
                  </span>
                  <time dateTime={g.updated_at}>
                    {formatDateTimeCO(g.updated_at)}
                  </time>
                </footer>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function PriorityStrip({
  counts,
}: {
  counts: Record<PriorityLevel | "unset", number>;
}) {
  const total = PRIORITY_ORDER.reduce((acc, p) => acc + (counts[p.level] ?? 0), 0);
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="Distribución de prioridad">
      {PRIORITY_ORDER.map((p) => {
        const n = counts[p.level] ?? 0;
        if (n === 0) return null;
        return (
          <span
            key={p.level}
            className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${p.tone}`}
          >
            {p.label} · {n}
          </span>
        );
      })}
    </div>
  );
}
