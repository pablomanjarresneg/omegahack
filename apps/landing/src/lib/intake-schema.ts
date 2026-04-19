import { z } from "zod";

/**
 * Contrato v2 del endpoint POST /pqrs/intake.
 * Exactamente 13 campos. Sin extras, sin faltantes.
 * Esta es la fuente única de validación cliente — debe estar en sync con el workflow n8n.
 */

export const SOURCE_CHANNELS = ["web", "email", "mercurio", "form", "phone", "whatsapp"] as const;

export const AttachmentSchema = z.object({
  storage_path: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
});

export const NormalizedIntakeSchema = z
  .object({
    source_channel: z.enum(SOURCE_CHANNELS),
    citizen_name: z.string().nullable(),
    is_anonymous: z.boolean(),
    document_id: z.string().nullable(),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    subject: z.string().min(1, "subject vacío"),
    description: z.string().min(1, "description vacía"),
    raw_text: z.string().min(1, "raw_text vacío").max(10000, "raw_text excede 10000 caracteres"),
    attachments: z.array(AttachmentSchema),
    location_text: z.string().nullable(),
    consent_data: z.literal(true, {
      errorMap: () => ({ message: "consent_data debe ser true (Ley 1581/2012)" }),
    }),
    created_at: z.string().datetime({ message: "created_at no es ISO 8601" }),
  })
  .superRefine((intake, ctx) => {
    if (intake.is_anonymous && !intake.email?.trim() && !intake.phone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "anonimo_sin_datos_contacto",
        path: ["email"],
      });
    }
  });

export type NormalizedIntake = z.infer<typeof NormalizedIntakeSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;

/** Códigos de rebote 422 emitidos por el workflow. */
export const BOUNCE_REASONS = {
  faltan_hechos: "No identificamos hechos concretos en su PQR.",
  falta_peticion: "No identificamos una petición clara. Diga qué solicita a la Alcaldía.",
  irrespetuoso: "El lenguaje contiene términos no respetuosos. Reformule por favor.",
  anonimo_sin_datos_contacto:
    "Como anónimo necesitamos al menos un correo o teléfono para procesar la PQR.",
  fuera_de_competencia_municipal:
    "La temática no corresponde al ámbito municipal. Podemos orientarle hacia la entidad competente.",
} as const;

export type BounceReason = keyof typeof BOUNCE_REASONS;

/** Errores 400 — strings exactos del workflow. */
export const SCHEMA_ERROR_MESSAGES: Record<string, string> = {
  "source_channel inválido": "Error interno del canal de origen. Recargue la página.",
  "is_anonymous debe ser booleano": "Marcador de anonimato inválido.",
  "consent_data debe ser booleano": "Marque la casilla de autorización de datos.",
  "subject vacío": "El asunto no puede estar vacío.",
  "description vacía": "La descripción no puede estar vacía.",
  "raw_text vacío": "La descripción no puede estar vacía.",
  "created_at no es ISO 8601": "Error técnico de fecha. Recargue la página.",
  "attachments debe ser arreglo": "Hay un problema con los adjuntos. Quítelos y reintente.",
  anonimo_sin_datos_contacto:
    "Para radicar anónimamente, ingrese al menos un correo o teléfono de contacto.",
  "consent_data debe ser true (Ley 1581/2012)":
    "Debe autorizar el tratamiento de sus datos para continuar.",
  "raw_text excede 10000 caracteres": "La descripción excede el límite legal de 10 000 caracteres.",
};

/** Mapea un error del workflow al paso del wizard donde corregirlo. */
export function errorToStep(err: string): 1 | 2 | 3 | 4 {
  if (
    err.includes("consent_data") ||
    err.includes("is_anonymous") ||
    err.includes("anonimo_sin_datos_contacto") ||
    err.includes("email") ||
    err.includes("phone")
  ) {
    return 1;
  }
  if (err.includes("subject") || err.includes("description") || err.includes("raw_text")) return 3;
  if (err.includes("attachments")) return 4;
  return 4;
}
