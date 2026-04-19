import type {
  Classification,
  ClassificationFailure,
  ClassificationResult,
} from '@omega/classifier/schemas';

import { buildIntakeAgentEvent, type IntakeAgentEvent } from './events.js';
import { formatPreserve, type RedactTextFn } from './format-preserve.js';
import { generateSourceHash } from './hash.js';
import {
  generateResumen,
  type ResumenGenerationResult,
  type ResumenGenerator,
} from './resumen.js';
import type {
  IntakeAgentResult,
  IntakeProblemGroup,
  IntakeTag,
  IntakeValidity,
  NormalizedIntake,
  TenantContext,
} from './types.js';
import { deriveValidity } from './validity.js';
import { validateNormalizedIntake } from './validation.js';

export interface IntakeClassificationInput {
  intake: NormalizedIntake;
  context: TenantContext;
}

export type IntakeClassifier = (
  input: IntakeClassificationInput,
) => Promise<Classification | ClassificationFailure>;

export interface IntakeTagInput {
  intake: NormalizedIntake;
  context: TenantContext;
  classification: Classification | ClassificationFailure;
  validity: IntakeValidity;
  resumen: string;
  source_hash: string;
}

export type IntakeTagger = (input: IntakeTagInput) => Promise<IntakeTag[]>;

export interface IntakeProblemGroupInput extends IntakeTagInput {
  tags: IntakeTag[];
}

export type IntakeProblemGrouper = (
  input: IntakeProblemGroupInput,
) => Promise<IntakeProblemGroup>;

export interface IntakeAgentDependencies {
  classify?: IntakeClassifier;
  redactText?: RedactTextFn;
  summarize?: ResumenGenerator;
  tag?: IntakeTagger;
  group?: IntakeProblemGrouper;
  clock?: () => number;
  nowIso?: () => string;
}

export interface IntakeAgentRun {
  result: IntakeAgentResult;
  event: IntakeAgentEvent;
}

export interface IntakeAgent {
  run(input: unknown, context: TenantContext): Promise<IntakeAgentRun>;
}

const SKIPPED_PROBLEM_GROUP: IntakeProblemGroup = {
  id: null,
  action: 'skipped',
  similarity_score: null,
};

const CLASSIFIER_PACKAGE = '@omega/classifier';

interface ClassifierModule {
  classify?: (
    rawText: string,
    attachments: NormalizedIntake['attachments'],
  ) => Promise<ClassificationResult>;
}

async function classifyWithDefaultPackage(
  input: IntakeClassificationInput,
): Promise<ClassificationResult> {
  try {
    const classifierModule = (await import(CLASSIFIER_PACKAGE)) as ClassifierModule;
    if (typeof classifierModule.classify === 'function') {
      return classifierModule.classify(input.intake.raw_text, input.intake.attachments);
    }
  } catch {
    // Dependency injection is the supported path for tests and edge shims.
  }

  return {
    status: 'pending_human',
    reason: 'claude_unavailable',
    message: 'No classifier dependency is configured.',
  };
}

async function defaultTagger(): Promise<IntakeTag[]> {
  return [];
}

async function defaultGrouper(): Promise<IntakeProblemGroup> {
  return { ...SKIPPED_PROBLEM_GROUP };
}

function deriveStatus(
  classification: Classification | ClassificationFailure,
  validity: IntakeValidity,
): IntakeAgentResult['status'] {
  if ('status' in classification) return 'pending_human';
  return validity.valid ? 'accepted' : 'bounce';
}

export async function runIntakeAgent(
  input: unknown,
  context: TenantContext,
  dependencies: IntakeAgentDependencies = {},
): Promise<IntakeAgentRun> {
  const clock = dependencies.clock ?? Date.now;
  const startedAt = clock();
  const intake = validateNormalizedIntake(input);
  const sourceHash = generateSourceHash(intake);

  const classify = dependencies.classify ?? classifyWithDefaultPackage;
  const classification = await classify({ intake, context });

  const formatted = formatPreserve(intake, dependencies.redactText);
  const validity = deriveValidity(classification);

  const resumenResult: ResumenGenerationResult = await generateResumen(
    {
      intake,
      formatted,
      classification,
      context,
    },
    dependencies.summarize,
  );

  const tag = dependencies.tag ?? defaultTagger;
  const tags = await tag({
    intake,
    context,
    classification,
    validity,
    resumen: resumenResult.resumen,
    source_hash: sourceHash,
  });

  const group = dependencies.group ?? defaultGrouper;
  const problemGroup = await group({
    intake,
    context,
    classification,
    validity,
    resumen: resumenResult.resumen,
    source_hash: sourceHash,
    tags,
  });

  const finishedAt = clock();
  const result: IntakeAgentResult = {
    source_hash: sourceHash,
    tenant_id: context.tenantId,
    status: deriveStatus(classification, validity),
    validity,
    resumen: resumenResult.resumen,
    formatted_original: formatted,
    tags,
    problem_group: problemGroup,
    classification,
    tokens_used: resumenResult.tokens_used,
    duration_ms: Math.max(0, finishedAt - startedAt),
  };

  return {
    result,
    event: buildIntakeAgentEvent(result, dependencies.nowIso?.()),
  };
}

export function createIntakeAgent(
  dependencies: IntakeAgentDependencies = {},
): IntakeAgent {
  return {
    run(input: unknown, context: TenantContext): Promise<IntakeAgentRun> {
      return runIntakeAgent(input, context, dependencies);
    },
  };
}
