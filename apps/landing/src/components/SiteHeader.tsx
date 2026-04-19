import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-6xl">
      <div className="glass flex items-center justify-between rounded-2xl px-4 py-2.5 shadow-card">
        <Link to="/" className="flex items-center gap-2">
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
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {[
            { label: "Producto", href: "#producto" },
            { label: "Capacidades", href: "#capacidades" },
            { label: "Transparencia", href: "#transparencia" },
            { label: "Arquitectura", href: "#arquitectura" },
            { label: "Preguntas", href: "#faq" },
          ].map((i) => (
            <a
              key={i.label}
              href={i.href}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {i.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Abrir portal
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
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
