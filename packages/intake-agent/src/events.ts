import type { Classification, ClassificationFailure } from '@omega/classifier/schemas';

import type {
  IntakeAgentResult,
  IntakeProblemGroup,
  IntakeTag,
  IntakeValidity,
} from './types.js';

export interface IntakeAgentEventPayload {
  source_hash: string;
  tenant_id: string;
  status: IntakeAgentResult['status'];
  validity: IntakeValidity;
  resumen: string;
  tags: IntakeTag[];
  problem_group: IntakeProblemGroup;
  classification:
    | {
        status: 'classified';
        tipo: Classification['tipo'];
        dependencia_codigo: Classification['dependencia']['codigo'];
        urgencia_level: Classification['urgencia']['level'];
        confidence: number;
        prompt_version: string;
      }
    | {
        status: ClassificationFailure['status'];
        reason: ClassificationFailure['reason'];
        message: string;
      };
  tokens_used: number;
  duration_ms: number;
}

export interface IntakeAgentEvent {
  kind: 'intake_agent_completed';
  version: 1;
  tenant_id: string;
  source_hash: string;
  occurred_at: string;
  payload: IntakeAgentEventPayload;
}

function isClassification(
  classification: Classification | ClassificationFailure,
): classification is Classification {
  return !('status' in classification);
}

export function buildIntakeAgentEventPayload(result: IntakeAgentResult): IntakeAgentEventPayload {
  return {
    source_hash: result.source_hash,
    tenant_id: result.tenant_id,
    status: result.status,
    validity: result.validity,
    resumen: result.resumen,
    tags: result.tags,
    problem_group: result.problem_group,
    classification: isClassification(result.classification)
      ? {
          status: 'classified',
          tipo: result.classification.tipo,
          dependencia_codigo: result.classification.dependencia.codigo,
          urgencia_level: result.classification.urgencia.level,
          confidence: result.classification.confidence,
          prompt_version: result.classification.prompt_version,
        }
      : {
          status: result.classification.status,
          reason: result.classification.reason,
          message: result.classification.message,
        },
    tokens_used: result.tokens_used,
    duration_ms: result.duration_ms,
  };
}

export function buildIntakeAgentEvent(
  result: IntakeAgentResult,
  occurredAt = new Date().toISOString(),
): IntakeAgentEvent {
  return {
    kind: 'intake_agent_completed',
    version: 1,
    tenant_id: result.tenant_id,
    source_hash: result.source_hash,
    occurred_at: occurredAt,
    payload: buildIntakeAgentEventPayload(result),
  };
}
