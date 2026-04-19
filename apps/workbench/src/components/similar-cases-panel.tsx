import type { RetrievedChunk } from "@/lib/qa-retrieval";
import { markQaChunkUseful } from "@/app/pqr/[id]/qa-actions";

interface Props {
  pqrId: string;
  results: RetrievedChunk[];
}

/**
 * Lists the top-K similar cases (or canonical responses / internal memos) for
 * the PQR. Score badge + a per-row "Marcar útil / no útil" form that hits
 * qa_feedback. Intentionally server-rendered — no client JS needed, the form
 * submits to the server action which revalidates the page.
 */
export function SimilarCasesPanel({ pqrId, results }: Props): JSX.Element {
  if (results.length === 0) {
    return (
      <div className="rounded border border-border bg-surface p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          Casos similares
        </h3>
        <p className="text-xs text-fg-subtle">
          Sin coincidencias en la base de conocimiento.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        Casos similares
      </h3>
      <ul className="flex flex-col gap-3">
        {results.map((r) => (
          <li
            key={r.chunkId}
            className="rounded border border-border bg-bg-subtle p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source={r.source} />
              <span className="text-[11px] text-fg-subtle">
                {r.sourceKind}
              </span>
              <span className="ml-auto text-[11px] font-mono text-fg-subtle">
                {r.score.toFixed(3)}
              </span>
            </div>
            <h4 className="mt-1 text-sm font-medium text-fg">
              {r.sourceUrl ? (
                <a
                  href={r.sourceUrl}
                  className="text-brand hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.sourceTitle}
                </a>
              ) : (
                r.sourceTitle
              )}
            </h4>
            {r.headingPath.length > 0 ? (
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                {r.headingPath.filter(Boolean).join(" › ")}
              </p>
            ) : null}
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-fg-muted">
              {r.chunkText}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <form action={markQaChunkUseful}>
                <input type="hidden" name="chunkId" value={r.chunkId} />
                <input type="hidden" name="pqrId" value={pqrId} />
                <input type="hidden" name="useful" value="true" />
                <button
                  type="submit"
                  className="rounded border border-border px-2 py-0.5 text-[11px] text-fg-muted hover:bg-surface"
                >
                  Útil
                </button>
              </form>
              <form action={markQaChunkUseful}>
                <input type="hidden" name="chunkId" value={r.chunkId} />
                <input type="hidden" name="pqrId" value={pqrId} />
                <input type="hidden" name="useful" value="false" />
                <button
                  type="submit"
                  className="rounded border border-border px-2 py-0.5 text-[11px] text-fg-muted hover:bg-surface"
                >
                  No útil
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceBadge({
  source,
}: {
  source: RetrievedChunk["source"];
}): JSX.Element {
  const label: Record<RetrievedChunk["source"], string> = {
    nella: "nella",
    pgvector: "pgvector",
    fts: "palabras clave",
  };
  const tone: Record<RetrievedChunk["source"], string> = {
    nella: "border-brand/40 text-brand",
    pgvector: "border-border text-fg-muted",
    fts: "border-border text-fg-subtle",
  };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone[source]}`}
    >
      {label[source]}
    </span>
  );
}
