import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/seguimiento/$radicado")({
  head: ({ params }) => ({
    meta: [{ title: `${params.radicado} — Seguimiento PQRSD` }],
  }),
  component: SeguimientoDetalle,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Radicado no encontrado</h1>
      <p className="mt-2 text-muted-foreground">Verifique el número e intente de nuevo.</p>
      <Link to="/portal" className="mt-6 inline-block text-primary hover:underline">
        Volver al inicio
      </Link>
    </div>
  ),
});

const TIMELINE = [
  {
    date: "2026-04-19 09:14",
    title: "Radicado recibido",
    body: "Su PQRSD fue recibida por el portal ciudadano.",
    done: true,
  },
  {
    date: "2026-04-19 09:14",
    title: "Validez confirmada",
    body: "Cumple Art. 16 de la Ley 1755/2015.",
    done: true,
  },
  {
    date: "2026-04-19 09:15",
    title: "Asignación",
    body: "Asignada a la Secretaría de Infraestructura (SINF).",
    done: true,
  },
  {
    date: "2026-04-22 11:02",
    title: "En estudio",
    body: "Un funcionario está analizando su caso.",
    done: true,
    current: true,
  },
  {
    date: "Pendiente",
    title: "Respuesta enviada",
    body: "Recibirá la respuesta por su canal de contacto.",
    done: false,
  },
];

function SeguimientoDetalle() {
  const { radicado } = Route.useParams();

  return (
    <section className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <Link to="/portal" className="text-sm text-muted-foreground hover:text-primary">
        ← Volver al portal
      </Link>

      <div className="mt-6 rounded-2xl border border-hairline bg-surface/60 p-6 md:p-8 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Radicado
            </div>
            <div className="mt-1 font-mono text-2xl tracking-wide text-primary">{radicado}</div>
          </div>
          <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            En estudio
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-hairline pt-6 sm:grid-cols-4">
          <Stat k="Tipo" v="Petición" />
          <Stat k="Secretaría" v="Infraestructura" />
          <Stat k="Comuna" v="11 · Laureles" />
          <Stat k="Vence" v="2026-05-11" highlight />
        </dl>
      </div>

      <h2 className="mt-12 text-lg font-medium tracking-tight">Línea de tiempo</h2>
      <ol className="mt-5 space-y-1">
        {TIMELINE.map((s, i) => (
          <li key={i} className="relative grid grid-cols-[24px_1fr] gap-4 pb-6">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 grid h-5 w-5 place-items-center rounded-full border-2 ${
                  s.done
                    ? s.current
                      ? "border-primary bg-primary/30"
                      : "border-primary bg-primary"
                    : "border-hairline bg-background"
                }`}
              >
                {s.done && !s.current && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-primary-foreground"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
              {i < TIMELINE.length - 1 && <span className="mt-1 w-px flex-1 bg-hairline" />}
            </div>
            <div>
              <div className="font-mono text-[11px] text-muted-foreground">{s.date}</div>
              <div
                className={`text-sm font-medium ${s.done ? "text-foreground" : "text-muted-foreground"}`}
              >
                {s.title}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-xl border border-hairline bg-surface/60 p-5 text-sm text-muted-foreground">
        Esta información se actualiza en tiempo real. Si su PQRSD vence sin respuesta, puede{" "}
        <a href="#" className="text-primary hover:underline">
          interponer recurso
        </a>{" "}
        o{" "}
        <a href="#" className="text-primary hover:underline">
          acudir a tutela
        </a>
        .
      </div>
    </section>
  );
}

function Stat({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {k}
      </dt>
      <dd className={`mt-1 text-sm font-medium ${highlight ? "text-primary" : "text-foreground"}`}>
        {v}
      </dd>
    </div>
  );
}
