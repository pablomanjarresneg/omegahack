import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServiceRoleKey, requireSupabaseUrl } from "./env";

type QaBankTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type QaBankDatabase = {
  qa_bank: {
    Tables: Record<string, QaBankTable>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

type QaBankClient = SupabaseClient<QaBankDatabase, "qa_bank">;

// qa_bank schema is outside the @omega/db generated types (public-only), so we
// use a deliberately generic schema shape for the feedback insert surface.
let qaFeedbackClient: QaBankClient | null = null;

function getClient(): QaBankClient {
  if (!qaFeedbackClient) {
    qaFeedbackClient = createClient<QaBankDatabase, "qa_bank">(
      requireSupabaseUrl(),
      requireServiceRoleKey(),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: "qa_bank" },
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
