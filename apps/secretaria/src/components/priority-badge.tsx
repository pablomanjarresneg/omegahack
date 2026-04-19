import clsx from "clsx";
import type { Database } from "@omega/db/types";

type PriorityLevel = Database["public"]["Enums"]["priority_level"];

const LABELS: Record<PriorityLevel, string> = {
  P0_critica: "P0",
  P1_alta: "P1",
  P2_media: "P2",
  P3_baja: "P3",
};

const TONES: Record<PriorityLevel, string> = {
  P0_critica: "border-p0/40 bg-p0/10 text-p0",
  P1_alta: "border-p1/40 bg-p1/10 text-p1",
  P2_media: "border-p2/40 bg-p2/10 text-p2",
  P3_baja: "border-p3/40 bg-p3/10 text-p3",
};

export function PriorityBadge({
  level,
  size = "sm",
}: {
  level: PriorityLevel | null | undefined;
  size?: "sm" | "xs";
}) {
  if (!level) {
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded border border-border bg-bg-subtle font-mono font-medium text-fg-subtle",
          size === "xs" ? "px-1 py-[1px] text-[10px]" : "px-1.5 py-0.5 text-[11px]",
        )}
        aria-label="Sin prioridad asignada"
        title="Sin prioridad asignada"
      >
        —
      </span>
    );
  }
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border font-mono font-semibold",
        TONES[level],
        size === "xs" ? "px-1 py-[1px] text-[10px]" : "px-1.5 py-0.5 text-[11px]",
      )}
      aria-label={`Prioridad ${LABELS[level]}`}
    >
      {LABELS[level]}
    </span>
  );
}
