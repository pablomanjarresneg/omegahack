import clsx from "clsx";
import type { Database } from "@omega/db/types";

type Status = Database["public"]["Enums"]["pqr_status"];

const LABELS: Record<Status, string> = {
  received: "Recibida",
  accepted: "Aceptada",
  bounced_incomplete: "Devuelta · incompleta",
  rejected_disrespectful: "Rechazada · irrespetuosa",
  transferred: "Traslado",
  assigned: "Asignada",
  in_draft: "En borrador",
  in_review: "En revisión",
  approved: "Aprobada",
  sent: "Enviada",
  closed: "Cerrada",
};

const TONES: Record<Status, string> = {
  received: "border-p2/40 bg-p2/10 text-p2",
  accepted: "border-brand/40 bg-brand/10 text-brand",
  bounced_incomplete: "border-at-risk/40 bg-at-risk/10 text-at-risk",
  rejected_disrespectful: "border-overdue/40 bg-overdue/10 text-overdue",
  transferred: "border-p3/40 bg-p3/10 text-fg-muted",
  assigned: "border-brand/40 bg-brand/10 text-brand",
  in_draft: "border-p1/40 bg-p1/10 text-p1",
  in_review: "border-p1/40 bg-p1/10 text-p1",
  approved: "border-ok/40 bg-ok/10 text-ok",
  sent: "border-ok/40 bg-ok/10 text-ok",
  closed: "border-border-strong bg-bg-subtle text-fg-muted",
};

export function StatusPill({
  status,
  size = "sm",
}: {
  status: Status;
  size?: "sm" | "xs";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded border font-medium",
        TONES[status],
        size === "xs" ? "px-1.5 py-[1px] text-[10px]" : "px-2 py-0.5 text-[11px]",
      )}
    >
      {LABELS[status]}
    </span>
  );
}
