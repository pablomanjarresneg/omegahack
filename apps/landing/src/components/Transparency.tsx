const SECRETARIAS = [
  { code: "SINF", name: "Infraestructura", count: 1284, pct: 92 },
  { code: "SMOV", name: "Movilidad", count: 987, pct: 71 },
  { code: "SSAL", name: "Salud", count: 642, pct: 46 },
  { code: "SEDU", name: "Educación", count: 511, pct: 37 },
  { code: "SAMB", name: "Medio Ambiente", count: 398, pct: 29 },
];

const COMUNAS = [
  ["1", "Popular", 18],
  ["10", "La Candelaria", 38],
  ["11", "Laureles-Estadio", 64],
  ["14", "El Poblado", 27],
  ["16", "Belén", 41],
] as const;

export function Transparency() {
  return (
    <section id="transparencia" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              // transparencia pública
            </div>
            <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Abra los datos a la ciudadanía,{" "}
              <span className="font-serif-italic text-primary">sin riesgo.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              k-anonymity ≥ 5 aplicado en base de datos. Sin PII, sin nombres, sin direcciones. La
              ciudadanía ve agregados; la auditoría ve el detalle.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Mapa por comuna y corregimiento",
                "Línea temporal por tipo de PQR",
                "Top secretarías por volumen y SLA",
                "Tasa de respuesta dentro del plazo legal",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-1 shrink-0 text-primary"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-foreground/90">{b}</span>
                </li>
              ))}
            </ul>
            <a
              href="#demo"
              className="mt-8 inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface/60 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated"
            >
              Ver demo de transparencia
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          <div className="relative rounded-2xl border border-hairline bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                transparencia.medellin.gov.co
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />k ≥ 5
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { k: "PQRs / mes", v: "3.822" },
                { k: "SLA cumplido", v: "94%" },
                { k: "Comunas", v: "16/16" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-hairline bg-background/40 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {s.k}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-primary">
                    {s.v}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Top secretarías
              </div>
              <div className="mt-3 space-y-2.5">
                {SECRETARIAS.map((s) => (
                  <div key={s.code} className="flex items-center gap-3">
                    <span className="w-12 font-mono text-[11px] text-muted-foreground">
                      {s.code}
                    </span>
                    <span className="w-32 truncate text-xs text-foreground/90">{s.name}</span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-background/60">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-[11px] text-foreground">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-5 gap-1.5">
              {COMUNAS.map(([id, name, intensity]) => (
                <div
                  key={id}
                  title={`Comuna ${id} · ${name}`}
                  className="aspect-square rounded-md border border-hairline"
                  style={{
                    background: `color-mix(in oklab, var(--primary) ${intensity}%, transparent)`,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>menos PQRs</span>
              <span>más PQRs</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
