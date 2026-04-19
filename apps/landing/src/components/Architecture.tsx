const STACK = [
  "TanStack Start",
  "Supabase",
  "Postgres + pgvector",
  "Edge Functions",
  "n8n workflows",
  "TypeScript estricto",
];

const BULLETS = [
  "Multi-tenant con Row Level Security",
  "Append-only audit por fila",
  "Embeddings 1024-dim para búsqueda semántica",
  "Cron de reembed automático",
  "Stub determinístico para dev y CI",
  "Sin lock-in: exportación a SQL estándar",
];

export function Architecture() {
  return (
    <section id="arquitectura" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              // para el CTO
            </div>
            <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Arquitectura <span className="font-serif-italic text-primary">auditable.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              Stack moderno, sin magia, sin lock-in. Su equipo de TI puede leer cada línea y
              exportar cada byte.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="flex flex-wrap gap-2">
              {STACK.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/60 px-3 py-1.5 font-mono text-[12px] text-foreground/90"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {s}
                </span>
              ))}
            </div>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {BULLETS.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 rounded-xl border border-hairline bg-surface/60 px-4 py-3 text-sm"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0 text-primary"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-foreground/90">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
