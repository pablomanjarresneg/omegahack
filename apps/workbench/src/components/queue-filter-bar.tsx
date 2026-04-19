import Link from "next/link";
import clsx from "clsx";
import { Constants } from "@omega/db/types";
import { channelLabel } from "./channel-icon";
import type { Database } from "@omega/db/types";

type Channel = Database["public"]["Enums"]["pqr_channel"];
type PriorityLevel = Database["public"]["Enums"]["priority_level"];
type Status = Database["public"]["Enums"]["pqr_status"];

export type QueueSort = "priority" | "deadline" | "recent";

const SORTS: Array<{ key: QueueSort; label: string }> = [
  { key: "priority", label: "Prioridad" },
  { key: "deadline", label: "Plazo" },
  { key: "recent", label: "Recientes" },
];

const PRIORITY_OPTIONS: Array<{ value: PriorityLevel; label: string }> = [
  { value: "P0_critica", label: "P0 · crítica" },
  { value: "P1_alta", label: "P1 · alta" },
  { value: "P2_media", label: "P2 · media" },
  { value: "P3_baja", label: "P3 · baja" },
];

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: "received", label: "Recibidas" },
  { value: "accepted", label: "Aceptadas" },
  { value: "assigned", label: "Asignadas" },
  { value: "in_draft", label: "En borrador" },
  { value: "in_review", label: "En revisión" },
  { value: "approved", label: "Aprobadas" },
  { value: "sent", label: "Enviadas" },
];

type Selected = {
  sort: QueueSort;
  secretariaId?: string | null;
  comunaId?: string | null;
  channel?: Channel | null;
  priorityLevel?: PriorityLevel | null;
  status?: Status | null;
};

function hrefWith(current: Selected, patch: Partial<Selected>): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.sort && next.sort !== "priority") params.set("sort", next.sort);
  if (next.secretariaId) params.set("secretaria", next.secretariaId);
  if (next.comunaId) params.set("comuna", next.comunaId);
  if (next.channel) params.set("channel", next.channel);
  if (next.priorityLevel) params.set("p", next.priorityLevel);
  if (next.status) params.set("status", next.status);
  const qs = params.toString();
  return qs ? `/queue?${qs}` : "/queue";
}

export function QueueFilterBar({
  selected,
  secretarias,
  comunas,
}: {
  selected: Selected;
  secretarias: Array<{ id: string; nombre: string }>;
  comunas: Array<{ id: string; nombre: string; numero: number }>;
}) {
  return (
    <form
      action="/queue"
      method="get"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-6 py-3 text-xs"
    >
      <div className="inline-flex rounded border border-border bg-bg-subtle p-0.5">
        {SORTS.map((s) => {
          const active = selected.sort === s.key;
          return (
            <Link
              key={s.key}
              href={hrefWith(selected, { sort: s.key })}
              className={clsx(
                "rounded px-2 py-1 text-[11px] transition-colors",
                active
                  ? "bg-surface font-medium text-fg shadow-sm"
                  : "text-fg-muted hover:text-fg",
              )}
              aria-current={active ? "true" : undefined}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* Carry sort into the form submit. */}
      {selected.sort !== "priority" ? (
        <input type="hidden" name="sort" value={selected.sort} />
      ) : null}

      <span className="mx-1 h-4 w-px bg-border" aria-hidden />

      <Field label="Estado" name="status" value={selected.status ?? ""}>
        <option value="">Todas</option>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Field>

      <Field label="Prioridad" name="p" value={selected.priorityLevel ?? ""}>
        <option value="">Todas</option>
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Field>

      <Field label="Canal" name="channel" value={selected.channel ?? ""}>
        <option value="">Todos</option>
        {Constants.public.Enums.pqr_channel.map((c) => (
          <option key={c} value={c}>
            {channelLabel(c)}
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

      <Field label="Comuna" name="comuna" value={selected.comunaId ?? ""}>
        <option value="">Todas</option>
        {comunas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.numero < 100 ? `Comuna ${c.numero} — ${c.nombre}` : c.nombre}
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
          href="/queue"
          className="rounded px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-hover hover:text-fg"
        >
          Limpiar
        </Link>
      ) : null}
    </form>
  );
}

function hasAnyFilter(s: Selected): boolean {
  return Boolean(
    s.status || s.priorityLevel || s.channel || s.secretariaId || s.comunaId,
  );
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
