import clsx from "clsx";
import { ArrowRight, Check } from "lucide-react";
import type { NextAction } from "@/lib/next-action";

const TONE = {
  urgent: {
    wrap: "border-p0/40 bg-p0/5",
    badge: "bg-p0 text-white",
    verb: "bg-p0 text-white hover:bg-p0/90",
  },
  work: {
    wrap: "border-brand/40 bg-brand/5",
    badge: "bg-brand text-brand-fg",
    verb: "bg-brand text-brand-fg hover:bg-brand-hover",
  },
  review: {
    wrap: "border-p2/40 bg-p2/5",
    badge: "bg-p2 text-white",
    verb: "bg-p2 text-white hover:bg-p2/90",
  },
  done: {
    wrap: "border-ok/40 bg-ok/5",
    badge: "bg-ok text-white",
    verb: "bg-ok text-white",
  },
  muted: {
    wrap: "border-border bg-bg-subtle",
    badge: "bg-fg-subtle text-white",
    verb: "bg-fg-muted text-white",
  },
} as const;

export function ActionCard({ action }: { action: NextAction }) {
  const tone = TONE[action.tone];
  const actionable = action.tone !== "done" && action.tone !== "muted";

  return (
    <section
      aria-label="Siguiente acción"
      className={clsx(
        "rounded border-l-[3px] border border-border bg-surface p-5",
        tone.wrap,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                tone.badge,
              )}
            >
              {action.stage}
            </span>
            <h3 className="text-sm font-semibold text-fg">{action.title}</h3>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-fg-muted">{action.blurb}</p>
        </div>
        {actionable ? (
          <button
            type="button"
            disabled
            aria-disabled
            title="Disponible cuando los handlers de escritura se conecten"
            className={clsx(
              "shrink-0 rounded px-3 py-1.5 text-xs font-medium opacity-60",
              tone.verb,
            )}
          >
            <span className="inline-flex items-center gap-1">
              {action.verb}
              <ArrowRight className="h-3 w-3" aria-hidden />
            </span>
          </button>
        ) : null}
      </div>

      {action.checklist.length > 0 ? (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {action.checklist.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-fg-muted">
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
