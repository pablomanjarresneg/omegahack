export const RESUMEN_PROMPT_VERSION = 'intake-resumen-v1';

export const RESUMEN_SYSTEM_PROMPT = [
  'Eres el generador de resumenes de intake PQRSD.',
  'Devuelve una sola linea en espanol, maxima de 280 caracteres.',
  'No inventes hechos, nombres, lugares ni fechas.',
  'Usa solo texto redactado cuando exista para evitar exponer datos personales.',
].join('\n');
