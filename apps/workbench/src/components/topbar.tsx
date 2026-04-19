import { Search } from "lucide-react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/80 px-6 backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold leading-none">{title}</h1>
        {subtitle ? (
          <p className="mt-1 truncate text-xs text-fg-subtle">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <label className="relative hidden items-center md:flex">
          <Search
            className="absolute left-2.5 h-3.5 w-3.5 text-fg-subtle"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Buscar radicado, citizen, tema…"
            aria-label="Buscar"
            className="w-72 rounded border border-border bg-bg-subtle py-1.5 pl-8 pr-3 text-xs text-fg placeholder:text-fg-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </label>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-fg">
          AM
        </div>
      </div>
    </header>
  );
}
