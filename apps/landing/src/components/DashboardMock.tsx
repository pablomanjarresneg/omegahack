const stages = [
  {
    label: "Triaje",
    count: 7,
    detail: "Aceptar, devolver o trasladar",
    width: 100,
    tone: "danger",
  },
  {
    label: "Asignación",
    count: 5,
    detail: "Enviar a la dependencia correcta",
    width: 72,
    tone: "primary",
  },
  {
    label: "Borrador",
    count: 4,
    detail: "Generar respuesta Ley 1755",
    width: 58,
    tone: "primary",
  },
  {
    label: "Revisión",
    count: 3,
    detail: "Validar citas y anexos",
    width: 44,
    tone: "warning",
  },
  {
    label: "Envío",
    count: 2,
    detail: "Notificar al ciudadano",
    width: 30,
    tone: "success",
  },
] as const;

const queueRows = [
  {
    priority: "P0",
    title: "Riesgo estructural en muro de contención",
    radicado: "MED-20260419-000002",
    area: "Gestión del Riesgo · Comuna 8",
    action: "Aceptar y escalar",
    tone: "danger",
  },
  {
    priority: "P1",
    title: "Semáforo peatonal intermitente en zona escolar",
    radicado: "MED-20260419-000005",
    area: "Movilidad · Comuna 14",
    action: "Asignar hoy",
    tone: "warning",
  },
  {
    priority: "P2",
    title: "Junta comunal solicita soporte documental",
    radicado: "MED-20260419-000010",
    area: "Participación Ciudadana · Comuna 3",
    action: "Borrador listo",
    tone: "primary",
  },
  {
    priority: "P2",
    title: "Luminarias apagadas en tramo peatonal",
    radicado: "MED-20260419-000018",
    area: "Infraestructura · Comuna 15",
    action: "Revisar plazo",
    tone: "primary",
  },
] as const;

function toneClasses(tone: (typeof queueRows)[number]["tone"]) {
  if (tone === "danger") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (tone === "warning") {
    return "border-yellow-400/35 bg-yellow-400/10 text-yellow-200";
  }
  return "border-primary/40 bg-primary/10 text-primary";
}

function stageBarClass(tone: (typeof stages)[number]["tone"]) {
  if (tone === "danger") return "bg-destructive";
  if (tone === "warning") return "bg-yellow-300";
  if (tone === "success") return "bg-success";
  return "bg-primary";
}

/**
 * Dashboard mockup shown in the hero.
 * Mirrors the dev branch operator dashboard: next action first, then stage lanes.
 */
export function DashboardMock() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-hairline bg-background/40 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
            >
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-semibold text-foreground">
              Bandeja del día
            </div>
            <div className="truncate font-mono text-[10px] uppercase text-muted-foreground">
              CAROL · siguiente acción · Medellín
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 rounded-md border border-hairline bg-background/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground sm:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          en vivo
        </div>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[1.15fr_0.85fr] lg:p-5">
        <section className="rounded-lg border border-hairline bg-background/30 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                Empieza por aquí
              </p>
              <h2 className="mt-1 max-w-xl text-2xl font-semibold leading-tight text-foreground">
                7 PQR pendientes de triaje
              </h2>
              <p className="mt-1 max-w-xl text-[13px] leading-5 text-muted-foreground">
                La bandeja agrupa casos activos por etapa y muestra la acción exacta para mover cada
                PQR antes de que venza el plazo legal.
              </p>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              Abrir triaje
              <svg
                aria-hidden
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.4"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            <svg
              aria-hidden
              className="mt-0.5 shrink-0"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="m10.29 3.86-8.18 14.14A2 2 0 0 0 3.84 21h16.32a2 2 0 0 0 1.73-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            <span>
              <strong>2 P0 críticas</strong> en triaje · atender primero para evitar tutela o riesgo
              material.
            </span>
          </div>
        </section>

        <section className="rounded-lg border border-hairline bg-background/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-foreground">Turno operativo</h3>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              21 activas
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-hairline bg-hairline/70">
            {[
              ["79%", "SLA"],
              ["4", "vencidas"],
              ["6", "hoy"],
            ].map(([value, label]) => (
              <div key={label} className="bg-surface px-3 py-3">
                <div className="text-xl font-semibold text-foreground">{value}</div>
                <div className="mt-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                  {label}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 text-[12px] text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>Casos con ciudadano vulnerable</span>
              <span className="font-mono text-foreground">3</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Respuestas listas para envío</span>
              <span className="font-mono text-foreground">2</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Traslados pendientes</span>
              <span className="font-mono text-foreground">5</span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 px-4 pb-5 lg:grid-cols-[0.72fr_1.28fr] lg:px-5">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-foreground">Etapas activas</h3>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">flujo</span>
          </div>
          <div className="space-y-2.5 rounded-lg border border-hairline bg-background/30 p-4">
            {stages.map((stage) => (
              <div key={stage.label} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="font-medium text-foreground/90">{stage.label}</span>
                  <span className="font-mono text-muted-foreground">{stage.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-background/70">
                  <div
                    className={`h-full rounded-full ${stageBarClass(stage.tone)}`}
                    style={{ width: `${stage.width}%` }}
                  />
                </div>
                <p className="truncate text-[10px] text-muted-foreground">{stage.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-foreground">Siguiente acción por PQR</h3>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              top prioridad
            </span>
          </div>
          <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-background/30">
            {queueRows.map((row) => (
              <li
                key={row.radicado}
                className="grid gap-3 px-3 py-3 text-[12px] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <span
                  className={`grid h-7 w-8 place-items-center rounded-md border font-mono text-[10px] font-semibold ${toneClasses(row.tone)}`}
                >
                  {row.priority}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{row.title}</div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
                    <span>{row.radicado}</span>
                    <span aria-hidden>·</span>
                    <span className="truncate">{row.area}</span>
                  </div>
                </div>
                <span className="w-fit rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {row.action}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
