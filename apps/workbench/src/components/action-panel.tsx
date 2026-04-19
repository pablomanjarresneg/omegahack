"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { Database } from "@omega/db/types";
import {
  acceptPqr,
  approveDraft,
  assignPqr,
  bouncePqr,
  closeCase,
  rejectPqr,
  requestReview,
  saveDraftBody,
  sendResponse,
  transferPqr,
  generateDraft,
} from "@/app/pqr/[id]/actions";

type Status = Database["public"]["Enums"]["pqr_status"];
type Secretaria = { id: string; nombre: string };

type Props = {
  pqrId: string;
  status: Status;
  currentSecretariaId: string | null;
  secretarias: Secretaria[];
  draftBody: string | null;
};

export function ActionPanel(props: Props) {
  switch (props.status) {
    case "received":
      return <TriajeActions {...props} />;
    case "accepted":
      return <AsignacionActions {...props} />;
    case "assigned":
      return <BorradorActions {...props} />;
    case "in_draft":
      return <InDraftActions {...props} />;
    case "in_review":
      return <RevisionActions {...props} />;
    case "approved":
      return <EnvioActions {...props} />;
    case "sent":
      return <SentActions {...props} />;
    default:
      return null;
  }
}

function btnClass(variant: "primary" | "danger" | "subtle" | "review") {
  const cls =
    variant === "danger"
      ? "bg-overdue text-white hover:bg-overdue/90"
      : variant === "subtle"
      ? "bg-bg-subtle text-fg hover:bg-surface-hover border border-border"
      : variant === "review"
      ? "bg-p2 text-white hover:bg-p2/90"
      : "bg-brand text-brand-fg hover:bg-brand-hover";
  return clsx(
    "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
    cls,
  );
}

function SubmitBtn({
  pending,
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled,
}: {
  pending: boolean;
  children: React.ReactNode;
  variant?: "primary" | "danger" | "subtle" | "review";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      className={btnClass(variant)}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => {
    setError(null);
    setPending(true);
    void fn()
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Algo falló");
      })
      .finally(() => {
        setPending(false);
      });
  };
  return { pending, error, run };
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-[11px] text-overdue">
      {error}
    </p>
  );
}

function TriajeActions({
  pqrId,
  secretarias,
  currentSecretariaId,
}: Props) {
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<"idle" | "bounce" | "reject" | "transfer">(
    "idle",
  );
  const [reason, setReason] = useState("");
  const [transferTo, setTransferTo] = useState(currentSecretariaId ?? "");

  return (
    <div className="flex flex-col gap-3">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <SubmitBtn pending={pending} onClick={() => run(() => acceptPqr(pqrId))}>
            Aceptar y clasificar
            <ArrowRight className="h-3 w-3" aria-hidden />
          </SubmitBtn>
          <SubmitBtn
            pending={false}
            variant="subtle"
            onClick={() => setMode("bounce")}
          >
            Devolver por incompleta
          </SubmitBtn>
          <SubmitBtn
            pending={false}
            variant="subtle"
            onClick={() => setMode("transfer")}
          >
            Trasladar por competencia
          </SubmitBtn>
          <SubmitBtn
            pending={false}
            variant="danger"
            onClick={() => setMode("reject")}
          >
            Rechazar por irrespetuosa
          </SubmitBtn>
        </div>
      ) : mode === "transfer" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!transferTo) return;
            run(() => transferPqr(pqrId, transferTo));
          }}
        >
          <label className="flex flex-col text-[11px] text-fg-subtle">
            Secretaría destino
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="mt-0.5 min-w-[260px] rounded border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              required
            >
              <option value="">— selecciona —</option>
              {secretarias.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
          <SubmitBtn pending={pending} type="submit" disabled={!transferTo}>
            Trasladar
          </SubmitBtn>
          <SubmitBtn
            pending={false}
            variant="subtle"
            onClick={() => setMode("idle")}
          >
            Cancelar
          </SubmitBtn>
        </form>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = reason.trim();
            if (!trimmed) return;
            run(() =>
              mode === "bounce"
                ? bouncePqr(pqrId, trimmed)
                : rejectPqr(pqrId, trimmed),
            );
          }}
        >
          <label className="text-[11px] text-fg-subtle">
            Motivo (queda en auditoría)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
              minLength={6}
              className="mt-0.5 w-full rounded border border-border bg-surface px-2 py-1.5 text-xs text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder={
                mode === "bounce"
                  ? "Ej: Falta identificación del peticionario y documento soporte."
                  : "Ej: Lenguaje agresivo dirigido a funcionario."
              }
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <SubmitBtn
              pending={pending}
              type="submit"
              variant={mode === "reject" ? "danger" : "primary"}
              disabled={reason.trim().length < 6}
            >
              {mode === "bounce" ? "Devolver" : "Rechazar"}
            </SubmitBtn>
            <SubmitBtn
              pending={false}
              variant="subtle"
              onClick={() => setMode("idle")}
            >
              Cancelar
            </SubmitBtn>
          </div>
        </form>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

function AsignacionActions({ pqrId }: Props) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <SubmitBtn pending={pending} onClick={() => run(() => assignPqr(pqrId))}>
        Asignar a la secretaría
        <ArrowRight className="h-3 w-3" aria-hidden />
      </SubmitBtn>
      <p className="text-[11px] text-fg-subtle">
        El siguiente paso es la redacción del borrador por parte del funcionario asignado.
      </p>
      <ErrorLine error={error} />
    </div>
  );
}

function BorradorActions({ pqrId }: Props) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <SubmitBtn pending={pending} onClick={() => run(() => generateDraft(pqrId))}>
        Generar borrador con normativa
        <ArrowRight className="h-3 w-3" aria-hidden />
      </SubmitBtn>
      <p className="text-[11px] text-fg-subtle">
        Se crea un borrador con citaciones a Ley 1755, Ley 1581 y el decreto aplicable. Puedes editarlo antes de aprobar.
      </p>
      <ErrorLine error={error} />
    </div>
  );
}

function InDraftActions({ pqrId, draftBody }: Props) {
  const { pending, error, run } = useAction();
  const [body, setBody] = useState(draftBody ?? "");
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <label className="text-[11px] text-fg-subtle">
        Cuerpo de la respuesta
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setDirty(true);
          }}
          rows={14}
          className="mt-0.5 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-fg focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitBtn
          pending={pending}
          variant="subtle"
          onClick={() => {
            run(async () => {
              await saveDraftBody(pqrId, body);
              setDirty(false);
            });
          }}
          disabled={!dirty || body.trim().length < 20}
        >
          Guardar cambios
        </SubmitBtn>
        <SubmitBtn
          pending={pending}
          variant="review"
          onClick={() => run(() => requestReview(pqrId))}
        >
          Enviar a revisión
          <ArrowRight className="h-3 w-3" aria-hidden />
        </SubmitBtn>
        <SubmitBtn
          pending={pending}
          variant="subtle"
          onClick={() => run(() => generateDraft(pqrId))}
        >
          Regenerar con plantilla
        </SubmitBtn>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

function RevisionActions({ pqrId }: Props) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <SubmitBtn pending={pending} onClick={() => run(() => approveDraft(pqrId))}>
          Aprobar para envío
          <ArrowRight className="h-3 w-3" aria-hidden />
        </SubmitBtn>
        <SubmitBtn
          pending={pending}
          variant="subtle"
          onClick={() => run(() => assignPqr(pqrId))}
        >
          Devolver al borrador
        </SubmitBtn>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

function EnvioActions({ pqrId }: Props) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <SubmitBtn pending={pending} onClick={() => run(() => sendResponse(pqrId))}>
        Enviar al ciudadano
        <ArrowRight className="h-3 w-3" aria-hidden />
      </SubmitBtn>
      <p className="text-[11px] text-fg-subtle">
        Queda registrado el <code className="rounded bg-bg-subtle px-1">sent_at</code> y el caso pasa a espera de acuse.
      </p>
      <ErrorLine error={error} />
    </div>
  );
}

function SentActions({ pqrId }: Props) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <SubmitBtn pending={pending} onClick={() => run(() => closeCase(pqrId))}>
        Cerrar radicado
      </SubmitBtn>
      <ErrorLine error={error} />
    </div>
  );
}
