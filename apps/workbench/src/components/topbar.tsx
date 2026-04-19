import { Search } from "lucide-react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-[rgba(17,17,17,0.7)] px-6 backdrop-blur-xl">
      <div>
        <h1 className="text-sm font-semibold leading-none text-fg">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-xs text-fg-subtle">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <label className="relative hidden items-center md:flex">
          <Search
            className="absolute left-2.5 h-3.5 w-3.5 text-fg-subtle"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Buscar radicado, ciudadano o tema..."
            aria-label="Buscar"
            className="w-72 rounded-lg border border-white/10 bg-white/[0.03] py-1.5 pl-8 pr-3 text-xs text-fg placeholder:text-fg-subtle focus:border-brand/70 focus:outline-none focus:ring-1 focus:ring-brand/70"
          />
        </label>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-xs font-semibold text-fg">
          AM
        </div>
      </div>
    </header>
  );
}
