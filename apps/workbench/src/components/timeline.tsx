import type { ReactNode } from "react";
import { formatDateTimeCO } from "@/lib/format";

export type TimelineEntry = {
  id: string;
  at: string;
  title: string;
  description?: ReactNode;
  actor?: string | null;
  tone?: "default" | "brand" | "warn" | "danger" | "ok";
};

const DOT_TONE = {
  default: "bg-fg-subtle",
  brand: "bg-brand",
  warn: "bg-at-risk",
  danger: "bg-overdue",
  ok: "bg-ok",
} as const;

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-4 text-xs text-fg-subtle">Sin eventos registrados aún.</p>
    );
  }
  return (
    <ol className="relative ml-2 border-l border-border">
      {entries.map((e) => {
        const tone = e.tone ?? "default";
        return (
          <li key={e.id} className="relative pl-5 pb-5 last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${DOT_TONE[tone]}`}
            />
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-fg">{e.title}</p>
              <time
                className="shrink-0 text-[11px] text-fg-subtle tnum"
                dateTime={e.at}
              >
                {formatDateTimeCO(e.at)}
              </time>
            </div>
            {e.description ? (
              <div className="mt-0.5 text-xs text-fg-muted">{e.description}</div>
            ) : null}
            {e.actor ? (
              <p className="mt-1 text-[11px] text-fg-subtle">por {e.actor}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
