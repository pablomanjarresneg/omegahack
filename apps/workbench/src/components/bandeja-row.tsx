"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import type { Database } from "@omega/db/types";
import { PriorityBadge } from "./priority-badge";
import { ChannelIcon } from "./channel-icon";
import { DeadlineCell } from "./deadline-cell";
import { EmeraldCheckbox } from "./emerald-checkbox";
import type { QueuePqr } from "@/lib/queries";
import { pqrProgress } from "@/lib/deadline";
import { nextActionFor } from "@/lib/next-action";

type PriorityLevel = Database["public"]["Enums"]["priority_level"];

export type BandejaRowPreview = {
  id: string;
  radicadoLabel: string;
  title: string;
  description: string;
  actionTitle: string;
  actionBlurb: string;
  secretariaName: string | null;
  comunaLabel: string | null;
  legalDeadline: string | null;
  priorityLevel: PriorityLevel | null;
};

export function BandejaRow({
  pqr,
  secretariaName,
  comunaLabel,
  selectable = false,
  selected = false,
  onSelectedChange,
  onQuickPreview,
}: {
  pqr: QueuePqr;
  secretariaName?: string | null;
  comunaLabel?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  onQuickPreview?: (preview: BandejaRowPreview) => void;
}) {
  const action = nextActionFor(pqr.status);
  const progress = pqrProgress({
    issuedAt: pqr.issued_at,
    deadlineAt: pqr.legal_deadline,
    tipo: pqr.tipo,
  });

  const subject = pqr.lead
    ? pqr.lead
    : pqr.tipo
    ? `${pqr.tipo.charAt(0).toUpperCase()}${pqr.tipo.slice(1)} sin resumen`
    : "PQR sin clasificar";
  const description = pqr.display_text || action.blurb || "Sin descripcion disponible";
  const routeLabel =
    [secretariaName, comunaLabel].filter(Boolean).join(" - ") || "Sin enrutar todavia";
  const radicadoLabel = pqr.radicado ?? `#${pqr.id.slice(0, 8)}`;
  const isP0 = pqr.priority_level === "P0_critica";

  return (
    <article
      className={clsx(
        "group relative flex items-stretch gap-3 rounded-xl border border-white/5 bg-[rgba(17,17,17,0.58)] p-3 backdrop-blur-md transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_12px_34px_rgba(0,0,0,0.45)]",
        isP0 &&
          "shadow-[0_0_20px_rgba(239,68,68,0.5),0_0_44px_rgba(239,68,68,0.26),inset_0_0_0_1px_rgba(239,68,68,0.45)]",
      )}
    >
      {selectable ? (
        <div className="flex items-start pt-1">
          <EmeraldCheckbox
            checked={selected}
            onChange={(checked) => onSelectedChange?.(checked)}
            ariaLabel={`Seleccionar ${radicadoLabel}`}
          />
        </div>
      ) : null}

      <div className="flex flex-col items-center justify-between gap-1 pr-1 pt-0.5">
        <PriorityBadge level={pqr.priority_level} size="xs" />
        <ChannelIcon channel={pqr.channel} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link
            href={`/pqr/${pqr.id}`}
            className="line-clamp-1 text-sm font-semibold text-fg transition-colors hover:text-white"
          >
            {subject}
          </Link>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle/50 tnum">
            {radicadoLabel}
          </span>
        </div>
        <p className="line-clamp-1 text-[11px] text-fg-muted">{routeLabel}</p>
        <p className="line-clamp-2 text-xs leading-5 text-fg-muted">{description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              onQuickPreview?.({
                id: pqr.id,
                radicadoLabel,
                title: subject,
                description,
                actionTitle: action.verb,
                actionBlurb: action.blurb,
                secretariaName: secretariaName ?? null,
                comunaLabel: comunaLabel ?? null,
                legalDeadline: pqr.legal_deadline,
                priorityLevel: pqr.priority_level ?? null,
              })
            }
            className="text-[11px] font-medium text-brand opacity-50 transition-opacity duration-200 group-hover:opacity-100"
          >
            Vista rapida
          </button>
        </div>
      </div>

      <div className="flex w-[184px] shrink-0 flex-col items-end justify-between gap-2">
        <DeadlineCell progress={progress} deadlineIso={pqr.legal_deadline} compact />
        <Link
          href={`/pqr/${pqr.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-brand opacity-75 transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:opacity-100"
        >
          {action.verb}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
