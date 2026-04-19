export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9 18l-3 3M15 18l3 3" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              CAROL<span className="text-muted-foreground">/pqrsd</span>
            </span>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/70">
              Control · Automatización · Razonamiento · Organización · Logística
            </span>
          </p>
          <p className="max-w-xl text-xs text-muted-foreground/80">
            CAROL cumple Ley 1581/2012 (habeas data), Ley 1755/2015 (derecho de petición) y Decreto
            491/2020.
          </p>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-hairline pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div>
            © {new Date().getFullYear()} CAROL · Hecho en Colombia para la administración pública.
          </div>
          <div className="font-mono">v1.0 · todos los sistemas operativos</div>
        </div>
      </div>
    </footer>
  );
}
