import clsx from "clsx";
import { Check } from "lucide-react";
import type { NextAction } from "@/lib/next-action";

const TONE = {
  urgent: "text-p0",
  work: "text-brand",
  review: "text-p2",
  done: "text-ok",
  muted: "text-fg-muted",
} as const;

const BADGE = {
  urgent: "bg-p0 text-white",
  work: "bg-brand text-brand-fg",
  review: "bg-p2 text-white",
  done: "bg-ok text-white",
  muted: "bg-fg-subtle text-white",
} as const;

export function ActionCard({ action }: { action: NextAction }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            BADGE[action.tone],
          )}
        >
          {action.stage}
        </span>
        <h3 className={clsx("text-sm font-semibold", TONE[action.tone])}>
          {action.title}
        </h3>
      </div>
      <p className="mt-1 max-w-2xl text-xs text-fg-muted">{action.blurb}</p>
      {action.checklist.length > 0 ? (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {action.checklist.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-xs text-fg-muted"
            >
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
