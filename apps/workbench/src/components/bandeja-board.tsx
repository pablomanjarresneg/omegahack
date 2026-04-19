"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
} from "lucide-react";
import { applyBulkTriageAction } from "@/app/bandeja/actions";
import { formatDateCO } from "@/lib/format";
import {
  ACTIVE_STAGES,
  STAGE_COPY,
  STAGE_LABEL,
  nextActionFor,
  type Stage,
} from "@/lib/next-action";
import type { QueuePqr } from "@/lib/queries";
import { BandejaRow, type BandejaRowPreview } from "./bandeja-row";
import { EmeraldCheckbox } from "./emerald-checkbox";
import { PriorityBadge } from "./priority-badge";
import { SearchInput } from "./search-input";

type Row = QueuePqr & {
  secretariaName: string | null;
  comunaLabel: string | null;
};

type Option = {
  id: string;
  label: string;
};

const STAGGER_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const DRAWER_SPRING = { type: "spring", stiffness: 320, damping: 30, mass: 0.9 } as const;

const ROW_VARIANTS = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      delay: Math.min(0.3, index * 0.035),
      ease: STAGGER_EASE,
    },
  }),
};

export function BandejaBoard({
  initialRows,
  secretarias,
  comunas,
}: {
  initialRows: Row[];
  secretarias: Option[];
  comunas: Option[];
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [searchValue, setSearchValue] = useState("");
  const [secretariaFilter, setSecretariaFilter] = useState<string | null>(null);
  const [comunaFilter, setComunaFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());
  const [collapsedStages, setCollapsedStages] = useState<Set<Stage>>(new Set<Stage>());
  const [preview, setPreview] = useState<BandejaRowPreview | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        const row = rows.find((item) => item.id === id);
        if (row && nextActionFor(row.status).stage === "triaje") next.add(id);
      }
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (secretariaFilter && row.secretaria_id !== secretariaFilter) return false;
      if (comunaFilter && row.comuna_id !== comunaFilter) return false;
      if (!deferredSearch) return true;

      const haystack = [
        row.id,
        row.radicado,
        row.lead,
        row.display_text,
        row.tipo,
        row.secretariaName,
        row.comunaLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [rows, secretariaFilter, comunaFilter, deferredSearch]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, Row[]>();
    for (const stage of ACTIVE_STAGES) map.set(stage, []);
    for (const row of visibleRows) {
      const stage = nextActionFor(row.status).stage;
      if (map.has(stage)) map.get(stage)?.push(row);
    }
    return map;
  }, [visibleRows]);

  const total = visibleRows.length;
  const triageRows = byStage.get("triaje") ?? [];
  const p0Triage = triageRows.filter((row) => row.priority_level === "P0_critica").length;
  const selectedVisibleTriage = triageRows.filter((row) => selectedIds.has(row.id)).length;
  const allVisibleTriageSelected =
    triageRows.length > 0 && selectedVisibleTriage === triageRows.length;
  const someVisibleTriageSelected =
    selectedVisibleTriage > 0 && selectedVisibleTriage < triageRows.length;

  const activeSecretarias = useMemo(
    () => secretarias.filter((item) => rows.some((row) => row.secretaria_id === item.id)),
    [secretarias, rows],
  );
  const activeComunas = useMemo(
    () => comunas.filter((item) => rows.some((row) => row.comuna_id === item.id)),
    [comunas, rows],
  );

  const hasFilters = Boolean(searchValue || secretariaFilter || comunaFilter);

  const runBulkAction = (action: "classify" | "assign") => {
    if (selectedIds.size === 0 || isPending) return;

    const ids = [...selectedIds].filter((id) => {
      const row = rows.find((item) => item.id === id);
      return row ? nextActionFor(row.status).stage === "triaje" : false;
    });
    if (ids.length === 0) return;

    const idsSet = new Set(ids);
    const rollbackRows = rows;
    const targetStatus: QueuePqr["status"] = action === "classify" ? "accepted" : "assigned";

    setBulkError(null);
    setRows((prev) =>
      prev.map((row) =>
        idsSet.has(row.id)
          ? {
              ...row,
              status: targetStatus,
            }
          : row,
      ),
    );
    setSelectedIds(new Set<string>());

    startTransition(async () => {
      try {
        const result = await applyBulkTriageAction({ ids, action });
        if (result.updated !== ids.length) {
          setBulkError(
            `Se procesaron ${result.updated} de ${ids.length} casos. Refresca para sincronizar la bandeja.`,
          );
        }
      } catch (error) {
        setRows(rollbackRows);
        setBulkError(
          error instanceof Error ? error.message : "No se pudo aplicar la accion en lote.",
        );
      }
    });
  };

  const toggleStage = (stage: Stage) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  return (
    <>
      <section className="glass-panel rounded-xl border border-white/10 bg-[rgba(17,17,17,0.62)] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3">
          <SearchInput
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Buscar por radicado, id o texto del caso..."
          />

          <div className="flex flex-col gap-2">
            <ChipRow
              label="Secretaria"
              options={activeSecretarias}
              selected={secretariaFilter}
              onSelect={setSecretariaFilter}
            />
            <ChipRow
              label="Comuna"
              options={activeComunas}
              selected={comunaFilter}
              onSelect={setComunaFilter}
            />
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                setSecretariaFilter(null);
                setComunaFilter(null);
              }}
              className="w-fit rounded-md border border-white/10 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </section>
      <div
        aria-hidden
        className="h-px border-b border-white/[0.03] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
      />

      <HeroCard total={total} byStage={byStage} p0TriageCount={p0Triage} hasFilters={hasFilters} />

      {ACTIVE_STAGES.map((stage) => {
        const stageRows = byStage.get(stage) ?? [];
        const collapsed = collapsedStages.has(stage);
        return (
          <section key={stage} aria-label={STAGE_LABEL[stage]} className="rounded-xl border border-white/5 bg-[rgba(17,17,17,0.48)] p-3">
            <StageHeader
              stage={stage}
              count={stageRows.length}
              collapsed={collapsed}
              onToggle={() => toggleStage(stage)}
              triageControls={
                stage === "triaje" && stageRows.length > 0 ? (
                  <label className="inline-flex items-center gap-2 text-[11px] text-fg-muted">
                    <EmeraldCheckbox
                      checked={allVisibleTriageSelected}
                      indeterminate={someVisibleTriageSelected}
                      onChange={(checked) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          for (const row of stageRows) {
                            if (checked) next.add(row.id);
                            else next.delete(row.id);
                          }
                          return next;
                        });
                      }}
                      ariaLabel="Seleccionar todos los casos visibles de triaje"
                    />
                    Seleccionar visibles
                  </label>
                ) : null
              }
            />

            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.div
                  key={`${stage}-content`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1, transition: { duration: 0.28, ease: STAGGER_EASE } }}
                  exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: STAGGER_EASE } }}
                  className="overflow-hidden"
                >
                  {stageRows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-xs text-fg-subtle">
                      Sin PQR en esta etapa.
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {stageRows.slice(0, 10).map((pqr, index) => (
                        <motion.li
                          key={pqr.id}
                          custom={index}
                          initial="hidden"
                          animate="visible"
                          variants={ROW_VARIANTS}
                        >
                          <BandejaRow
                            pqr={pqr}
                            secretariaName={pqr.secretariaName}
                            comunaLabel={pqr.comunaLabel}
                            selectable={stage === "triaje"}
                            selected={selectedIds.has(pqr.id)}
                            onSelectedChange={(checked) =>
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(pqr.id);
                                else next.delete(pqr.id);
                                return next;
                              })
                            }
                            onQuickPreview={setPreview}
                          />
                        </motion.li>
                      ))}
                    </ul>
                  )}

                  {stageRows.length > 10 ? (
                    <Link
                      href={linkForStage(stage)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-brand transition-colors hover:text-brand-hover"
                    >
                      Ver los {stageRows.length} en la cola completa
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        );
      })}

      {bulkError ? (
        <p
          role="alert"
          className="rounded-lg border border-overdue/40 bg-overdue/10 px-3 py-2 text-xs text-overdue"
        >
          {bulkError}
        </p>
      ) : null}

      <AnimatePresence>
        {selectedIds.size > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: STAGGER_EASE }}
            className="fixed bottom-4 left-1/2 z-20 flex w-[min(760px,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-white/10 bg-[rgba(17,17,17,0.78)] p-3 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
          >
            <p className="text-sm font-medium text-fg">
              {selectedIds.size} seleccionado{selectedIds.size === 1 ? "" : "s"} en triaje
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runBulkAction("classify")}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg transition-colors hover:bg-brand-hover disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Clasificar
              </button>
              <button
                type="button"
                onClick={() => runBulkAction("assign")}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-white/[0.04] disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Asignar
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set<string>())}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg disabled:opacity-60"
              >
                Limpiar
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <QuickPreviewDrawer preview={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function HeroCard({
  total,
  byStage,
  p0TriageCount,
  hasFilters,
}: {
  total: number;
  byStage: Map<Stage, Row[]>;
  p0TriageCount: number;
  hasFilters: boolean;
}) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ok/35 bg-ok/10 p-4 text-sm text-ok">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">
            {hasFilters ? "Sin resultados para los filtros actuales." : "Todo al dia."}
          </p>
          <p className="text-xs text-ok/80">
            {hasFilters
              ? "Ajusta chips o busqueda para ver mas casos."
              : "No hay PQR activas en ninguna etapa."}
          </p>
        </div>
      </div>
    );
  }

  const triage = byStage.get("triaje")?.length ?? 0;
  const heroStage: Stage =
    triage > 0
      ? "triaje"
      : (ACTIVE_STAGES.find((stage) => (byStage.get(stage)?.length ?? 0) > 0) ?? "triaje");
  const heroCount = byStage.get(heroStage)?.length ?? 0;

  return (
    <div className="rounded-xl border border-white/8 bg-[rgba(17,17,17,0.62)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
            Empieza por aqui
          </p>
          <h2 className="mt-1 text-xl font-semibold text-fg">
            {heroCount} PQR{heroCount === 1 ? "" : "s"} pendiente
            {heroCount === 1 ? "" : "s"} de {STAGE_LABEL[heroStage].toLowerCase()}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{STAGE_COPY[heroStage].summary}</p>
        </div>
        <Link
          href={linkForStage(heroStage)}
          className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg transition-colors hover:bg-brand-hover"
        >
          {STAGE_COPY[heroStage].cta}
        </Link>
      </div>

      {p0TriageCount > 0 ? (
        <div
          role="alert"
          aria-live="polite"
          className="mt-4 flex items-start gap-2 rounded-lg border border-p0/40 bg-p0/10 px-3 py-2 text-xs text-p0"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <strong>{p0TriageCount} P0 critica{p0TriageCount === 1 ? "" : "s"}</strong> en triaje.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function StageHeader({
  stage,
  count,
  collapsed,
  onToggle,
  triageControls,
}: {
  stage: Stage;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  triageControls?: ReactNode;
}) {
  const health = stageHealth(stage, count);
  return (
    <header className="mb-2 flex items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          {STAGE_LABEL[stage]}
          {stage === "triaje" ? (
            <InlineTooltip text="Fase inicial de clasificacion y verificacion de requisitos minimos">
              <Info className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
            </InlineTooltip>
          ) : null}
          <span
            className={clsx(
              "inline-flex items-center rounded-md border px-1.5 py-[1px] font-mono text-xs tnum",
              health.tone,
            )}
          >
            {count}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
            {health.label}
          </span>
        </h2>
        <p className="mt-0.5 text-[11px] text-fg-muted">{STAGE_COPY[stage].summary}</p>
      </div>

      <div className="flex items-center gap-2">
        {triageControls}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-fg-muted transition-colors hover:bg-white/[0.04] hover:text-fg"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expandir ${STAGE_LABEL[stage]}` : `Contraer ${STAGE_LABEL[stage]}`}
        >
          {collapsed ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          )}
          {collapsed ? "Expandir" : "Contraer"}
        </button>
      </div>
    </header>
  );
}

function InlineTooltip({
  children,
  text,
}: {
  children: ReactNode;
  text: string;
}) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        className="inline-flex items-center rounded text-fg-subtle outline-none transition-colors hover:text-fg group-focus-within:text-fg"
      >
        {children}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 w-max max-w-[260px] -translate-x-1/2 rounded-md border border-white/10 bg-[rgba(17,17,17,0.95)] px-2 py-1 text-[10px] font-medium leading-4 text-fg opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function stageHealth(stage: Stage, count: number): { tone: string; label: string } {
  const warnThreshold = stage === "triaje" ? 20 : 14;
  const dangerThreshold = stage === "triaje" ? 35 : 26;
  if (count > dangerThreshold) {
    return {
      tone: "border-overdue/45 bg-overdue/15 text-overdue",
      label: "Critico",
    };
  }
  if (count > warnThreshold) {
    return {
      tone: "border-at-risk/45 bg-at-risk/15 text-at-risk",
      label: "Atencion",
    };
  }
  return {
    tone: "border-ok/40 bg-ok/10 text-ok",
    label: "Estable",
  };
}

function ChipRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: Option[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-fg-subtle">{label}:</span>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        <FilterChip active={selected === null} label="Todas" onClick={() => onSelect(null)} />
        {options.map((option) => (
          <FilterChip
            key={option.id}
            active={selected === option.id}
            label={option.label}
            onClick={() => onSelect(selected === option.id ? null : option.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-all",
        active
          ? "border-brand/45 bg-brand/20 text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
          : "border-white/10 bg-white/[0.03] text-fg-muted hover:bg-white/[0.06] hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function QuickPreviewDrawer({
  preview,
  onClose,
}: {
  preview: BandejaRowPreview | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {preview ? (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar vista rapida"
            className="fixed inset-0 z-30 bg-black/50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Vista rapida ${preview.radicadoLabel}`}
            className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l border-white/10 bg-[rgba(17,17,17,0.9)] p-5 backdrop-blur-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={DRAWER_SPRING}
          >
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-base font-semibold text-fg">{preview.title}</h3>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
                  {preview.radicadoLabel}
                </p>
              </div>
              <PriorityBadge level={preview.priorityLevel} size="xs" />
            </header>

            <p className="mt-4 text-sm leading-6 text-fg-muted">{preview.description}</p>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-medium text-fg">{preview.actionTitle}</p>
              <p className="mt-1 text-xs text-fg-muted">{preview.actionBlurb}</p>
              <p className="mt-3 text-xs text-fg-subtle">
                {(preview.secretariaName || "Sin secretaria")} - {(preview.comunaLabel || "Sin comuna")}
              </p>
              <p className="mt-1 text-xs text-fg-subtle">SLA: {formatDateCO(preview.legalDeadline)}</p>
            </div>

            <footer className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg"
              >
                Cerrar
              </button>
              <Link
                href={`/pqr/${preview.id}`}
                className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg transition-colors hover:bg-brand-hover"
              >
                Abrir expediente
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function linkForStage(stage: Stage): string {
  const map: Record<Stage, string> = {
    triaje: "/queue?status=received",
    asignacion: "/queue?status=accepted",
    borrador: "/queue?status=assigned",
    revision: "/queue?status=in_review",
    envio: "/queue?status=approved",
    cerrado: "/queue?status=sent",
    descartado: "/queue",
  };
  return map[stage];
}
