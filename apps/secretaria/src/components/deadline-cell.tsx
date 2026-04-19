import clsx from "clsx";
import type { ProgressResult } from "@omega/deadline-engine";
import { formatDateCO } from "@/lib/format";

const STATUS_TONE: Record<ProgressResult["status"], string> = {
  on_track: "text-ok",
  at_risk: "text-at-risk",
  overdue: "text-overdue",
};

const STATUS_LABEL: Record<ProgressResult["status"], string> = {
  on_track: "En plazo",
  at_risk: "En riesgo",
  overdue: "Vencida",
};

const BAR_TONE: Record<ProgressResult["status"], string> = {
  on_track: "bg-ok",
  at_risk: "bg-at-risk",
  overdue: "bg-overdue",
};

export function DeadlineCell({
  progress,
  deadlineIso,
  compact = false,
}: {
  progress: ProgressResult | null;
  deadlineIso: string | null;
  compact?: boolean;
}) {
  if (!progress || !deadlineIso) {
    return <span className="text-[11px] text-fg-subtle">—</span>;
  }
  const { remaining, unit, percentUsed, status } = progress;
  const suffix = unit === "business_days" ? "d hábiles" : "h";
  const label =
    status === "overdue"
      ? "Vencida"
      : `${remaining.toFixed(unit === "clock_hours" ? 1 : 0)} ${suffix}`;
  return (
    <div
      className={clsx(
        "flex min-w-0 flex-col gap-1",
        compact ? "min-w-[88px]" : "min-w-[88px] sm:min-w-[120px]",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={clsx("tnum text-[11px] font-medium", STATUS_TONE[status])}>
          {label}
        </span>
        {!compact ? (
          <span className="hidden text-[10px] text-fg-subtle tnum sm:inline">
            {formatDateCO(deadlineIso)}
          </span>
        ) : null}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={clsx("h-full rounded-full", BAR_TONE[status])}
          style={{ width: `${Math.min(100, percentUsed)}%` }}
          role="progressbar"
          aria-valuenow={percentUsed}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${STATUS_LABEL[status]}, ${percentUsed}% del plazo usado`}
        />
      </div>
    </div>
  );
}
