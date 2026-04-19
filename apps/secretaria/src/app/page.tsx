import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Omega · Secretaría</h1>
      <p className="max-w-md text-sm text-fg-muted">
        Panel operativo para funcionarios y directores de secretaría. Inicia
        sesión para ver la cola de PQR asignadas a tu dependencia.
      </p>
      <div className="mt-2 flex gap-3 text-sm">
        <Link
          href="/queue"
          className="rounded bg-brand px-3 py-1.5 font-medium text-brand-fg hover:bg-brand-hover"
        >
          Abrir cola del equipo
        </Link>
        <Link
          href="/mine"
          className="rounded border border-border px-3 py-1.5 font-medium text-fg hover:bg-surface-hover"
        >
          Mis PQR
        </Link>
      </div>
    </main>
  );
}
