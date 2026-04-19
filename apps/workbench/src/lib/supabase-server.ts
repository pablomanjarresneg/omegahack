import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@omega/db/types";
import { requireServiceRoleKey, requireSupabaseUrl } from "./env";

let serverClient: SupabaseClient<Database> | null = null;

export function getServerSupabase(): SupabaseClient<Database> {
  serverClient ??= createClient<Database>(
    requireSupabaseUrl(),
    requireServiceRoleKey(),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "public" },
    },
  );
  return serverClient;
}
