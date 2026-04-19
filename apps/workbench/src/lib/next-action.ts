import type { Database } from "@omega/db/types";

type Status = Database["public"]["Enums"]["pqr_status"];

export type Stage =
  | "triaje"
  | "asignacion"
  | "borrador"
  | "revision"
  | "envio"
  | "cerrado"
  | "descartado";

export type NextAction = {
  stage: Stage;
  title: string;
  verb: string;
  blurb: string;
  checklist: readonly string[];
  tone: "urgent" | "work" | "review" | "done" | "muted";
};

const ACTION_BY_STATUS: Record<Status, NextAction> = {
  received: {
    stage: "triaje",
    title: "Pendiente de triaje",
    verb: "Revisar y clasificar",
    blurb:
      "Confirma que la PQR cumple estructura mínima y respeto. Clasifica tipo + dependencia competente o devuelve al ciudadano.",
    checklist: [
      "Lee los hechos y la petición concreta",
      "Verifica respeto y anonimato",
      "Clasifica tipo (petición / queja / reclamo)",
      "Asigna dependencia competente o devuelve",
    ],
    tone: "urgent",
  },
  accepted: {
    stage: "asignacion",
    title: "Lista para asignar",
    verb: "Asignar funcionario",
    blurb:
      "La PQR fue aceptada. Asígnala al funcionario responsable dentro de la secretaría competente para iniciar el borrador.",
    checklist: [
      "Confirma la secretaría competente",
      "Selecciona funcionario con carga disponible",
      "Verifica plazo Ley 1755 restante",
    ],
    tone: "work",
  },
  assigned: {
    stage: "borrador",
    title: "Redactar borrador",
    verb: "Redactar respuesta",
    blurb:
      "Redacta el borrador con apoyo del banco de normativa. Cada cita debe referenciar artículo exacto de Ley 1755, Ley 1581 o decreto reglamentario aplicable.",
    checklist: [
      "Reúne hechos, petición y normativa aplicable",
      "Redacta con citación explícita",
      "Adjunta evidencia o documentación",
    ],
    tone: "work",
  },
  in_draft: {
    stage: "revision",
    title: "Aprobar borrador",
    verb: "Revisar y aprobar",
    blurb:
      "El funcionario dejó un borrador. Valida fondo jurídico, citaciones y tono antes de aprobar o devolver con observaciones.",
    checklist: [
      "Verifica que responde a la petición concreta",
      "Confirma citaciones y vigencia normativa",
      "Revisa tono institucional + Habeas Data",
    ],
    tone: "review",
  },
  in_review: {
    stage: "revision",
    title: "En revisión jurídica",
    verb: "Completar revisión",
    blurb:
      "Borrador abierto en revisión. Aprueba para enviar al ciudadano o devuélvelo con observaciones concretas.",
    checklist: [
      "Aprueba si cumple fondo + forma",
      "Devuelve con comentario si requiere ajustes",
    ],
    tone: "review",
  },
  approved: {
    stage: "envio",
    title: "Lista para enviar",
    verb: "Enviar al ciudadano",
    blurb:
      "Respuesta aprobada. Dispara el envío por el canal de origen y registra el acuse de recibo.",
    checklist: [
      "Confirma canal de notificación (email / portal / físico)",
      "Envía y registra timestamp",
      "Cierra el radicado cuando quede acuse",
    ],
    tone: "work",
  },
  sent: {
    stage: "cerrado",
    title: "Respuesta enviada",
    verb: "Esperar acuse",
    blurb:
      "Ya respondimos. Monitorea hasta que el ciudadano acuse recibo o venza el plazo de seguimiento.",
    checklist: [
      "Revisa acuse de recibo en el canal",
      "Cierra cuando proceda",
    ],
    tone: "done",
  },
  closed: {
    stage: "cerrado",
    title: "Caso cerrado",
    verb: "—",
    blurb: "No requiere acción. Queda en el histórico para auditoría y analítica.",
    checklist: [],
    tone: "done",
  },
  bounced_incomplete: {
    stage: "descartado",
    title: "Devuelta al ciudadano",
    verb: "Esperar información",
    blurb:
      "Se solicitó información adicional al ciudadano. El plazo Ley 1755 se reinicia cuando responda.",
    checklist: ["Reactivar cuando llegue la info faltante"],
    tone: "muted",
  },
  rejected_disrespectful: {
    stage: "descartado",
    title: "Rechazada por irrespetuosa",
    verb: "—",
    blurb:
      "No procedió por faltar al respeto. El rechazo quedó registrado en auditoría con justificación.",
    checklist: [],
    tone: "muted",
  },
  transferred: {
    stage: "descartado",
    title: "Trasladada a otra entidad",
    verb: "—",
    blurb:
      "Ya no es de nuestra competencia. La entidad receptora asumió el caso y el plazo.",
    checklist: [],
    tone: "muted",
  },
};

export function nextActionFor(status: Status): NextAction {
  return ACTION_BY_STATUS[status];
}

export const ACTIVE_STAGES: readonly Stage[] = [
  "triaje",
  "asignacion",
  "borrador",
  "revision",
  "envio",
];

export const STAGE_ORDER: Record<Stage, number> = {
  triaje: 0,
  asignacion: 1,
  borrador: 2,
  revision: 3,
  envio: 4,
  cerrado: 5,
  descartado: 6,
};

export const STAGE_LABEL: Record<Stage, string> = {
  triaje: "Triaje",
  asignacion: "Asignación",
  borrador: "Borrador",
  revision: "Revisión",
  envio: "Envío",
  cerrado: "Cerrado",
  descartado: "Descartado",
};

export const STAGE_COPY: Record<Stage, { summary: string; cta: string }> = {
  triaje: {
    summary:
      "PQR nuevas sin clasificar. Jurídica decide si son válidas, a qué secretaría pertenecen y si hay señales de riesgo (tutela, vulnerabilidad).",
    cta: "Abrir triaje",
  },
  asignacion: {
    summary:
      "Ya aceptadas. Falta designar funcionario responsable dentro de la dependencia competente.",
    cta: "Asignar funcionario",
  },
  borrador: {
    summary:
      "Funcionario asignado. Falta redactar el borrador de respuesta con citaciones normativas.",
    cta: "Abrir redacción",
  },
  revision: {
    summary:
      "Borrador listo. Jurídica valida fondo, forma y citaciones antes de aprobar.",
    cta: "Revisar borrador",
  },
  envio: {
    summary:
      "Respuesta aprobada. Dispara el envío por el canal de origen y cierra el radicado.",
    cta: "Enviar respuesta",
  },
  cerrado: { summary: "Casos resueltos, en espera de acuse o archivados.", cta: "Ver" },
  descartado: {
    summary: "Devueltas, rechazadas o trasladadas. Fuera del flujo activo.",
    cta: "Ver",
  },
};
