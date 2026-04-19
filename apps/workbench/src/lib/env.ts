const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  demoTenantId: process.env.NEXT_PUBLIC_DEMO_TENANT_ID ?? DEFAULT_TENANT_ID,
};

export function requireSupabaseUrl(): string {
  if (!env.supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return env.supabaseUrl;
}

export function requireServiceRoleKey(): string {
  if (!env.supabaseServiceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return env.supabaseServiceRoleKey;
}
