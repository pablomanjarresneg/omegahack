"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { buildDraftTemplate } from "@/lib/draft-template";
import { notifyCitizenOfStatus } from "@/lib/citizen-notifications";
import type { Database, Json } from "@omega/db/types";

type Status = Database["public"]["Enums"]["pqr_status"];

async function transitionStatus(
  pqrId: string,
  to: Status,
  event: { kind: string; payload?: Json },
): Promise<void> {
  const supabase = getServerSupabase();
  const { error: updateError } = await supabase
    .from("pqr")
    .update({ status: to })
    .eq("id", pqrId)
    .eq("tenant_id", env.demoTenantId);
  if (updateError) throw new Error(updateError.message);

  const { error: eventError } = await supabase.from("pqr_events").insert({
    tenant_id: env.demoTenantId,
    pqr_id: pqrId,
    kind: event.kind,
    payload: event.payload ?? {},
  });
  if (eventError) throw new Error(eventError.message);

  await notifyCitizenOfStatus(supabase, {
    pqrId,
    status: to,
    statusEventKind: event.kind,
    statusEventPayload: event.payload,
  });

  revalidatePath("/bandeja");
  revalidatePath("/queue");
  revalidatePath("/alcaldia");
  revalidatePath(`/pqr/${pqrId}`);
}

export async function acceptPqr(pqrId: string): Promise<void> {
  await transitionStatus(pqrId, "accepted", { kind: "pqr_accepted" });
}

export async function bouncePqr(
  pqrId: string,
  reason: string,
): Promise<void> {
  await transitionStatus(pqrId, "bounced_incomplete", {
    kind: "pqr_bounced",
    payload: { reason },
  });
}

export async function rejectPqr(
  pqrId: string,
  reason: string,
): Promise<void> {
  await transitionStatus(pqrId, "rejected_disrespectful", {
    kind: "pqr_rejected",
    payload: { reason },
  });
}

export async function transferPqr(
  pqrId: string,
  secretariaId: string,
): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("pqr")
    .update({ secretaria_id: secretariaId, status: "transferred" })
    .eq("id", pqrId)
    .eq("tenant_id", env.demoTenantId);
  if (error) throw new Error(error.message);

  const { error: eventError } = await supabase.from("pqr_events").insert({
    tenant_id: env.demoTenantId,
    pqr_id: pqrId,
    kind: "pqr_transferred",
    payload: { to_secretaria: secretariaId },
  });
  if (eventError) throw new Error(eventError.message);

  await notifyCitizenOfStatus(supabase, {
    pqrId,
    status: "transferred",
    statusEventKind: "pqr_transferred",
    statusEventPayload: { to_secretaria: secretariaId },
  });

  revalidatePath("/bandeja");
  revalidatePath("/queue");
  revalidatePath("/alcaldia");
  revalidatePath(`/pqr/${pqrId}`);
}

export async function assignPqr(pqrId: string): Promise<void> {
  await transitionStatus(pqrId, "assigned", { kind: "pqr_assigned" });
}

export async function generateDraft(pqrId: string): Promise<void> {
  const supabase = getServerSupabase();

  const { data: pqr, error: readError } = await supabase
    .from("pqr")
    .select(
      "id, radicado, tipo, lead, hechos, peticion, display_text, issued_at, legal_deadline",
    )
    .eq("id", pqrId)
    .eq("tenant_id", env.demoTenantId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!pqr) throw new Error("PQR no encontrada");

  const { body, citations } = buildDraftTemplate({
    radicado: pqr.radicado,
    tipo: pqr.tipo,
    lead: pqr.lead,
    hechos: pqr.hechos,
    peticion: pqr.peticion,
    issuedAt: pqr.issued_at,
    legalDeadline: pqr.legal_deadline,
  });

  const { data: existing, error: existingError } = await supabase
    .from("responses")
    .select("id")
    .eq("pqr_id", pqrId)
    .eq("tenant_id", env.demoTenantId)
    .eq("kind", "draft")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error: updateError } = await supabase
      .from("responses")
      .update({ body, citations })
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);
  } else {
    const { error: insertError } = await supabase.from("responses").insert({
      tenant_id: env.demoTenantId,
      pqr_id: pqrId,
      kind: "draft",
      body,
      citations,
    });
    if (insertError) throw new Error(insertError.message);
  }

  const { error: statusError } = await supabase
    .from("pqr")
    .update({ status: "in_draft" })
    .eq("id", pqrId)
    .eq("tenant_id", env.demoTenantId);
  if (statusError) throw new Error(statusError.message);

  const { error: eventError } = await supabase.from("pqr_events").insert({
    tenant_id: env.demoTenantId,
    pqr_id: pqrId,
    kind: "pqr_draft_created",
    payload: { citations_count: citations.length },
  });
  if (eventError) throw new Error(eventError.message);

  await notifyCitizenOfStatus(supabase, {
    pqrId,
    status: "in_draft",
    statusEventKind: "pqr_draft_created",
    statusEventPayload: { citations_count: citations.length },
  });

  revalidatePath("/bandeja");
  revalidatePath("/queue");
  revalidatePath(`/pqr/${pqrId}`);
}

export async function saveDraftBody(
  pqrId: string,
  body: string,
): Promise<void> {
  const supabase = getServerSupabase();
  const { data: draft, error: readError } = await supabase
    .from("responses")
    .select("id")
    .eq("pqr_id", pqrId)
    .eq("tenant_id", env.demoTenantId)
    .eq("kind", "draft")
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!draft) {
    await generateDraft(pqrId);
    return saveDraftBody(pqrId, body);
  }
  const { error: updateError } = await supabase
    .from("responses")
    .update({ body })
    .eq("id", draft.id);
  if (updateError) throw new Error(updateError.message);
  revalidatePath(`/pqr/${pqrId}`);
}

export async function requestReview(pqrId: string): Promise<void> {
  await transitionStatus(pqrId, "in_review", {
    kind: "pqr_review_requested",
  });
}

export async function approveDraft(pqrId: string): Promise<void> {
  const supabase = getServerSupabase();

  const { data: draft, error: readError } = await supabase
    .from("responses")
    .select("id, body, citations")
    .eq("pqr_id", pqrId)
    .eq("tenant_id", env.demoTenantId)
    .eq("kind", "draft")
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!draft) throw new Error("No hay borrador para aprobar");

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("responses")
    .update({ kind: "final", approved_at: nowIso })
    .eq("id", draft.id);
  if (updateError) throw new Error(updateError.message);

  const { error: statusError } = await supabase
    .from("pqr")
    .update({ status: "approved" })
    .eq("id", pqrId)
    .eq("tenant_id", env.demoTenantId);
  if (statusError) throw new Error(statusError.message);

  const eventPayload: Json = {
    citations_count: Array.isArray(draft.citations)
      ? draft.citations.length
      : 0,
  };

  const { error: eventError } = await supabase.from("pqr_events").insert({
    tenant_id: env.demoTenantId,
    pqr_id: pqrId,
    kind: "pqr_approved",
    payload: eventPayload,
  });
  if (eventError) throw new Error(eventError.message);

  await notifyCitizenOfStatus(supabase, {
    pqrId,
    status: "approved",
    statusEventKind: "pqr_approved",
    statusEventPayload: eventPayload,
  });

  revalidatePath("/bandeja");
  revalidatePath("/queue");
  revalidatePath("/alcaldia");
  revalidatePath(`/pqr/${pqrId}`);
}

export async function sendResponse(pqrId: string): Promise<void> {
  const supabase = getServerSupabase();

  const { data: response, error: readError } = await supabase
    .from("responses")
    .select("id")
    .eq("pqr_id", pqrId)
    .eq("tenant_id", env.demoTenantId)
    .eq("kind", "final")
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!response) throw new Error("No hay respuesta aprobada para enviar");

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("responses")
    .update({ sent_at: nowIso })
    .eq("id", response.id);
  if (updateError) throw new Error(updateError.message);

  await transitionStatus(pqrId, "sent", {
    kind: "pqr_sent",
    payload: { sent_at: nowIso },
  });
}

export async function closeCase(pqrId: string): Promise<void> {
  await transitionStatus(pqrId, "closed", { kind: "pqr_closed" });
}
