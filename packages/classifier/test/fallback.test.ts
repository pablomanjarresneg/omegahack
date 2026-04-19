import { afterEach, describe, expect, test, vi } from 'vitest';

import { classifyWithClaude } from '../src/claude.js';
import { isClassification } from '../src/schemas.js';

describe('classifyWithClaude fallback behavior', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('uses heuristic fallback without an API key', async () => {
    const fetchMock = vi.fn();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubGlobal('fetch', fetchMock);

    const result = await classifyWithClaude(
      'Solicito reparar un hueco en la via del barrio Belen desde hace dos semanas.',
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(isClassification(result)).toBe(true);
    if (isClassification(result)) {
      expect(result.dependencia.codigo).toBe('SINF');
    }
  });

  test('returns a failure for Claude 5xx responses', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));

    const result = await classifyWithClaude('Solicito informacion general.');

    expect(result).toMatchObject({
      status: 'pending_human',
      reason: 'claude_unavailable',
    });
  });

  test('returns a failure for invalid model output', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              content: [
                {
                  type: 'tool_use',
                  name: 'classify_pqrsd',
                  input: { tipo: 'bad' },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );

    const result = await classifyWithClaude('Solicito informacion general.');

    expect(result).toMatchObject({
      status: 'pending_human',
      reason: 'invalid_model_output',
    });
  });

  test('returns a timeout failure for aborted requests', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      }),
    );

    const result = await classifyWithClaude('Solicito informacion general.', [], { timeoutMs: 1 });

    expect(result).toMatchObject({
      status: 'pending_human',
      reason: 'timeout',
    });
  });
});
