import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { PriorityBadge } from "./priority-badge";
import { ChannelIcon } from "./channel-icon";
import { DeadlineCell } from "./deadline-cell";
import type { QueuePqr } from "@/lib/queries";
import { pqrProgress } from "@/lib/deadline";
import { nextActionFor } from "@/lib/next-action";

const TONE_ACCENT = {
  urgent: "border-l-p0",
  work: "border-l-p1",
  review: "border-l-p2",
  done: "border-l-ok",
  muted: "border-l-border-strong",
} as const;

export function BandejaRow({
  pqr,
  secretariaName,
  comunaLabel,
}: {
  pqr: QueuePqr;
  secretariaName?: string | null;
  comunaLabel?: string | null;
}) {
  const action = nextActionFor(pqr.status);
  const progress = pqrProgress({
    issuedAt: pqr.issued_at,
    deadlineAt: pqr.legal_deadline,
    tipo: pqr.tipo,
  });
  const subject =
    pqr.lead ||
    pqr.display_text ||
    (pqr.tipo
      ? `${pqr.tipo.charAt(0).toUpperCase()}${pqr.tipo.slice(1)} sin resumen`
      : "PQR sin clasificar");

  return (
    <Link
      href={`/pqr/${pqr.id}`}
      className={clsx(
        "group flex items-stretch gap-3 rounded border border-border bg-surface p-3 transition-colors hover:bg-surface-hover",
        "border-l-[3px]",
        TONE_ACCENT[action.tone],
      )}
    >
      <div className="flex flex-col items-center justify-between gap-1 pr-1">
        <PriorityBadge level={pqr.priority_level} />
        <ChannelIcon channel={pqr.channel} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="line-clamp-1 text-sm font-medium text-fg">{subject}</p>
          <span className="shrink-0 font-mono text-[11px] text-fg-subtle tnum">
            {pqr.radicado ?? `#${pqr.id.slice(0, 8)}`}
          </span>
        </div>
        <p className="line-clamp-1 text-[11px] text-fg-muted">
          {[secretariaName, comunaLabel].filter(Boolean).join(" · ") ||
            "Sin enrutar todavía"}
        </p>
        <p className="line-clamp-2 text-xs text-fg-muted">{action.blurb}</p>
      </div>

      <div className="flex w-[180px] shrink-0 flex-col items-end justify-between gap-2">
        <DeadlineCell
          progress={progress}
          deadlineIso={pqr.legal_deadline}
          compact
        />
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand group-hover:translate-x-0.5 group-hover:underline">
          {action.verb}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
