"use server";

import { revalidatePath } from "next/cache";
import type { Database } from "@omega/db/types";
import { env } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase-server";

type Status = Database["public"]["Enums"]["pqr_status"];
type BulkAction = "classify" | "assign";

const ACTION_TO_STATUS: Record<BulkAction, Status> = {
  classify: "accepted",
  assign: "assigned",
};

const ACTION_TO_EVENT: Record<BulkAction, string> = {
  classify: "pqr_bulk_classified",
  assign: "pqr_bulk_assigned",
};

export async function applyBulkTriageAction(input: {
  ids: string[];
  action: BulkAction;
}): Promise<{ updated: number }> {
  const ids = [...new Set(input.ids.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    100,
  );
  if (ids.length === 0) return { updated: 0 };

  const supabase = getServerSupabase();
  const toStatus = ACTION_TO_STATUS[input.action];

  const { data: updatedRows, error: updateError } = await supabase
    .from("pqr")
    .update({ status: toStatus })
    .eq("tenant_id", env.demoTenantId)
    .eq("status", "received")
    .in("id", ids)
    .select("id");

  if (updateError) throw new Error(updateError.message);

  const updatedIds = (updatedRows ?? []).map((row) => row.id);
  if (updatedIds.length > 0) {
    const { error: eventError } = await supabase.from("pqr_events").insert(
      updatedIds.map((pqrId) => ({
        tenant_id: env.demoTenantId,
        pqr_id: pqrId,
        kind: ACTION_TO_EVENT[input.action],
        payload: {
          source: "bandeja_bulk",
          action: input.action,
          size: updatedIds.length,
        },
      })),
    );
    if (eventError) {
      console.error("No se pudo registrar evento de lote en pqr_events", eventError);
    }
  }

  revalidatePath("/bandeja");
  revalidatePath("/queue");
  return { updated: updatedIds.length };
}
