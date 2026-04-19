import clsx from "clsx";
import type { ProgressResult } from "@omega/deadline-engine";
import { formatDateCO } from "@/lib/format";

const STATUS_LABEL: Record<ProgressResult["status"], string> = {
  on_track: "En plazo",
  at_risk: "En riesgo",
  overdue: "Vencida",
};

const STATUS_BADGE_TONE: Record<ProgressResult["status"], string> = {
  on_track: "border-ok/45 bg-ok/12 text-ok",
  at_risk: "border-at-risk/50 bg-at-risk/15 text-at-risk",
  overdue: "border-overdue/65 bg-[rgba(248,113,113,0.22)] text-overdue",
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
    return <span className="text-[11px] text-fg-subtle">-</span>;
  }

  const { remaining, unit, percentUsed, status } = progress;
  const suffix = unit === "business_days" ? "d habiles" : "h";
  const statusText =
    status === "overdue"
      ? STATUS_LABEL[status]
      : `${remaining.toFixed(unit === "clock_hours" ? 1 : 0)} ${suffix}`;
  const safePercent = Math.max(0, Math.min(100, percentUsed));

  return (
    <div className={clsx("flex flex-col gap-1", compact ? "min-w-[96px]" : "min-w-[124px]")}>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={clsx(
            "inline-flex items-center rounded-md border px-1.5 py-[1px] text-[10px] font-semibold backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]",
            STATUS_BADGE_TONE[status],
          )}
        >
          {statusText}
        </span>
        {!compact ? (
          <span className="text-[10px] text-fg-subtle tnum">
            {formatDateCO(deadlineIso)}
          </span>
        ) : null}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-black/25">
        <div
          className={clsx("h-full rounded-full", BAR_TONE[status])}
          style={{ width: `${safePercent}%` }}
          role="progressbar"
          aria-valuenow={safePercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${STATUS_LABEL[status]}, ${Math.round(safePercent)}% del plazo usado`}
        />
      </div>
    </div>
  );
}
