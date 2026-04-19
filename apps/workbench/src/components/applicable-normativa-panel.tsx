import type { RetrievedChunk } from "@/lib/qa-retrieval";

interface Props {
  results: RetrievedChunk[];
}

/**
 * Shows the top decretos/leyes applicable to this PQR, title + link + a short
 * snippet. The caller filters the retriever to `['decreto','ley']` so this
 * panel is always legal-normativa-only.
 */
export function ApplicableNormativaPanel({ results }: Props): JSX.Element {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        Normativa aplicable
      </h3>
      {results.length === 0 ? (
        <p className="text-xs text-fg-subtle">
          Sin normativa identificada automáticamente.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((r) => (
            <li
              key={r.chunkId}
              className="rounded border border-border bg-bg-subtle p-3"
            >
              <div className="flex items-center gap-2">
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-subtle">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
