import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/ayuda")({
  head: () => ({ meta: [{ title: "Ayuda — PQRSD Alcaldía de Medellín" }] }),
  component: AyudaPage,
});

const SECCIONES = [
  {
    title: "¿Qué es una PQRSD?",
    body:
      "Es el mecanismo que tiene cualquier ciudadano para dirigirse a la Alcaldía. Significa Petición, Queja, Reclamo, Sugerencia, Denuncia u Oposición. Es un derecho garantizado por la Constitución y la Ley 1755 de 2015.",
  },
  {
    title: "¿Cuáles son los plazos?",
    body:
      "El plazo general es de 15 días hábiles. Las peticiones de información se responden en 10 días. Las consultas a autoridades, en 30 días. Los plazos se calculan en días hábiles colombianos, descontando festivos y fines de semana.",
  },
  {
    title: "¿Puedo radicar de forma anónima?",
    body:
      "Sí. Usted puede radicar sin dar su nombre. En ese caso, su único registro será el número de radicado, así que guárdelo bien. La Alcaldía igual está obligada a tramitar y responder su solicitud.",
  },
  {
    title: "¿Cómo se protegen mis datos?",
    body:
      "Cumplimos la Ley 1581 de 2012 (habeas data). Sus datos personales solo se usan para responder su PQRSD y para los registros legales obligatorios. Nunca se publican; el portal de transparencia solo muestra agregados anónimos.",
  },
  {
    title: "¿Qué hago si no me responden a tiempo?",
    body:
      "Si vence el plazo sin respuesta, configura silencio administrativo positivo o negativo según el caso. Usted puede interponer recurso de reposición, acudir al Ministerio Público o, en última instancia, presentar acción de tutela.",
  },
];

function AyudaPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <Link to="/portal" className="text-sm text-muted-foreground hover:text-primary">← Volver al portal</Link>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Ayuda</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Aquí encuentra lo esencial sobre sus derechos y los plazos que la ley le garantiza.
      </p>

      <div className="mt-12 space-y-6">
        {SECCIONES.map((s) => (
          <article key={s.title} className="rounded-2xl border border-hairline bg-surface/60 p-6">
            <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-primary/30 bg-primary/5 p-6">
        <h3 className="text-lg font-medium tracking-tight">¿Listo para radicar?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Comience el formulario en línea. Le toma menos de 5 minutos.
        </p>
        <Link
          to="/portal/radicar"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow"
        >
          Radicar PQRSD
        </Link>
      </div>
    </section>
  );
}
