import { describe, expect, it } from 'vitest';
import { chunkMarkdown, estimateTokens } from '../src/chunking.js';

describe('estimateTokens', () => {
  it('returns 0 for empty / whitespace input', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   \n\t ')).toBe(0);
  });

  it('scales roughly with word count', () => {
    // ~6 words × 1.3 = 7.8 → ceil = 8
    expect(estimateTokens('one two three four five six')).toBe(8);
  });
});

describe('chunkMarkdown', () => {
  it('returns an empty array for empty input', () => {
    expect(chunkMarkdown('')).toEqual([]);
  });

  it('tracks heading ancestry in heading_path', () => {
    const md = [
      '# Título principal',
      'Intro bajo el título.',
      '',
      '## Sub-sección A',
      'Contenido A.',
      '',
      '## Sub-sección B',
      'Contenido B.',
    ].join('\n');
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThan(0);
    // Every chunk should live under "Título principal" at minimum.
    for (const c of chunks) {
      expect(c.heading_path[0]).toBe('Título principal');
    }
    // At least one chunk should be under Sub-sección B.
    const underB = chunks.find((c) => c.heading_path.join('|').includes('Sub-sección B'));
    expect(underB).toBeDefined();
  });

  it('numbers chunks contiguously from 0', () => {
    const md = '# A\n' + 'palabra '.repeat(2000) + '\n\n# B\n' + 'otra '.repeat(2000);
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((c, i) => {
      expect(c.ord).toBe(i);
    });
  });

  it('emits chunks close to TARGET_TOKENS (~800) plus overlap, not gigantic', () => {
    const md = 'palabra '.repeat(5000); // ~5000 words × 1.3 = 6500 tokens of prose
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // Allow a generous upper bound: the last line before we flushed could
      // itself be big; but practically chunks should stay under ~2 × target.
      expect(c.token_count).toBeLessThanOrEqual(TARGET_UPPER);
    }
  });

  it('adjacent chunks share their overlap tail', () => {
    const md = 'palabra '.repeat(5000);
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const prevTailWords = chunks[0]!.text.trim().split(/\s+/u).slice(-40);
    const nextHeadWords = chunks[1]!.text.trim().split(/\s+/u).slice(0, 40);
    // At least some words should repeat between tail of one and head of next.
    const overlap = prevTailWords.filter((w) => nextHeadWords.includes(w)).length;
    expect(overlap).toBeGreaterThan(0);
  });

  it('jumps heading levels without crashing (H1 → H3 skips H2 slot)', () => {
    const md = ['# One', 'alpha', '### Three-deep', 'beta'].join('\n');
    const chunks = chunkMarkdown(md);
    const withHeading = chunks.find((c) => c.heading_path.includes('Three-deep'));
    expect(withHeading).toBeDefined();
    expect(withHeading!.heading_path[0]).toBe('One');
    // Level 2 slot was skipped — a placeholder empty string is acceptable.
    expect(withHeading!.heading_path.length).toBeGreaterThanOrEqual(3);
  });

  it('strips heading markers from chunk text (heading lives only in path)', () => {
    const md = ['# Título', 'primer párrafo'].join('\n');
    const [chunk] = chunkMarkdown(md);
    expect(chunk).toBeDefined();
    expect(chunk!.text.startsWith('#')).toBe(false);
    expect(chunk!.heading_path).toEqual(['Título']);
  });
});

// Loose upper bound: target is 800, overlap is ~100, some slack for the final
// line that pushed us over target.
const TARGET_UPPER = 1100;
