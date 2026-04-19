const STEPS = [
  {
    n: "01",
    title: "Ciudadano radica",
    body: "Desde web, correo o n8n. Anónimo o identificado.",
    mono: "POST /pqrs/intake",
  },
  {
    n: "02",
    title: "CAROL valida y clasifica",
    body: "Validez legal, secretaría, comuna y plazo en segundos.",
    mono: "✓ SINF · Comuna 11",
  },
  {
    n: "03",
    title: "Jurídica trabaja la cola",
    body: "Priorizada por riesgo de tutela y vencimiento.",
    mono: "vence en 4 días",
  },
  {
    n: "04",
    title: "Respuesta con auditoría",
    body: "Notificación al ciudadano, traza inmutable archivada.",
    mono: "MED-20260419-3A7F2C",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            // cómo funciona
          </div>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            De radicación a respuesta,{" "}
            <span className="font-serif-italic text-primary">en cuatro pasos.</span>
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-hairline bg-surface/60 p-6"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.2em] text-primary">{s.n}</span>
                {i < STEPS.length - 1 && (
                  <svg
                    className="hidden text-muted-foreground/40 md:block"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                )}
              </div>
              <h3 className="mt-4 text-lg font-medium tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              <div className="mt-4 rounded-lg border border-hairline bg-background/40 px-3 py-2 font-mono text-[11px] text-foreground/80">
                <span className="text-primary">{">"}</span> {s.mono}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
