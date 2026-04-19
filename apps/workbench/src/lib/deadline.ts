import { computeProgress, type PlazoType, type ProgressResult } from "@omega/deadline-engine";
import type { Database } from "@omega/db/types";

type PqrTipo = Database["public"]["Enums"]["pqr_tipo"];

export function plazoTypeForTipo(tipo: PqrTipo | null | undefined): PlazoType {
  switch (tipo) {
    case "queja":
      return "queja";
    case "reclamo":
      return "reclamo";
    case "oposicion":
      return "oposicion";
    case "peticion":
    case "sugerencia":
    case "denuncia":
    case null:
    case undefined:
    default:
      return "peticion_general";
  }
}

export function pqrProgress(args: {
  issuedAt: string | Date;
  deadlineAt: string | Date | null;
  tipo: PqrTipo | null | undefined;
  now?: Date;
}): ProgressResult | null {
  if (!args.deadlineAt) return null;
  try {
    return computeProgress(
      {
        issuedAt: args.issuedAt,
        deadlineAt: args.deadlineAt,
        plazoType: plazoTypeForTipo(args.tipo),
      },
      args.now,
    );
  } catch {
    return null;
  }
}
