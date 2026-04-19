import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  NormalizedIntakeSchema,
  BOUNCE_REASONS,
  SCHEMA_ERROR_MESSAGES,
  errorToStep,
  type Attachment,
  type BounceReason,
  type NormalizedIntake,
} from "@/lib/intake-schema";

export const Route = createFileRoute("/portal/radicar")({
  head: () => ({
    meta: [{ title: "Radicar PQRSD — Alcaldía de Medellín" }],
  }),
  component: RadicarPage,
});

const STEPS = ["Identificación", "Ubicación", "Descripción", "Revisión"] as const;

type Step = 1 | 2 | 3 | 4;

type FormState = {
  // Paso 1
  is_anonymous: boolean;
  citizen_name: string;
  document_id: string;
  email: string;
  phone: string;
  consent_data: boolean;
  // Paso 2
  location_text: string;
  // Paso 3
  subject: string;
  description: string;
  // Paso 4
  attachments: Attachment[];
};

type Result =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "accepted"; data: AcceptedResponse }
  | { kind: "duplicate"; data: DuplicateResponse }
  | { kind: "bounced"; data: BouncedResponse }
  | { kind: "schema_error"; errors: string[] }
  | { kind: "network_error"; message: string };

type AcceptedResponse = {
  radicado: string;
  pqr_id: string;
  lead: string;
  secretaria_id: string;
  priority_level: "P0" | "P1" | "P2" | "P3";
  priority_score: number;
  legal_deadline: string;
};
type DuplicateResponse = { duplicate_of: string; radicado: string };
type BouncedResponse = { radicado: string; reasons: BounceReason[]; message: string };

const INITIAL: FormState = {
  is_anonymous: false,
  citizen_name: "",
  document_id: "",
  email: "",
  phone: "",
  consent_data: false,
  location_text: "",
  subject: "",
  description: "",
  attachments: [],
};

function RadicarPage() {
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<FormState>(INITIAL);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  // Resultados terminales
  if (result.kind === "accepted") return <Exito data={result.data} reset={() => { setResult({ kind: "idle" }); setState(INITIAL); setStep(1); }} />;
  if (result.kind === "duplicate") return <Duplicada data={result.data} />;
  if (result.kind === "bounced") return <Rebotada data={result.data} reset={() => setResult({ kind: "idle" })} />;

  // Validaciones por gate
  const hasContact = !!(state.email.trim() || state.document_id.trim() || state.phone.trim());
  const canStep1 = state.consent_data === true;
  const canStep2 = true; // location_text es nullable
  const canStep3 =
    state.subject.trim().length > 0 &&
    state.description.trim().length > 0 &&
    state.description.length <= 10000;

  const canNext =
    (step === 1 && canStep1) ||
    (step === 2 && canStep2) ||
    (step === 3 && canStep3) ||
    step === 4;

  const submit = async () => {
    setResult({ kind: "submitting" });

    const payload: NormalizedIntake = {
      source_channel: "web",
      citizen_name: state.is_anonymous ? null : state.citizen_name.trim() || null,
      is_anonymous: state.is_anonymous,
      document_id: state.is_anonymous ? null : state.document_id.trim() || null,
      email: state.is_anonymous ? null : state.email.trim() || null,
      phone: state.is_anonymous ? null : state.phone.trim() || null,
      subject: state.subject.trim(),
      description: state.description.trim(),
      raw_text: state.description.trim(),
      attachments: state.attachments,
      location_text: state.location_text.trim() || null,
      consent_data: true as const,
      created_at: new Date().toISOString(),
    };

    // Validación cliente (previene la mayoría de 400s).
    const parsed = NormalizedIntakeSchema.safeParse(payload);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => i.message);
      setResult({ kind: "schema_error", errors });
      // Saltar al paso culpable
      const firstStep = errors.map(errorToStep).sort((a, b) => a - b)[0];
      if (firstStep) setStep(firstStep);
      return;
    }

    const base = (import.meta.env.VITE_N8N_WEBHOOK_BASE_URL as string | undefined) ?? "";
    if (!base) {
      // Modo demo sin webhook configurado — simulamos un éxito local.
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const code = Math.random().toString(16).slice(2, 8).toUpperCase();
      const radicado = `MED-${today}-${code}`;
      const deadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      setResult({
        kind: "accepted",
        data: {
          radicado,
          pqr_id: crypto.randomUUID(),
          lead: `Solicitud radicada en modo demo: ${parsed.data.subject}.`,
          secretaria_id: "SINF",
          priority_level: "P2",
          priority_score: 42,
          legal_deadline: deadline,
        },
      });
      return;
    }

    try {
      const res = await fetch(`${base}/pqrs/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      switch (res.status) {
        case 201:
          setResult({ kind: "accepted", data: data as AcceptedResponse });
          return;
        case 200:
          setResult({ kind: "duplicate", data: data as DuplicateResponse });
          return;
        case 400:
          setResult({ kind: "schema_error", errors: (data?.errors as string[]) ?? [] });
          {
            const errs = (data?.errors as string[]) ?? [];
            const firstStep = errs.map(errorToStep).sort((a, b) => a - b)[0];
            if (firstStep) setStep(firstStep);
          }
          return;
        case 422:
          setResult({ kind: "bounced", data: data as BouncedResponse });
          return;
        default:
          setResult({ kind: "network_error", message: `Error ${res.status}. Intente de nuevo.` });
      }
    } catch (e) {
      setResult({
        kind: "network_error",
        message: e instanceof Error ? e.message : "Error de red. Intente de nuevo.",
      });
    }
  };

  const schemaErrors = result.kind === "schema_error" ? result.errors : [];
  const errorOnField = (field: string) =>
    schemaErrors.find((e) => e.toLowerCase().includes(field.toLowerCase()));

  return (
    <section className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <div className="mb-8">
        <Link to="/portal" className="text-sm text-muted-foreground hover:text-primary">
          ← Volver al portal
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
          Radicar una PQRSD
        </h1>
        <p className="mt-2 text-muted-foreground">
          Cuatro pasos. Validamos en su navegador antes de enviar para evitar rebotes.
        </p>
      </div>

      {/* Stepper */}
      <ol className="mb-10 grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          return (
            <li key={label} className="flex flex-col gap-2">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  n <= step ? "bg-primary" : "bg-hairline"
                }`}
                aria-current={n === step ? "step" : undefined}
              />
              <div className={`text-xs ${n === step ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {n}. {label}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Banner de errores 400 */}
      {schemaErrors.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-destructive">
            Revise estos campos
          </div>
          <ul className="mt-2 space-y-1 text-sm text-destructive/90">
            {schemaErrors.map((e) => (
              <li key={e}>• {SCHEMA_ERROR_MESSAGES[e] ?? e}</li>
            ))}
          </ul>
        </div>
      )}

      {result.kind === "network_error" && (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm text-warning">
          {result.message}
        </div>
      )}

      <div className="rounded-2xl border border-hairline bg-surface/60 p-6 md:p-8">
        {step === 1 && (
          <Step1
            state={state}
            update={update}
            hasContact={hasContact}
            consentError={!!errorOnField("consent_data")}
          />
        )}
        {step === 2 && <Step2 state={state} update={update} />}
        {step === 3 && (
          <Step3
            state={state}
            update={update}
            subjectError={!!errorOnField("subject")}
            descriptionError={!!errorOnField("description") || !!errorOnField("raw_text")}
          />
        )}
        {step === 4 && <Step4 state={state} update={update} jumpTo={setStep} />}

        <div className="mt-8 flex items-center justify-between border-t border-hairline pt-6">
          <button
            type="button"
            onClick={() => setStep((s) => (Math.max(1, s - 1) as Step))}
            disabled={step === 1}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Anterior
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (Math.min(4, s + 1) as Step))}
              disabled={!canNext}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-50 disabled:shadow-none"
            >
              Continuar
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={result.kind === "submitting"}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {result.kind === "submitting" ? "Radicando..." : "Radicar PQRSD"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- PASO 1: Identidad ----------------------------- */
function Step1({
  state,
  update,
  hasContact,
  consentError,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  hasContact: boolean;
  consentError: boolean;
}) {
  return (
    <fieldset className="space-y-6">
      <div>
        <legend className="text-lg font-medium tracking-tight">¿Con quién hablamos?</legend>
        <p className="mt-1 text-sm text-muted-foreground">
          Puede radicar de forma identificada o anónima. La Alcaldía está obligada a responder en ambos casos.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-hairline bg-background/60 p-4">
        <input
          type="checkbox"
          checked={state.is_anonymous}
          onChange={(e) => update("is_anonymous", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-hairline accent-[var(--primary)]"
        />
        <div>
          <div className="text-sm font-medium text-foreground">Radicar de forma anónima</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Como anónimo no podremos contactarle para pedir información adicional. La PQR se procesa
            igual, pero si el agente de validez detecta que falta un contacto verificable, la rebotará.
          </div>
        </div>
      </label>

      {!state.is_anonymous && (
        <div className="space-y-4">
          <Input
            label="Nombre completo"
            value={state.citizen_name}
            onChange={(v) => update("citizen_name", v)}
            placeholder="María Restrepo"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Documento (CC, CE, NIT...)"
              value={state.document_id}
              onChange={(v) => update("document_id", v)}
              placeholder="1036123456"
              inputMode="numeric"
            />
            <Input
              label="Teléfono (opcional)"
              value={state.phone}
              onChange={(v) => update("phone", v)}
              placeholder="3001234567"
              type="tel"
            />
          </div>
          <Input
            label="Correo electrónico"
            value={state.email}
            onChange={(v) => update("email", v)}
            placeholder="usted@correo.com"
            type="email"
          />
          {!hasContact && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              Sin email, documento ni teléfono la PQR puede rebotar tras el análisis de validez.
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Sus datos se tratan según la Ley 1581/2012. Solo los usaremos para responder esta PQRSD.
          </p>
        </div>
      )}

      <label
        className={`flex items-start gap-3 rounded-xl border p-4 ${
          consentError
            ? "border-destructive bg-destructive/5"
            : state.consent_data
            ? "border-primary/40 bg-primary/5"
            : "border-hairline bg-background/60"
        }`}
      >
        <input
          type="checkbox"
          checked={state.consent_data}
          onChange={(e) => update("consent_data", e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-hairline accent-[var(--primary)]"
          required
        />
        <div className="text-sm">
          <div className="font-medium text-foreground">
            Autorizo el tratamiento de mis datos personales (Ley 1581/2012).
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Obligatorio para procesar su PQRSD.
          </div>
        </div>
      </label>
    </fieldset>
  );
}

/* ----------------------------- PASO 2: Ubicación ----------------------------- */
function Step2({
  state,
  update,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <fieldset className="space-y-5">
      <div>
        <legend className="text-lg font-medium tracking-tight">¿Dónde está pasando?</legend>
        <p className="mt-1 text-sm text-muted-foreground">
          Use esta información para asignar su PQR a la secretaría correcta. Sea específico si puede.
        </p>
      </div>
      <Textarea
        label="Lugar"
        value={state.location_text}
        onChange={(v) => update("location_text", v)}
        rows={4}
        placeholder="Ejemplo: Comuna 11 Laureles, calle 44 # 76-20, cerca del parque principal."
      />
      <p className="text-xs text-muted-foreground">
        Este campo es opcional. Si no aplica, puede dejarlo en blanco.
      </p>
    </fieldset>
  );
}

/* ----------------------------- PASO 3: Descripción ----------------------------- */
function Step3({
  state,
  update,
  subjectError,
  descriptionError,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  subjectError: boolean;
  descriptionError: boolean;
}) {
  const len = state.description.length;
  const exceeded = len > 10000;
  return (
    <fieldset className="space-y-5">
      <div>
        <legend className="text-lg font-medium tracking-tight">¿Qué pasó?</legend>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuéntenos qué ocurrió, cuándo y qué solicita a la Alcaldía.
        </p>
      </div>

      <div>
        <Input
          label="Asunto"
          value={state.subject}
          onChange={(v) => update("subject", v.slice(0, 120))}
          placeholder="Resumen breve, máximo una línea"
          error={subjectError}
        />
        <div className="mt-1 text-right font-mono text-[11px] text-muted-foreground">
          {state.subject.length} / 120
        </div>
      </div>

      <div>
        <Textarea
          label="Descripción"
          value={state.description}
          onChange={(v) => update("description", v)}
          rows={8}
          placeholder="Hechos, lugar, fechas. Sea concreto."
          error={descriptionError || exceeded}
        />
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            Evite incluir cédulas o datos sensibles de terceros que no sean esenciales.
          </span>
          <span className={`font-mono ${exceeded ? "text-destructive" : "text-muted-foreground"}`}>
            {len.toLocaleString("es-CO")} / 10 000
          </span>
        </div>
        {exceeded && (
          <div className="mt-2 text-xs text-destructive">
            La descripción excede el límite legal de 10 000 caracteres.
          </div>
        )}
      </div>
    </fieldset>
  );
}

/* ----------------------------- PASO 4: Adjuntos + Revisión ----------------------------- */
function Step4({
  state,
  update,
  jumpTo,
}: {
  state: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  jumpTo: (s: Step) => void;
}) {
  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [...state.attachments];
    for (const f of Array.from(files)) {
      if (next.length >= 5) break;
      if (f.size > 20 * 1024 * 1024) continue;
      // Stub local: en producción aquí se subiría a Supabase Storage y se obtendría la storage_path firmada.
      next.push({
        storage_path: `pqr-attachments/${crypto.randomUUID()}-${f.name}`,
        mime_type: f.type || "application/octet-stream",
        size_bytes: f.size,
      });
    }
    update("attachments", next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium tracking-tight">Revise y envíe</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adjunte evidencias si las tiene, y confirme la información.
        </p>
      </div>

      {/* Adjuntos */}
      <div className="rounded-xl border border-dashed border-hairline bg-background/40 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Adjuntos (opcional · máx 5 archivos · 20 MB c/u · JPG, PNG, PDF, MP4)
        </div>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf,video/mp4"
          onChange={(e) => onFiles(e.target.files)}
          className="mt-3 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
        />
        {state.attachments.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-xs">
            {state.attachments.map((a, i) => (
              <li
                key={a.storage_path}
                className="flex items-center justify-between rounded-lg border border-hairline bg-surface/60 px-3 py-2"
              >
                <span className="truncate font-mono text-foreground/80">
                  {a.storage_path.split("/").pop()}
                </span>
                <span className="ml-3 flex items-center gap-3">
                  <span className="font-mono text-muted-foreground">
                    {(a.size_bytes / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => update("attachments", state.attachments.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Quitar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Resumen */}
      <dl className="divide-y divide-hairline rounded-xl border border-hairline bg-background/40">
        <SummaryRow
          label="Identificación"
          value={
            state.is_anonymous
              ? "Anónima"
              : `${state.citizen_name || "—"}${state.email ? " · " + state.email : ""}${
                  state.document_id ? " · " + state.document_id : ""
                }`
          }
          onEdit={() => jumpTo(1)}
        />
        <SummaryRow
          label="Lugar"
          value={state.location_text || "Sin especificar"}
          onEdit={() => jumpTo(2)}
        />
        <SummaryRow label="Asunto" value={state.subject || "—"} onEdit={() => jumpTo(3)} />
        <SummaryRow
          label="Descripción"
          value={state.description || "—"}
          multiline
          onEdit={() => jumpTo(3)}
        />
        <SummaryRow
          label="Adjuntos"
          value={state.attachments.length > 0 ? `${state.attachments.length} archivo(s)` : "Ninguno"}
        />
      </dl>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-xs text-foreground/80">
        Al enviar, su PQR entra al sistema de la Alcaldía. Recibirá un radicado{" "}
        <span className="font-mono text-primary">MED-YYYYMMDD-XXXXXX</span>. El plazo de respuesta se
        calcula automáticamente: entre 1 y 30 días hábiles según prioridad y tipo.
      </div>
    </div>
  );
}

/* ----------------------------- PANTALLAS DE RESULTADO ----------------------------- */

function Exito({ data, reset }: { data: AcceptedResponse; reset: () => void }) {
  const deadline = useMemo(() => {
    try {
      return new Date(data.legal_deadline).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return data.legal_deadline;
    }
  }, [data.legal_deadline]);

  const tone =
    data.priority_level === "P0"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : data.priority_level === "P1"
      ? "border-warning/40 bg-warning/10 text-warning"
      : data.priority_level === "P2"
      ? "border-warning/30 bg-warning/5 text-warning"
      : "border-primary/40 bg-primary/10 text-primary";

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="rounded-2xl border border-hairline bg-surface/60 p-10 text-center shadow-card">
        <span className="grid mx-auto h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Su PQRSD fue radicada</h1>
        <p className="mt-3 text-muted-foreground">
          Guarde este número, lo necesitará para hacer seguimiento.
        </p>
        <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-primary/40 bg-background px-5 py-4 font-mono text-lg tracking-wide text-primary">
          {data.radicado}
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(data.radicado)}
            className="rounded-md border border-hairline bg-surface/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Copiar
          </button>
        </div>

        <div className="mt-8 grid gap-2 sm:grid-cols-3">
          <Chip tone="border-primary/30 bg-primary/5 text-primary" label="Secretaría" value={data.secretaria_id} />
          <Chip tone={tone} label="Prioridad" value={data.priority_level} />
          <Chip
            tone="border-hairline bg-background/40 text-foreground"
            label="Vence"
            value={deadline}
          />
        </div>

        {data.lead && (
          <div className="mt-8 rounded-xl border border-hairline bg-background/40 p-5 text-left">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Resumen por IA
            </div>
            <p className="mt-2 italic text-foreground/85">{data.lead}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Síntesis automática — el funcionario verá su texto completo.
            </p>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/portal/seguimiento/$radicado"
            params={{ radicado: data.radicado }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow"
          >
            Consultar estado
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-background px-5 py-3 text-sm font-medium text-foreground hover:bg-surface-elevated"
          >
            Radicar otra PQRSD
          </button>
        </div>
      </div>
    </section>
  );
}

function Duplicada({ data }: { data: DuplicateResponse }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="rounded-2xl border border-hairline bg-surface/60 p-10 text-center shadow-card">
        <span className="grid mx-auto h-16 w-16 place-items-center rounded-full bg-warning/15 text-warning">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Esta PQR ya estaba radicada</h1>
        <p className="mt-3 text-muted-foreground">
          Detectamos que esta petición es idéntica a una que usted ya radicó. Para evitar duplicados,
          le redirigimos al caso original.
        </p>
        <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-primary/40 bg-background px-5 py-4 font-mono text-lg text-primary">
          {data.radicado}
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/portal/seguimiento/$radicado"
            params={{ radicado: data.radicado }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow"
          >
            Ver el caso original
          </Link>
          <Link
            to="/portal/radicar"
            className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-background px-5 py-3 text-sm font-medium text-foreground hover:bg-surface-elevated"
          >
            Radicar algo diferente
          </Link>
        </div>
      </div>
    </section>
  );
}

function Rebotada({ data, reset }: { data: BouncedResponse; reset: () => void }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <div className="rounded-2xl border border-warning/40 bg-warning/5 p-10 shadow-card">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-warning/20 text-warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-3l-8.18-14.14a2 2 0 00-3.46 0z" />
            </svg>
          </span>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Su PQR necesita más información antes de procesarse
            </h1>
            <p className="mt-2 text-sm text-foreground/80">
              Generamos su radicado <span className="font-mono text-primary">{data.radicado}</span>,
              pero quedó pendiente de complementar.
            </p>

            <ul className="mt-6 space-y-2.5 text-sm">
              {data.reasons.map((r) => (
                <li key={r} className="flex items-start gap-2 rounded-lg border border-warning/30 bg-background/40 p-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  <span className="text-foreground/90">{BOUNCE_REASONS[r] ?? r}</span>
                </li>
              ))}
            </ul>

            {data.message && (
              <p className="mt-4 text-xs text-muted-foreground">{data.message}</p>
            )}

            <div className="mt-8">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow"
              >
                Corregir y re-radicar
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- ÁTOMOS DE UI ----------------------------- */

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  error?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 w-full rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
          error
            ? "border-destructive focus:border-destructive focus:ring-destructive/30"
            : "border-hairline focus:border-primary focus:ring-primary/30"
        }`}
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 6,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  error?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 w-full rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 ${
          error
            ? "border-destructive focus:border-destructive focus:ring-destructive/30"
            : "border-hairline focus:border-primary focus:ring-primary/30"
        }`}
      />
    </label>
  );
}

function SummaryRow({
  label,
  value,
  multiline,
  onEdit,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr_auto] items-start gap-4 px-4 py-3 text-sm">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`text-foreground ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>{value}</dd>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-primary hover:underline"
        >
          Editar
        </button>
      )}
    </div>
  );
}

function Chip({ tone, label, value }: { tone: string; label: string; value: string }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-left ${tone}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
