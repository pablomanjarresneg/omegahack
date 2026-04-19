import {
  DeadlineEngineError,
  type DeadlineUnit,
  type PlazoType,
  type TenantConfig,
} from './types';

export interface PlazoDefinition {
  readonly unit: DeadlineUnit;
  readonly amount: number;
  readonly description: string;
}

/**
 * Ley 1755/2015 plazos table. All values are expressed in business days (days
 * hábiles) unless the unit says otherwise. The `post_tutela` plazo is measured
 * in clock hours as required by the Corte Constitucional timelines.
 */
export const PLAZOS: Readonly<Record<PlazoType, PlazoDefinition>> = Object.freeze({
  peticion_general: Object.freeze({
    unit: 'business_days',
    amount: 15,
    description: 'Petición general (Ley 1755/2015 art. 14): 15 días hábiles.',
  }),
  queja: Object.freeze({
    unit: 'business_days',
    amount: 15,
    description: 'Queja: 15 días hábiles.',
  }),
  reclamo: Object.freeze({
    unit: 'business_days',
    amount: 15,
    description: 'Reclamo: 15 días hábiles.',
  }),
  informacion: Object.freeze({
    unit: 'business_days',
    amount: 10,
    description: 'Solicitud de información: 10 días hábiles.',
  }),
  consulta: Object.freeze({
    unit: 'business_days',
    amount: 30,
    description: 'Consulta: 30 días hábiles.',
  }),
  inter_autoridades: Object.freeze({
    unit: 'business_days',
    amount: 10,
    description: 'Solicitud entre autoridades: 10 días hábiles.',
  }),
  salud_priority: Object.freeze({
    unit: 'business_days',
    amount: 5,
    description:
      'Prioridad en salud: 5 días hábiles por defecto (rango permitido 3–8 según tenant).',
  }),
  traslado_por_competencia: Object.freeze({
    unit: 'business_days',
    amount: 5,
    description: 'Traslado por competencia: 5 días hábiles.',
  }),
  post_tutela: Object.freeze({
    unit: 'clock_hours',
    amount: 48,
    description: 'Cumplimiento post-tutela: 48 horas reloj.',
  }),
}) as Readonly<Record<PlazoType, PlazoDefinition>>;

const SALUD_PRIORITY_MIN = 3;
const SALUD_PRIORITY_MAX = 8;

/**
 * Resolve the concrete plazo for a given type, applying tenant overrides where
 * the law permits them (currently only `salud_priority` via
 * `tenantConfig.saludPriorityDays`).
 */
export function resolvePlazo(
  type: PlazoType,
  tenantConfig?: TenantConfig,
): PlazoDefinition {
  const base = PLAZOS[type];
  if (!base) {
    throw new DeadlineEngineError(
      'UNKNOWN_PLAZO_TYPE',
      `Unknown plazo type: ${String(type)}`,
    );
  }

  if (type === 'salud_priority') {
    const override = tenantConfig?.saludPriorityDays;
    if (override !== undefined) {
      if (
        !Number.isFinite(override) ||
        !Number.isInteger(override) ||
        override < SALUD_PRIORITY_MIN ||
        override > SALUD_PRIORITY_MAX
      ) {
        throw new DeadlineEngineError(
          'INVALID_SALUD_PRIORITY_DAYS',
          `tenantConfig.saludPriorityDays must be an integer in [${SALUD_PRIORITY_MIN}, ${SALUD_PRIORITY_MAX}]; got ${String(override)}`,
        );
      }
      return Object.freeze({
        unit: base.unit,
        amount: override,
        description: base.description,
      });
    }
  }

  return base;
}
