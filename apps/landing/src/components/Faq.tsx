import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ITEMS = [
  {
    q: "¿Cómo se conecta con Mercurio?",
    a: "CAROL importa lotes desde Mercurio vía CSV o conector directo, y puede enviar de vuelta los radicados resueltos. La integración se valida en el piloto, sin reemplazar el sistema de gestión documental existente.",
  },
  {
    q: "¿Qué pasa con los datos sensibles del ciudadano?",
    a: "Se aplica habeas data (Ley 1581/2012) sobre el texto de cada PQR: detección y manejo controlado de cédulas, direcciones y datos de salud. La consulta pública usa k-anonymity ≥ 5 a nivel de base de datos.",
  },
  {
    q: "¿Pueden integrar nuestro proveedor de correo?",
    a: "Sí. CAROL trabaja con Microsoft 365, Google Workspace y servidores SMTP/IMAP institucionales. La autenticación se hace con OAuth o credenciales del propio dominio de la alcaldía.",
  },
  {
    q: "¿Qué pasa si se cae internet en una secretaría?",
    a: "El intake nunca se pierde: las solicitudes se encolan en el portal y los plazos legales solo empiezan a correr cuando el radicado entra al sistema. Funcionarios pueden trabajar offline y sincronizar al recuperar conexión.",
  },
  {
    q: "¿Los datos se quedan en Colombia?",
    a: "Sí. CAROL se despliega en infraestructura con datacenter en Colombia o región LATAM, según el requerimiento contractual. La exportación está siempre disponible en SQL estándar.",
  },
  {
    q: "¿Cómo se mide el impacto?",
    a: "Cada alcaldía recibe un panel con tasa de respuesta dentro del plazo legal, tutelas evitadas, tiempo promedio por secretaría y problem groups detectados. Los datos están disponibles vía API para auditoría externa.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            // preguntas frecuentes
          </div>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Lo que preguntan{" "}
            <span className="font-serif-italic text-primary">los CTOs.</span>
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12 rounded-2xl border border-hairline bg-surface/60 px-6">
          {ITEMS.map((it, i) => (
            <AccordionItem key={it.q} value={`item-${i}`} className={i === ITEMS.length - 1 ? "border-b-0" : ""}>
              <AccordionTrigger className="py-5 text-left text-base font-medium tracking-tight text-foreground hover:no-underline">
                {it.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {it.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
