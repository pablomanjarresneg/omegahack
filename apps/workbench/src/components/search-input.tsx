"use client";

import clsx from "clsx";
import { Search, X } from "lucide-react";

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar por radicado, id o contenido...",
  className,
}: {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={clsx("relative block", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Buscar en bandeja"
        className="w-full rounded-lg border border-white/10 bg-[rgba(10,10,10,0.4)] py-2.5 pl-9 pr-9 text-sm text-fg placeholder:text-fg-subtle backdrop-blur-xl transition-colors focus:border-brand/70 focus:outline-none focus:ring-1 focus:ring-brand/70"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-white/[0.06] hover:text-fg"
          aria-label="Limpiar busqueda"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </label>
  );
}
