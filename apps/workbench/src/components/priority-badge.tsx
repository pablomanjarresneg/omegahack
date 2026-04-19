import clsx from "clsx";
import type { Database } from "@omega/db/types";

type PriorityLevel = Database["public"]["Enums"]["priority_level"];

const LABELS: Record<PriorityLevel, string> = {
  P0_critica: "P0",
  P1_alta: "P1",
  P2_media: "P2",
  P3_baja: "P3",
};

const TOOLTIP_COPY: Record<PriorityLevel, string> = {
  P0_critica: "Urgencia Critica: Riesgo de Tutela o vencimiento inmediato",
  P1_alta: "Prioridad Alta: Requiere atencion hoy",
  P2_media: "Prioridad Media: Tramite estandar",
  P3_baja: "Prioridad Baja: Puede resolverse en cola regular",
};

const TONES: Record<PriorityLevel, string> = {
  P0_critica:
    "border-p0/55 bg-[rgba(248,113,113,0.2)] text-p0 shadow-[0_0_16px_rgba(248,113,113,0.3)]",
  P1_alta:
    "border-p1/55 bg-[rgba(251,146,60,0.2)] text-p1 shadow-[0_0_14px_rgba(251,146,60,0.25)]",
  P2_media:
    "border-p2/55 bg-[rgba(96,165,250,0.2)] text-p2 shadow-[0_0_14px_rgba(96,165,250,0.22)]",
  P3_baja: "border-white/15 bg-white/[0.06] text-fg-muted",
};

export function PriorityBadge({
  level,
  size = "xs",
}: {
  level: PriorityLevel | null | undefined;
  size?: "sm" | "xs";
}) {
  if (!level) {
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded-md border border-white/10 bg-white/[0.03] font-mono font-medium text-fg-subtle backdrop-blur-sm",
          size === "xs" ? "px-1 py-[1px] text-[10px]" : "px-1.5 py-0.5 text-[11px]",
        )}
        aria-label="Sin prioridad asignada"
        title="Sin prioridad asignada"
      >
        -
      </span>
    );
  }

  return (
    <span className="group relative inline-flex">
      <span
        className={clsx(
          "inline-flex items-center rounded-md border font-mono font-semibold backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
          TONES[level],
          size === "xs" ? "px-1 py-[1px] text-[10px]" : "px-1.5 py-0.5 text-[11px]",
        )}
        aria-label={`Prioridad ${LABELS[level]}`}
      >
        {LABELS[level]}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 w-max max-w-[260px] -translate-x-1/2 rounded-md border border-white/10 bg-[rgba(17,17,17,0.95)] px-2 py-1 text-[10px] font-medium leading-4 text-fg opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {TOOLTIP_COPY[level]}
      </span>
    </span>
  );
}
