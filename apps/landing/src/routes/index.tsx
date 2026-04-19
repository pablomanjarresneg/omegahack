import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Compare } from "@/components/Compare";
import { HowItWorks } from "@/components/HowItWorks";
import { Transparency } from "@/components/Transparency";
import { Architecture } from "@/components/Architecture";
import { Faq } from "@/components/Faq";

import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAROL — PQRSD sin deuda operativa para alcaldías" },
      {
        name: "description",
        content:
          "CAROL (Control, Automatización, Razonamiento, Organización y Logística) recibe, valida, clasifica y vence los plazos de las PQRSD ciudadanas. Cumple Ley 1755/2015 y Ley 1581/2012 por diseño.",
      },
      { property: "og:title", content: "CAROL — PQRSD sin deuda operativa" },
      {
        property: "og:description",
        content:
          "Plataforma para automatizar PQRSD en alcaldías colombianas. Intake multi-canal, motor legal de plazos, transparencia pública con k-anonymity.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="producto">
        <Hero />
        <Compare />
        <Features />
        <HowItWorks />
        <Transparency />
        <Architecture />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
