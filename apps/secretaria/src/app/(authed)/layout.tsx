import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { getSession } from "@/lib/session";
import { getSecretaria } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.user) {
    // No session → send the user to the public landing page. A future
    // iteration plugs in Supabase auth redirect.
    redirect("/");
  }

  if (!session.user.secretaria_id) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold">Sin secretaría asignada</h1>
        <p className="max-w-md text-sm text-fg-muted">
          Tu cuenta aún no está vinculada a una secretaría. Contacta al
          administrador para asignar un área operativa antes de continuar.
        </p>
      </main>
    );
  }

  const secretaria = await getSecretaria(session.user.secretaria_id);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-bg text-fg">
      <Sidebar
        userName={session.user.nombre}
        userRole={session.user.role}
        secretariaName={secretaria?.nombre ?? "Secretaría"}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">{children}</div>
    </div>
  );
}
