import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServiceRoleKey, requireSupabaseUrl } from "./env";

// qa_bank schema is outside the @omega/db generated types (public-only), so we
// fall back to an `any`-typed client. See qa-retrieval.ts for the rationale.
let qaFeedbackClient: SupabaseClient<any, any, any> | null = null;

function getClient(): SupabaseClient<any, any, any> {
  if (!qaFeedbackClient) {
    qaFeedbackClient = createClient(
      requireSupabaseUrl(),
      requireServiceRoleKey(),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: "qa_bank" as never },
      },
    );
  }
  return qaFeedbackClient;
}

export interface QaFeedbackInput {
  chunkId: string;
  pqrId: string | null;
  userId: string | null;
  useful: boolean;
  notes?: string | null;
}

export async function recordQaFeedback(input: QaFeedbackInput): Promise<void> {
  const client = getClient();
  const { error } = await client.from("qa_feedback").insert({
    chunk_id: input.chunkId,
    pqr_id: input.pqrId,
    user_id: input.userId,
    useful: input.useful,
    notes: input.notes ?? null,
  });
  if (error) {
    // We don't throw — feedback is best-effort and shouldn't break the UI.
    console.error("recordQaFeedback failed:", error.message);
  }
}
