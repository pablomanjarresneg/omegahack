import { DashboardMock } from "./DashboardMock";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-36 pb-24 md:pt-44 md:pb-32">
      <div className="pointer-events-none absolute inset-0 hairline-grid radial-fade" />
      <div
        className="pointer-events-none absolute left-1/2 top-32 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 35%, transparent), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <a
            href="#producto"
            className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            v1.0 · piloto en 3 alcaldías
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </a>

          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            <span className="text-gradient">PQRSD</span>{" "}
            <span className="font-serif-italic text-primary">sin deuda operativa.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
            CAROL recibe, valida, clasifica y vence los plazos de las peticiones ciudadanas de su
            alcaldía. Cumple Ley 1755/2015 y Ley 1581/2012 por diseño.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <a
              href="https://omega-workbench.vercel.app/bandeja"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              Dashboard de alcaldía
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </a>
            <a
              href="https://fact-miner.lovable.app/ciudadania/banco-preguntas"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface/60 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated"
            >
              Banco de preguntas
            </a>
          </div>

          <div className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-primary">CAROL</span> · Control · Automatización · Razonamiento ·
            Organización · Logística
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div
            className="absolute -inset-4 rounded-3xl opacity-60 blur-2xl"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 0%, color-mix(in oklab, var(--primary) 25%, transparent), transparent)",
            }}
          />
          <DashboardMock />
        </div>

        <div className="mx-auto mt-20 max-w-4xl">
          <div className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Cumplimiento por diseño
          </div>
          <div className="mt-5 grid grid-cols-2 items-center gap-x-8 gap-y-4 text-sm font-medium text-muted-foreground/80 sm:grid-cols-4">
            {["3 alcaldías piloto", "Ley 1581/2012", "Ley 1755/2015", "Auditoría append-only"].map(
              (l) => (
                <div key={l} className="flex items-center justify-center gap-2 opacity-80">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                  {l}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
