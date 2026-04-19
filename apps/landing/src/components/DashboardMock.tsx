/**
 * Dashboard mockup shown in the hero — replaces the terminal/console.
 * Inspired by the workbench screenshot: KPI strip, recent intake list,
 * and state distribution column.
 */
export function DashboardMock() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-hairline bg-background/40 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 18l-3 3M15 18l3 3" />
            </svg>
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-foreground">Panel Alcaldía</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              CAROL · operación PQRSD · tiempo real
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 rounded-md border border-hairline bg-background/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground sm:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          live
        </div>
      </div>

      {/* Alert strip */}
      <div className="mx-5 mt-5 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-destructive">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-3l-8.18-14.14a2 2 0 00-3.46 0z" />
        </svg>
        <div className="text-[13px]">
          <span className="font-medium text-destructive">3 PQRs P0 abiertas</span>
          <span className="text-muted-foreground"> · requieren atención inmediata.</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-px bg-hairline/60 px-5 pt-5 sm:grid-cols-5">
        {[
          { k: "PQR abiertas", v: "19", sub: "27 totales", tone: "text-foreground" },
          { k: "PØ críticas", v: "3", sub: "escalamiento", tone: "text-destructive" },
          { k: "Vencidas", v: "4", sub: "Ley 1755 superado", tone: "text-warning" },
          { k: "SLA", v: "79%", sub: "dentro de plazo", tone: "text-primary" },
          { k: "Enviadas hoy", v: "3", sub: "respuestas", tone: "text-foreground" },
        ].map((s) => (
          <div key={s.k} className="bg-surface px-3 py-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {s.k}
            </div>
            <div className={`mt-1 text-2xl font-semibold tracking-tight ${s.tone}`}>{s.v}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground/80">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Body: recent intake + state distribution */}
      <div className="grid gap-5 p-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium text-foreground">Ingreso reciente</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              últimas 6 PQR
            </div>
          </div>

          <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-background/30">
            {[
              { p: "P0", radicado: "MED-20260419-000002", title: "Posible riesgo estructural en muro de contención.", sec: "Gestión del Riesgo · Comuna 8", state: "En borrador", tone: "destructive" },
              { p: "P1", radicado: "MED-20260419-000005", title: "Semáforo peatonal intermitente en zona escolar.", sec: "Movilidad · Comuna 14", state: "Aprobada", tone: "warning" },
              { p: "P2", radicado: "MED-20260419-000010", title: "Junta comunal solicita acompañamiento documental.", sec: "Gerencia del Centro · Comuna 3", state: "Traslado", tone: "primary" },
              { p: "P2", radicado: "MED-20260419-000018", title: "Luminarias apagadas en tramo peatonal de Guayabal.", sec: "Infraestructura · Comuna 15", state: "Aceptada", tone: "primary" },
              { p: "P3", radicado: "MED-20260419-000014", title: "Sugerencia para corregir horarios publicados en canales.", sec: "Comunicaciones · Comuna 5", state: "En revisión", tone: "warning" },
              { p: "P3", radicado: "MED-20260419-000023", title: "PQR incompleta por falta de ubicación verificable.", sec: "Devuelta · incompleta", state: "Devuelta", tone: "warning" },
            ].map((r) => (
              <li key={r.radicado} className="flex items-start gap-3 px-3 py-3 text-[12px]">
                <span
                  className={`mt-0.5 grid h-6 w-7 shrink-0 place-items-center rounded-md border font-mono text-[10px] font-semibold ${
                    r.tone === "destructive"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : r.tone === "warning"
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-primary/40 bg-primary/10 text-primary"
                  }`}
                >
                  {r.p}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{r.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <span>{r.radicado}</span>
                    <span>·</span>
                    <span className="truncate">{r.sec}</span>
                  </div>
                </div>
                <span
                  className={`hidden shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] sm:inline-block ${
                    r.tone === "destructive"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : r.tone === "warning"
                      ? "border-warning/30 bg-warning/5 text-warning"
                      : "border-primary/30 bg-primary/5 text-primary"
                  }`}
                >
                  {r.state}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[13px] font-medium text-foreground">Distribución por estado</div>
          <div className="mt-3 space-y-2.5 rounded-xl border border-hairline bg-background/30 p-4">
            {[
              { k: "En revisión", n: 5, w: 100 },
              { k: "Asignada", n: 4, w: 80 },
              { k: "Recibida", n: 3, w: 60 },
              { k: "En borrador", n: 3, w: 60 },
              { k: "Aprobada", n: 3, w: 60 },
              { k: "Enviada", n: 3, w: 60 },
              { k: "Trasladada", n: 2, w: 40 },
              { k: "Aceptada", n: 1, w: 20 },
              { k: "Devuelta", n: 1, w: 20 },
            ].map((row) => (
              <div key={row.k} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground/85">{row.k}</span>
                  <span className="font-mono text-muted-foreground">{row.n}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-background/60">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${row.w}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
