import type { Database } from "@omega/db/types";

type PqrTipo = Database["public"]["Enums"]["pqr_tipo"];

export type Citation = {
  source: string;
  article: string;
  relevance: string;
};

const BASE_CITATIONS: Citation[] = [
  {
    source: "Ley 1755 de 2015",
    article: "Art. 14",
    relevance:
      "Término máximo para resolver derechos de petición en interés general (15 días hábiles).",
  },
  {
    source: "Ley 1581 de 2012",
    article: "Art. 8",
    relevance:
      "Derechos del titular sobre sus datos personales; tratamiento diferenciado de información sensible.",
  },
  {
    source: "Decreto 1166 de 2016",
    article: "Art. 2.2.3.12.4",
    relevance:
      "Reglamentación del derecho de petición verbal y trámite electrónico.",
  },
];

const EXTRA_CITATIONS: Record<PqrTipo, Citation[]> = {
  peticion: [],
  queja: [
    {
      source: "Ley 1755 de 2015",
      article: "Art. 22",
      relevance:
        "Traslado por competencia cuando la autoridad destinataria no es la competente.",
    },
  ],
  reclamo: [
    {
      source: "Decreto 491 de 2020",
      article: "Art. 5",
      relevance:
        "Garantía de la atención a la ciudadanía durante estado de excepción sanitario.",
    },
  ],
  sugerencia: [],
  denuncia: [
    {
      source: "Ley 1474 de 2011",
      article: "Art. 76",
      relevance:
        "Atención obligatoria de denuncias por corrupción y deber de remisión a organismos de control.",
    },
  ],
};

const TIPO_LABEL: Record<PqrTipo, string> = {
  peticion: "petición",
  queja: "queja",
  reclamo: "reclamo",
  sugerencia: "sugerencia",
  denuncia: "denuncia",
};

export function buildDraftTemplate(args: {
  radicado: string | null;
  tipo: PqrTipo | null;
  lead: string | null;
  hechos: string | null;
  peticion: string | null;
  issuedAt: string;
  legalDeadline: string | null;
}): { body: string; citations: Citation[] } {
  const tipoLabel = args.tipo ? TIPO_LABEL[args.tipo] : "solicitud";
  const radicado = args.radicado ?? "sin radicado asignado";
  const issued = formatDate(args.issuedAt);
  const deadline = args.legalDeadline
    ? formatDate(args.legalDeadline)
    : "dentro de los términos legales";

  const citations = [
    ...BASE_CITATIONS,
    ...(args.tipo ? EXTRA_CITATIONS[args.tipo] : []),
  ];

  const hechosResumen = trimOrFallback(
    args.hechos,
    args.lead ?? "los hechos narrados por la ciudadanía",
  );
  const peticionResumen = trimOrFallback(
    args.peticion,
    "la pretensión formulada",
  );
  const citationBlock = citations
    .map((c, i) => `  ${i + 1}. ${c.source}, ${c.article}. ${c.relevance}`)
    .join("\n");

  const body = `Medellín, ${formatDate(new Date().toISOString())}

Referencia: Respuesta a ${tipoLabel} · Radicado ${radicado}

Respetado(a) ciudadano(a):

En atención a su ${tipoLabel} radicada el ${issued}, mediante la cual manifiesta que ${hechosResumen}, y solicita ${peticionResumen}, la Alcaldía de Medellín — Secretaría de Desarrollo Económico, en cumplimiento del artículo 14 de la Ley 1755 de 2015, se permite responder lo siguiente:

1. Antecedentes
La entidad recibió su solicitud a través del canal correspondiente y la radicó con el código ${radicado}. El término legal para resolver vence el ${deadline}.

2. Análisis jurídico
La respuesta se fundamenta en el siguiente marco normativo:

${citationBlock}

3. Decisión
[El funcionario debe completar aquí la respuesta de fondo, citando documentos, actos administrativos y verificaciones realizadas.]

4. Recursos
Contra la presente respuesta procede el derecho de insistencia, o los recursos administrativos correspondientes, dentro de los términos establecidos en el Código de Procedimiento Administrativo y de lo Contencioso Administrativo (Ley 1437 de 2011, arts. 74 y ss.).

Atentamente,

Dirección Jurídica
Secretaría de Desarrollo Económico
Alcaldía de Medellín
`;

  return { body, citations };
}

function trimOrFallback(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  const compact = trimmed.replace(/\s+/g, " ");
  return compact.length > 260 ? `${compact.slice(0, 257)}…` : compact;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "long",
      timeZone: "America/Bogota",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
