import Link from "next/link";
import { ChannelIcon } from "./channel-icon";
import { PriorityBadge } from "./priority-badge";
import { StatusPill } from "./status-pill";
import { formatRelativeCO } from "@/lib/format";
import type { RecentPqr } from "@/lib/queries";

export function RecentIntakeRow({
  pqr,
  secretariaName,
  comunaLabel,
}: {
  pqr: RecentPqr;
  secretariaName?: string | null;
  comunaLabel?: string | null;
}) {
  const title =
    pqr.lead ||
    pqr.radicado ||
    (pqr.tipo ? pqr.tipo.charAt(0).toUpperCase() + pqr.tipo.slice(1) : "PQR sin clasificar");
  return (
    <Link
      href={`/pqr/${pqr.id}`}
      className="flex items-center gap-3 rounded border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-surface-hover"
    >
      <PriorityBadge level={pqr.priority_level} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">{title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-subtle">
          <span className="tnum">
            {pqr.radicado ?? `#${pqr.id.slice(0, 8)}`}
          </span>
          {secretariaName ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{secretariaName}</span>
            </>
          ) : null}
          {comunaLabel ? (
            <>
              <span aria-hidden>·</span>
              <span>{comunaLabel}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ChannelIcon channel={pqr.channel} />
        <StatusPill status={pqr.status} size="xs" />
        <span className="w-20 text-right text-[11px] tabular-nums text-fg-subtle">
          {formatRelativeCO(pqr.issued_at)}
        </span>
      </div>
    </Link>
  );
}
