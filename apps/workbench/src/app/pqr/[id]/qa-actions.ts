"use server";

import { revalidatePath } from "next/cache";
import { recordQaFeedback } from "@/lib/qa-feedback";

export async function markQaChunkUseful(formData: FormData): Promise<void> {
  const chunkId = formData.get("chunkId");
  const pqrId = formData.get("pqrId");
  const useful = formData.get("useful") === "true";
  if (typeof chunkId !== "string" || typeof pqrId !== "string") return;
  await recordQaFeedback({
    chunkId,
    pqrId,
    userId: null,
    useful,
    notes: null,
  });
  revalidatePath(`/pqr/${pqrId}`);
}
