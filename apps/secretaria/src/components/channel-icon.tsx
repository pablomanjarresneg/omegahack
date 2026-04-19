import { Globe, Mail, FileSpreadsheet, Mic, MessageCircle } from "lucide-react";
import type { Database } from "@omega/db/types";

type Channel = Database["public"]["Enums"]["pqr_channel"];

const ICONS = {
  web: Globe,
  email: Mail,
  mercurio_csv: FileSpreadsheet,
  verbal: Mic,
  social_manual: MessageCircle,
} as const satisfies Record<Channel, typeof Globe>;

const LABELS: Record<Channel, string> = {
  web: "Web",
  email: "Correo",
  mercurio_csv: "Mercurio",
  verbal: "Verbal",
  social_manual: "Redes",
};

export function ChannelIcon({
  channel,
  withLabel = false,
}: {
  channel: Channel;
  withLabel?: boolean;
}) {
  const Icon = ICONS[channel];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted"
      title={LABELS[channel]}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {withLabel ? <span>{LABELS[channel]}</span> : null}
      {!withLabel ? <span className="sr-only">{LABELS[channel]}</span> : null}
    </span>
  );
}

export function channelLabel(channel: Channel): string {
  return LABELS[channel];
}
