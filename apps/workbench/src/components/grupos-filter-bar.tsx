import Link from "next/link";
import clsx from "clsx";
import type { Database } from "@omega/db/types";

type PriorityLevel = Database["public"]["Enums"]["priority_level"];

const PRIORITY_OPTIONS: Array<{ value: PriorityLevel; label: string }> = [
  { value: "P0_critica", label: "P0 · crítica" },
  { value: "P1_alta", label: "P1 · alta" },
  { value: "P2_media", label: "P2 · media" },
  { value: "P3_baja", label: "P3 · baja" },
];

type Selected = {
  hotOnly: boolean;
  priorityLevel?: PriorityLevel | null;
  secretariaId?: string | null;
};

function hrefWith(current: Selected, patch: Partial<Selected>): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.hotOnly) params.set("hot", "1");
  if (next.priorityLevel) params.set("p", next.priorityLevel);
  if (next.secretariaId) params.set("secretaria", next.secretariaId);
  const qs = params.toString();
  return qs ? `/grupos?${qs}` : "/grupos";
}

export function GruposFilterBar({
  selected,
  secretarias,
}: {
  selected: Selected;
  secretarias: Array<{ id: string; nombre: string }>;
}) {
  return (
    <form
      action="/grupos"
      method="get"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-6 py-3 text-xs"
    >
      <Link
        href={hrefWith(selected, { hotOnly: !selected.hotOnly })}
        className={clsx(
          "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors",
          selected.hotOnly
            ? "border-p0/50 bg-p0/10 text-p0"
            : "border-border bg-bg-subtle text-fg-muted hover:text-fg",
        )}
        aria-pressed={selected.hotOnly}
      >
        Solo hot
      </Link>

      {selected.hotOnly ? <input type="hidden" name="hot" value="1" /> : null}

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <Field label="Prioridad" name="p" value={selected.priorityLevel ?? ""}>
        <option value="">Todas</option>
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Field>

      <Field
        label="Secretaría"
        name="secretaria"
        value={selected.secretariaId ?? ""}
      >
        <option value="">Todas</option>
        {secretarias.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </Field>

      <button
        type="submit"
        className="rounded bg-brand px-2.5 py-1 text-[11px] font-medium text-brand-fg hover:bg-brand-hover"
      >
        Aplicar
      </button>

      {hasAnyFilter(selected) ? (
        <Link
          href="/grupos"
          className="rounded px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-hover hover:text-fg"
        >
          Limpiar
        </Link>
      ) : null}
    </form>
  );
}

function hasAnyFilter(s: Selected): boolean {
  return Boolean(s.hotOnly || s.priorityLevel || s.secretariaId);
}

function Field({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <span className="text-[11px] text-fg-subtle">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        {children}
      </select>
    </label>
  );
}
