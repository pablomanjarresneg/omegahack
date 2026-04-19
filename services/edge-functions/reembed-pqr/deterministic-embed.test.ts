// Deno unit tests for the deterministic stub embedding used when Azure creds
// are absent. Run with: `deno task test` (from this directory) or
// `deno test --allow-env --no-check deterministic-embed.test.ts`.

import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { deterministicEmbed } from './embed.ts';

const EXPECTED_DIM = 1024;

function l2Norm(v: number[]): number {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  return Math.sqrt(sumSq);
}

Deno.test('deterministicEmbed returns exactly 1024 floats', () => {
  const v = deterministicEmbed('hola mundo');
  assertEquals(v.length, EXPECTED_DIM);
  for (const x of v) {
    assertEquals(typeof x, 'number');
    assert(Number.isFinite(x), `expected finite float, got ${x}`);
  }
});

Deno.test('deterministicEmbed is deterministic (same input -> same output)', () => {
  const a = deterministicEmbed('radicado MED-20260418-000001 sobre alumbrado publico');
  const b = deterministicEmbed('radicado MED-20260418-000001 sobre alumbrado publico');
  assertEquals(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assertEquals(a[i], b[i], `mismatch at index ${i}`);
  }
});

Deno.test('deterministicEmbed is injective across different inputs', () => {
  const a = deterministicEmbed('el hueco en la calle 10 es peligroso');
  const b = deterministicEmbed('falta de alumbrado en el parque');
  // Vectors must not be identical.
  let diffCount = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffCount++;
  }
  assertNotEquals(diffCount, 0, 'different inputs produced identical embeddings');
  // Cosine similarity should be nowhere near 1 for unrelated random vectors.
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  assert(Math.abs(dot) < 0.2, `unexpected correlation between unrelated inputs: dot=${dot}`);
});

Deno.test('deterministicEmbed output is approximately unit-norm (L2 ~= 1.0)', () => {
  const cases = [
    '',
    'a',
    'The quick brown fox jumps over the lazy dog',
    'Solicito respetuosamente informacion sobre el tramite 12345',
    '¿Por qué mi PQR no ha sido respondida en los plazos de ley?',
  ];
  for (const text of cases) {
    const v = deterministicEmbed(text);
    const norm = l2Norm(v);
    assert(
      Math.abs(norm - 1.0) < 0.01,
      `expected unit-norm for input ${JSON.stringify(text)}, got L2=${norm}`,
    );
  }
});
