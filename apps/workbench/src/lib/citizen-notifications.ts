import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@omega/db/types";
import { env } from "./env";
import { formatDateTimeCO } from "./format";

type Status = Database["public"]["Enums"]["pqr_status"];
type PqrChannel = Database["public"]["Enums"]["pqr_channel"];

type CitizenContact = {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
};

type PqrNotificationContext = {
  id: string;
  tenant_id: string;
  radicado: string | null;
  status: Status;
  channel: PqrChannel;
  lead: string | null;
  legal_deadline: string | null;
  citizen: CitizenContact | null;
};

type ContactTarget = {
  channel: "email" | "sms" | "whatsapp";
  destination: string;
  destinationMask: string;
};

const STATUS_COPY: Record<Status, { label: string; body: string }> = {
  received: {
    label: "Recibida",
    body: "La solicitud fue registrada y queda pendiente de revisión inicial.",
  },
  accepted: {
    label: "Aceptada",
    body: "La solicitud cumple los requisitos mínimos y seguirá a asignación.",
  },
  bounced_incomplete: {
    label: "Devuelta por información incompleta",
    body: "Necesitamos información adicional para poder continuar el trámite.",
  },
  rejected_disrespectful: {
    label: "Rechazada por lenguaje irrespetuoso",
    body: "La solicitud no continuará por incumplir las reglas de trato respetuoso.",
  },
  transferred: {
    label: "Trasladada",
    body: "La solicitud fue enviada a la dependencia competente para continuar el trámite.",
  },
  assigned: {
    label: "Asignada",
    body: "La solicitud ya está asignada al equipo responsable.",
  },
  in_draft: {
    label: "En elaboración de respuesta",
    body: "Estamos preparando la respuesta institucional.",
  },
  in_review: {
    label: "En revisión",
    body: "La respuesta está en revisión jurídica antes del envío.",
  },
  approved: {
    label: "Aprobada",
    body: "La respuesta fue aprobada y está lista para ser enviada.",
  },
  sent: {
    label: "Respuesta enviada",
    body: "La respuesta oficial fue enviada por el canal registrado.",
  },
  closed: {
    label: "Cerrada",
    body: "El radicado quedó cerrado en el sistema.",
  },
};

export async function notifyCitizenOfStatus(
  supabase: SupabaseClient<Database>,
  {
    pqrId,
    status,
    statusEventKind,
    statusEventPayload,
  }: {
    pqrId: string;
    status: Status;
    statusEventKind: string;
    statusEventPayload?: Json;
  },
): Promise<void> {
  const { data, error } = await supabase
    .from("pqr")
    .select(
      "id, tenant_id, radicado, status, channel, lead, legal_deadline, citizen:citizens(nombre, email, telefono)",
    )
    .eq("id", pqrId)
    .eq("tenant_id", env.demoTenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("PQR no encontrada para notificación");

  const pqr = data as unknown as PqrNotificationContext;
  const targets = getContactTargets(pqr);
  const statusCopy = STATUS_COPY[status];
  const nowIso = new Date().toISOString();

  if (targets.length === 0) {
    await insertNotificationEvent(supabase, pqrId, "citizen_notification_skipped", {
      status,
      status_label: statusCopy.label,
      status_event_kind: statusEventKind,
      reason: "no_contact_data",
      delivery_status: "skipped",
      created_at: nowIso,
    });
    return;
  }

  const message = buildCitizenMessage(pqr, status, statusEventPayload);
  const subject = `Estado de PQR ${pqr.radicado ?? pqr.id.slice(0, 8)}: ${statusCopy.label}`;

  await insertNotificationEvent(supabase, pqrId, "citizen_notification_sent", {
    status,
    status_label: statusCopy.label,
    status_event_kind: statusEventKind,
    channels: targets.map((target) => ({
      channel: target.channel,
      destination: target.destinationMask,
    })),
    subject,
    message,
    delivery_status: "sent",
    provider: "demo-outbox",
    sent_at: nowIso,
  });
}

export function maskEmail(email: string | null | undefined): string {
  const value = normalize(email);
  if (!value) return "—";
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return value;
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  const value = normalize(phone);
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return value;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function getContactTargets(pqr: PqrNotificationContext): ContactTarget[] {
  const email = normalize(pqr.citizen?.email);
  const phone = normalize(pqr.citizen?.telefono);
  const targets: ContactTarget[] = [];

  if (email) {
    targets.push({
      channel: "email",
      destination: email,
      destinationMask: maskEmail(email),
    });
  }

  if (phone) {
    targets.push({
      channel: pqr.channel === "social_manual" ? "whatsapp" : "sms",
      destination: phone,
      destinationMask: maskPhone(phone),
    });
  }

  return targets;
}

function buildCitizenMessage(
  pqr: PqrNotificationContext,
  status: Status,
  statusEventPayload: Json | undefined,
): string {
  const statusCopy = STATUS_COPY[status];
  const greeting = pqr.citizen?.nombre
    ? `Hola ${firstName(pqr.citizen.nombre)}.`
    : "Hola.";
  const radicado = pqr.radicado ?? pqr.id.slice(0, 8);
  const reason = payloadReason(statusEventPayload);
  const parts = [
    greeting,
    `Tu PQR ${radicado} está en estado: ${statusCopy.label}.`,
    statusCopy.body,
  ];

  if (reason) {
    parts.push(`Motivo registrado: ${reason}`);
  }

  if (pqr.legal_deadline && status !== "closed") {
    parts.push(`Fecha límite estimada: ${formatDateTimeCO(pqr.legal_deadline)}.`);
  }

  parts.push("Conserva este radicado para seguimiento.");
  return parts.join(" ");
}

async function insertNotificationEvent(
  supabase: SupabaseClient<Database>,
  pqrId: string,
  kind: "citizen_notification_sent" | "citizen_notification_skipped",
  payload: Json,
): Promise<void> {
  const { error } = await supabase.from("pqr_events").insert({
    tenant_id: env.demoTenantId,
    pqr_id: pqrId,
    kind,
    payload,
  });
  if (error) throw new Error(error.message);
}

function payloadReason(payload: Json | undefined): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const reason = payload.reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function firstName(name: string): string {
  const trimmed = name.trim();
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
