import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Radicar PQRSD — Alcaldía de Medellín" },
      { name: "description", content: "Radique su PQRSD en línea ante la Alcaldía de Medellín. Plazos legales, datos protegidos." },
    ],
  }),
  component: PortalHome,
});

function PortalHome() {
  const [radicado, setRadicado] = useState("");

  return (
    <>
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="pointer-events-none absolute inset-0 hairline-grid radial-fade opacity-60" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              Portal ciudadano
            </div>
            <h1 className="mt-3 text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Radique su PQRSD{" "}
              <span className="font-serif-italic text-primary">en línea.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              La Alcaldía de Medellín responde en los tiempos que fija la ley. Usted elige si
              radica con nombre o de forma anónima.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Link
              to="/portal/radicar"
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-hairline bg-surface/60 p-8 transition-all hover:border-primary/50 hover:bg-surface-elevated"
            >
              <div>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                </span>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                  Radicar una nueva PQRSD
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Petición, queja, reclamo, sugerencia, denuncia u oposición. Le toma menos de 5 minutos.
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow group-hover:scale-[1.01] transition-transform self-start">
                Comenzar
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-hairline bg-surface/60 p-8">
              <div>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                </span>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                  Consultar el estado de mi PQRSD
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use el número de radicado que recibió al momento de presentar su solicitud.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (radicado.trim()) {
                    window.location.href = `/portal/seguimiento/${encodeURIComponent(radicado.trim())}`;
                  }
                }}
                className="mt-8 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  type="text"
                  value={radicado}
                  onChange={(e) => setRadicado(e.target.value.toUpperCase())}
                  placeholder="MED-20260419-XXXXXX"
                  aria-label="Número de radicado"
                  className="flex-1 rounded-xl border border-hairline bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-hairline bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated"
                >
                  Consultar
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </>
              ),
              title: "Plazos legales",
              body:
                "CAROL calcula el día exacto en que vence su PQRSD según la Ley 1755/2015 y los días hábiles colombianos.",
            },
            {
              icon: (
                <>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </>
              ),
              title: "Sus datos protegidos",
              body:
                "Cumplimos la Ley 1581/2012 (habeas data). Usted decide qué compartir y puede radicar de forma anónima.",
            },
            {
              icon: (
                <>
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </>
              ),
              title: "Transparencia",
              body:
                "Vea cuántas PQRSD atiende cada secretaría en el portal de transparencia, con datos abiertos y agregados.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-hairline bg-surface/60 p-6">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {c.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
