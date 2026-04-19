import type { Database } from "@omega/db/types";
import { getServerSupabase } from "./supabase-server";
import { env } from "./env";

type Secretaria = Database["public"]["Tables"]["secretarias"]["Row"];
type Comuna = Database["public"]["Tables"]["comunas"]["Row"];

export async function listSecretarias(): Promise<Secretaria[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("secretarias")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .order("nombre", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listComunas(): Promise<Comuna[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("comunas")
    .select("*")
    .eq("tenant_id", env.demoTenantId)
    .order("numero", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
