import { Topbar } from "@/components/topbar";
import { listProblemGroups } from "@/lib/queries";
import { formatDateTimeCO } from "@/lib/format";
import { Flame, Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GruposPage() {
  const groups = await listProblemGroups(100);

  return (
    <>
      <Topbar
        title="Grupos problema"
        subtitle={`${groups.length.toLocaleString("es-CO")} grupo${groups.length === 1 ? "" : "s"} activo${groups.length === 1 ? "" : "s"}`}
      />
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p className="max-w-3xl text-xs text-fg-muted">
          Clústeres detectados a partir de PQR similares (embeddings +
          geolocalización). Un grupo con <strong>muchos miembros</strong> o
          marcado como <strong>hot</strong> revela un problema sistémico:
          resolverlo una vez responde a decenas de ciudadanos a la vez.
        </p>

        {groups.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-bg-subtle px-6 py-14 text-center">
            <p className="text-sm font-medium">Sin grupos problema todavía</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-fg-subtle">
              A medida que ingresen PQR similares, el agente de intake las
              agrupa automáticamente.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <li
                key={g.id}
                className="flex flex-col gap-3 rounded border border-border bg-surface p-4"
              >
                <header className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold leading-tight text-fg">
                    {g.canonical_title ?? "Grupo sin título"}
                  </h2>
                  {g.hot ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-p0/40 bg-p0/10 px-1.5 py-0.5 text-[10px] font-medium text-p0">
                      <Flame className="h-3 w-3" aria-hidden />
                      hot
                    </span>
                  ) : null}
                </header>

                {g.resumen ? (
                  <p className="line-clamp-3 text-xs text-fg-muted">
                    {g.resumen}
                  </p>
                ) : null}

                <footer className="mt-auto flex items-center justify-between border-t border-border pt-2 text-[11px] text-fg-subtle">
                  <span className="inline-flex items-center gap-1 tnum">
                    <Users className="h-3 w-3" aria-hidden />
                    {g.member_count.toLocaleString("es-CO")} miembro
                    {g.member_count === 1 ? "" : "s"}
                  </span>
                  <time dateTime={g.updated_at}>
                    {formatDateTimeCO(g.updated_at)}
                  </time>
                </footer>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
