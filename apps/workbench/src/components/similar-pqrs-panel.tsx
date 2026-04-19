import Link from "next/link";
import { Flame, Link2 } from "lucide-react";
import { PriorityBadge } from "@/components/priority-badge";
import type { SimilarPqrHit, SimilarPqrsResult } from "@/lib/pqr-similarity";

interface Props {
  result: SimilarPqrsResult;
}

/**
 * Shows peer PQRs that talk about the same underlying problem. Backed by
 * nella (bucket `omega-pqr-corpus`) with a pgvector fallback over
 * `pqr_embeddings`. When enough neighbours share a problem_group, we surface
 * a deep-link chip to that group for 1-click navigation.
 */
export function SimilarPqrsPanel({ result }: Props): JSX.Element {
  const { hits, hop, latencyMs } = result;
  const topGroup = summariseTopGroup(hits);

  if (hits.length === 0) {
    return (
      <div className="rounded border border-border bg-surface p-4">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            PQR similares
          </h3>
          <HopBadge hop={hop} latencyMs={latencyMs} />
        </header>
        <p className="text-xs text-fg-subtle">
          Aún no hay PQRs relacionadas en el corpus.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-surface p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          PQR similares
        </h3>
        <HopBadge hop={hop} latencyMs={latencyMs} />
      </header>

      {topGroup ? (
        <Link
          href={`/grupos?group=${topGroup.id}`}
          className="mb-3 inline-flex items-center gap-1.5 rounded border border-p0/40 bg-p0/10 px-2 py-1 text-[11px] font-medium text-p0 hover:bg-p0/15"
        >
          <Flame className="h-3 w-3" aria-hidden />
          {topGroup.count} de estas ya están en “{topGroup.title}”
          <Link2 className="h-3 w-3" aria-hidden />
        </Link>
      ) : null}

      <ul className="flex flex-col gap-3">
        {hits.map((h) => (
          <li
            key={h.pqrId}
            className="rounded border border-border bg-bg-subtle p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <PriorityBadge level={h.priorityLevel} size="xs" />
              <span className="font-mono text-fg-subtle">
                {h.radicado ?? h.pqrId.slice(0, 8)}
              </span>
              <span className="ml-auto font-mono text-fg-subtle">
                {h.score.toFixed(3)}
              </span>
            </div>
            <h4 className="mt-1 text-sm font-medium text-fg">
              <Link
                href={`/pqr/${h.pqrId}`}
                className="text-brand hover:underline"
              >
                {h.title}
              </Link>
            </h4>
            {h.problemGroupTitle ? (
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                Grupo:{" "}
                <Link
                  href={`/grupos?group=${h.problemGroupId ?? ""}`}
                  className="hover:text-fg hover:underline"
                >
                  {h.problemGroupTitle}
                </Link>
              </p>
            ) : null}
            {h.snippet ? (
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-fg-muted">
                {h.snippet}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function summariseTopGroup(
  hits: SimilarPqrHit[],
): { id: string; title: string; count: number } | null {
  const counts = new Map<string, { title: string; count: number }>();
  for (const h of hits) {
    if (!h.problemGroupId) continue;
    const title = h.problemGroupTitle ?? "grupo sin título";
    const existing = counts.get(h.problemGroupId);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(h.problemGroupId, { title, count: 1 });
    }
  }
  const best = [...counts.entries()]
    .map(([id, v]) => ({ id, title: v.title, count: v.count }))
    .sort((a, b) => b.count - a.count)[0];
  if (!best || best.count < 2) return null;
  return best;
}

function HopBadge({
  hop,
  latencyMs,
}: {
  hop: "nella" | "pgvector" | "none";
  latencyMs: number;
}): JSX.Element | null {
  if (hop === "none") return null;
  const tone =
    hop === "nella"
      ? "border-brand/40 text-brand"
      : "border-border text-fg-muted";
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}
      title={`latencia ${latencyMs}ms`}
    >
      {hop}
    </span>
  );
}
