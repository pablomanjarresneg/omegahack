// Smoke tests for the Deno-side chunker. Keeping this light — the canonical
// test suite lives in packages/rag/test/chunking.test.ts; this file verifies
// the hand-ported copy still works under Deno's runtime.

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { chunkMarkdown, estimateTokens } from './chunking.ts';

Deno.test('estimateTokens: empty → 0', () => {
  assertEquals(estimateTokens(''), 0);
  assertEquals(estimateTokens('\n\t '), 0);
});

Deno.test('chunkMarkdown: tracks heading ancestry', () => {
  const md = '# A\ntexto uno\n\n## B\ntexto dos';
  const chunks = chunkMarkdown(md);
  assert(chunks.length >= 1, 'should produce at least one chunk');
  assertEquals(chunks[0].heading_path[0], 'A');
  const underB = chunks.find((c) => c.heading_path.includes('B'));
  assert(underB, 'chunk under B must exist');
});

Deno.test('chunkMarkdown: splits oversized single line', () => {
  const md = 'palabra '.repeat(3000); // ~3000 words = ~3900 tokens
  const chunks = chunkMarkdown(md);
  assert(chunks.length > 1);
  for (const c of chunks) {
    assert(c.token_count <= 1100, `chunk too large: ${c.token_count}`);
  }
});
