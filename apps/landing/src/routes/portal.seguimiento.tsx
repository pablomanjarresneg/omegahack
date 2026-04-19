import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/portal/seguimiento")({
  head: () => ({ meta: [{ title: "Seguimiento de PQRSD — Alcaldía de Medellín" }] }),
  component: SeguimientoIndex,
});

function SeguimientoIndex() {
  const [v, setV] = useState("");
  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <Link to="/portal" className="text-sm text-muted-foreground hover:text-primary">← Volver al portal</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Consultar mi PQRSD</h1>
      <p className="mt-2 text-muted-foreground">
        Ingrese el número de radicado que recibió al presentar su solicitud.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) window.location.href = `/portal/seguimiento/${encodeURIComponent(v.trim())}`;
        }}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={v}
          onChange={(e) => setV(e.target.value.toUpperCase())}
          placeholder="MED-20260419-XXXXXX"
          aria-label="Número de radicado"
          className="flex-1 rounded-xl border border-hairline bg-background px-4 py-3 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow"
        >
          Consultar
        </button>
      </form>

      <div className="mt-10 rounded-xl border border-hairline bg-surface/60 p-5 text-sm text-muted-foreground">
        ¿Perdió su número de radicado? Llame al <span className="text-foreground">44 44 144</span> con
        el correo o teléfono que registró al radicar.
      </div>
    </section>
  );
}
