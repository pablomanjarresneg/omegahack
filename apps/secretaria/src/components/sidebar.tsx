"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Inbox, LayoutDashboard } from "lucide-react";
import clsx from "clsx";

type NavItem = { href: string; label: string; icon: typeof Inbox };

const BASE_NAV: readonly NavItem[] = [
  { href: "/queue", label: "Cola del equipo", icon: Inbox },
  { href: "/mine", label: "Asignadas a mí", icon: ClipboardList },
];

const DIRECTOR_NAV: readonly NavItem[] = [
  { href: "/director", label: "Panel director", icon: LayoutDashboard },
];

export function Sidebar({
  userName,
  userRole,
  secretariaName,
}: {
  userName: string;
  userRole: string;
  secretariaName: string;
}) {
  const pathname = usePathname() ?? "";
  const isDirector = userRole === "director" || userRole === "admin";
  const nav = [...BASE_NAV, ...(isDirector ? DIRECTOR_NAV : [])];

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
          <div className="text-sm font-semibold">Secretaría</div>
          <div className="truncate text-[11px] text-fg-subtle" title={secretariaName}>
            {secretariaName}
          </div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3" aria-label="Navegación principal">
        <ul className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
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
        <div className="truncate" title={userName}>
          {userName}
        </div>
        <div className="uppercase tracking-wide text-fg-subtle">{userRole}</div>
      </div>
    </aside>
  );
}
