import type { ReactNode } from "react";

const FEATURES: { tag: string; title: string; body: string; icon: ReactNode }[] = [
  {
    tag: "Intake multi-canal",
    title: "Una sola cola para toda la alcaldía.",
    body: "Web, correo institucional, Mercurio CSV, WhatsApp y n8n. Mismo pipeline, misma trazabilidad.",
    icon: <><path d="M3 7l9 6 9-6" /><rect x="3" y="5" width="18" height="14" rx="2" /></>,
  },
  {
    tag: "Validez automática",
    title: "Art. 16 Ley 1755/2015, aplicado.",
    body: "Hechos, petición, respeto, anonimato. Rebotes explicables al ciudadano antes de entrar en la cola.",
    icon: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
  },
  {
    tag: "Clasificación precisa",
    title: "26 secretarías, 16 comunas.",
    body: "Tipo de PQR (6), secretaría oficial, comuna o corregimiento, tags namespaced. Asistido por IA.",
    icon: <><path d="M3 6h18M6 12h12M9 18h6" /></>,
  },
  {
    tag: "Motor de plazos",
    title: "Días hábiles colombianos.",
    body: "Ley Emiliani, suspensiones por tenant, prórroga ≤ 2× validada. El sistema sabe cuándo vence cada PQR.",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  },
  {
    tag: "Problem Groups",
    title: "Patrones que su equipo no ve.",
    body: "Agrupa PQRs recurrentes por similitud semántica + tags + territorio. Detecta clusters \"hot\" en tiempo real.",
    icon: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7.5 7.5l3 9M16.5 7.5l-3 9" /></>,
  },
  {
    tag: "Auditoría + RLS",
    title: "Cumplimiento sin esfuerzo.",
    body: "Append-only por fila. Row Level Security multi-tenant. Habeas data (Ley 1581/2012) aplicado al texto.",
    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
  },
];

export function Features() {
  return (
    <section id="capacidades" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            // capacidades
          </div>
          <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Todo lo que su jurídica necesita,{" "}
            <span className="font-serif-italic text-primary">sin tickets perdidos.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Seis capacidades que reemplazan hojas de cálculo, correos sueltos y reuniones de seguimiento.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.tag}
              className="group relative bg-surface p-7 transition-colors hover:bg-surface-elevated"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-background text-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {f.tag}
                </div>
              </div>
              <h3 className="mt-5 text-xl font-medium tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(400px 200px at 0% 0%, color-mix(in oklab, var(--primary) 8%, transparent), transparent)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
