import { Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PortalShell({ children }: { children?: ReactNode }) {
  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <header className="border-b border-hairline bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/portal" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 18l-3 3M15 18l3 3" />
              </svg>
            </span>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Alcaldía de Medellín</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                CAROL · PQRSD
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/portal">Inicio</NavLink>
            <NavLink to="/portal/radicar">Radicar</NavLink>
            <NavLink to="/portal/seguimiento">Seguimiento</NavLink>
            <NavLink to="/portal/ayuda">Ayuda</NavLink>
            <a
              href="#"
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Transparencia
            </a>
          </nav>

          <Link
            to="/portal/radicar"
            className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] sm:inline-flex"
          >
            Radicar PQRSD
          </Link>
        </div>
      </header>

      <main>{children ?? <Outlet />}</main>

      <footer className="mt-20 border-t border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                ¿Necesita ayuda?
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                Llame al 44 44 144
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Atención lunes a viernes, 7:00 a 17:30. Sábados 8:00 a 12:00.
              </p>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Sus derechos
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-foreground/80">
                <li>Respuesta dentro del plazo legal (Ley 1755/2015)</li>
                <li>Protección de sus datos (Ley 1581/2012)</li>
                <li>Radicación anónima cuando lo prefiera</li>
              </ul>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Enlaces
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li><Link to="/portal/ayuda" className="text-foreground/80 hover:text-primary">¿Qué es una PQRSD?</Link></li>
                <li><a href="#" className="text-foreground/80 hover:text-primary">Política de tratamiento de datos</a></li>
                <li><a href="#" className="text-foreground/80 hover:text-primary">Decreto 491/2020</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-hairline pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Alcaldía de Medellín · Plataforma CAROL.
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ to, children }: { to: "/portal" | "/portal/radicar" | "/portal/seguimiento" | "/portal/ayuda"; children: ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{ className: "rounded-lg bg-accent px-3 py-2 text-sm font-medium text-foreground" }}
      inactiveProps={{ className: "rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" }}
    >
      {children}
    </Link>
  );
}
