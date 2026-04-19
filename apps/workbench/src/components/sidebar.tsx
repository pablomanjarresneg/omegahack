"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Layers,
  ShieldCheck,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/alcaldia", label: "Alcaldía", icon: LayoutDashboard },
  { href: "/queue", label: "Cola de revisión", icon: Inbox },
  { href: "/grupos", label: "Grupos problema", icon: Layers },
  { href: "/auditoria", label: "Auditoría", icon: ShieldCheck },
] as const;

export function Sidebar() {
  const pathname = usePathname() ?? "";
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <div
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded bg-brand text-xs font-bold tracking-tight text-brand-fg"
        >
          Ω
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Workbench</div>
          <div className="text-[11px] text-fg-subtle">Jurídica · Medellín</div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3" aria-label="Navegación principal">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand/10 font-medium text-brand"
                      : "text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-border px-4 py-3 text-[11px] text-fg-subtle">
        <div className="flex items-center gap-2">
          <Settings className="h-3.5 w-3.5" aria-hidden />
          <span className="tnum">v0.1 · demo</span>
        </div>
      </div>
    </aside>
  );
}
