// Minimal session helper for the secretaria app.
//
// In a production deployment this returns the functionary profile associated
// with the Supabase JWT. For the demo we key by `SECRETARIA_DEMO_USER_EMAIL`
// env var so the UI can be exercised without wiring Supabase auth in the
// scaffold.

import type { Database } from "@omega/db/types";
import { getServerSupabase } from "./supabase-server";
import { env } from "./env";

type Functionary = Database["public"]["Tables"]["functionaries"]["Row"];

export type Session = {
  user: Pick<Functionary, "id" | "email" | "nombre" | "role" | "secretaria_id"> | null;
};

let cachedSession: Session | null = null;

export async function getSession(): Promise<Session> {
  if (cachedSession) return cachedSession;

  const supabase = getServerSupabase();

  if (env.demoUserEmail) {
    const { data } = await supabase
      .from("functionaries")
      .select("id, email, nombre, role, secretaria_id")
      .eq("tenant_id", env.demoTenantId)
      .eq("email", env.demoUserEmail)
      .eq("active", true)
      .maybeSingle();
    cachedSession = { user: data ?? null };
    return cachedSession;
  }

  // No demo user → fall back to the first active functionary whose role is
  // "funcionario" so pages still render in a local dev environment.
  const { data } = await supabase
    .from("functionaries")
    .select("id, email, nombre, role, secretaria_id")
    .eq("tenant_id", env.demoTenantId)
    .eq("active", true)
    .order("nombre", { ascending: true })
    .limit(1)
    .maybeSingle();

  cachedSession = { user: data ?? null };
  return cachedSession;
}

/**
 * Returns the secretaría ID attached to the current session, or `null` when
 * the user is unauthenticated / unassigned. Used by every operational query
 * to scope results to the user's dependency.
 */
export async function getSessionSecretariaId(): Promise<string | null> {
  const { user } = await getSession();
  return user?.secretaria_id ?? null;
}

export function isDirectorRole(role: string | null | undefined): boolean {
  return role === "director" || role === "admin";
}
