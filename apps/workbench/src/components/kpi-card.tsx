import clsx from "clsx";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "danger" | "brand";
  icon?: ReactNode;
}) {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
          {label}
        </p>
        {icon ? <div className="text-fg-subtle">{icon}</div> : null}
      </div>
      <p
        className={clsx(
          "mt-2 text-3xl font-semibold tnum leading-none",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-at-risk",
          tone === "danger" && "text-overdue",
          tone === "brand" && "text-brand",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
