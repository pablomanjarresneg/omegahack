import { describe, expect, it } from 'vitest';

import { runIntakeAgent } from '../src/index.js';
import { makeClassification, makeIntake } from './fixtures.js';

describe('runIntakeAgent', () => {
  it('orchestrates injected stages and emits the result plus event contract', async () => {
    const order: string[] = [];
    const intake = makeIntake({
      raw_text: 'Solicito poda en el parque. CC 12345678',
    });
    const classification = makeClassification();
    const ticks = [1_000, 1_037];
    let tickIndex = 0;

    const run = await runIntakeAgent(
      intake,
      { tenantId: 'tenant-1', tenantSlug: 'demo' },
      {
        clock: () => ticks[tickIndex++] ?? 1_037,
        nowIso: () => '2026-04-19T12:00:00.000Z',
        classify: async ({ intake: classifiedIntake }) => {
          order.push('classify');
          expect(classifiedIntake.raw_text).toBe(intake.raw_text);
          return classification;
        },
        redactText: (text) => {
          order.push('format');
          return {
            llmText: text.replace('12345678', '[CED]'),
            redactionLog: [
              {
                fieldName: 'cedula',
                match: '12345678',
                replacement: '[CED]',
                offset: text.indexOf('12345678'),
              },
            ],
          };
        },
        summarize: async ({ formatted }) => {
          order.push('resumen');
          expect(formatted.llm_text).toContain('[CED]');
          return {
            resumen: 'x'.repeat(400),
            tokens_used: 17,
          };
        },
        tag: async ({ resumen }) => {
          order.push('tags');
          expect(resumen.length).toBeLessThanOrEqual(280);
          return [
            {
              namespace: 'tema',
              slug: 'arbolado',
              label: 'Arbolado',
              confidence: 0.92,
            },
          ];
        },
        group: async ({ tags }) => {
          order.push('group');
          expect(tags).toHaveLength(1);
          return {
            id: 'group-1',
            action: 'attached',
            similarity_score: 0.81,
          };
        },
      },
    );

    expect(order).toEqual(['classify', 'format', 'resumen', 'tags', 'group']);
    expect(run.result).toMatchObject({
      tenant_id: 'tenant-1',
      status: 'accepted',
      validity: { valid: true, reasons: [] },
      tokens_used: 17,
      duration_ms: 37,
      problem_group: {
        id: 'group-1',
        action: 'attached',
        similarity_score: 0.81,
      },
    });
    expect(run.result.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(run.result.resumen).toHaveLength(280);
    expect(run.result.formatted_original.raw_text).toBe(intake.raw_text);
    expect(run.result.formatted_original.llm_text).toContain('[CED]');
    expect(run.event).toMatchObject({
      kind: 'intake_agent_completed',
      version: 1,
      tenant_id: 'tenant-1',
      source_hash: run.result.source_hash,
      occurred_at: '2026-04-19T12:00:00.000Z',
      payload: {
        source_hash: run.result.source_hash,
        tenant_id: 'tenant-1',
        status: 'accepted',
        resumen: run.result.resumen,
        classification: {
          status: 'classified',
          tipo: 'peticion',
          dependencia_codigo: 'SGOB',
          urgencia_level: 'media',
        },
      },
    });
  });
});
