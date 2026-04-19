// Heading-aware markdown splitter.
//
// Target: ~800 tokens per chunk, 100-token overlap between adjacent chunks.
// We approximate tokens as `ceil(word_count * 1.3)` which matches Azure
// `nella-embeddings` average Spanish-language ratio closely enough for chunk
// sizing purposes (the actual embed API is the authority on final token count;
// we just need a consistent heuristic to cap chunk size).
//
// The algorithm walks the markdown line-by-line tracking the current heading
// path (H1 → H2 → ... → H6 stack). Runs of non-heading lines accumulate into
// the current buffer; whenever the buffer's estimated token count crosses
// TARGET_TOKENS we emit a chunk and seed the next buffer with the tail of the
// previous one (OVERLAP_TOKENS). Headings themselves trigger an emit + reset
// of the buffer, but the heading PATH propagates to every chunk under it.
//
// Exports:
//   - chunkMarkdown(text): Chunk[]
//   - estimateTokens(text): number   (exported for unit tests)

export interface Chunk {
  text: string;
  /**
   * Heading ancestry at the time the chunk was emitted, ordered H1..deepest.
   * Empty when the chunk came from prose before any heading was seen.
   */
  heading_path: string[];
  /** 0-indexed position in the source document. */
  ord: number;
  /** Heuristic token count for this chunk. */
  token_count: number;
}

const TARGET_TOKENS = 800;
const OVERLAP_TOKENS = 100;
/** Heuristic multiplier: words × RATIO ≈ tokens. */
const TOKEN_RATIO = 1.3;

/**
 * Count tokens in a string using the simple words × RATIO heuristic. Zero for
 * empty input. We split on whitespace (Unicode-aware) and filter empty spans.
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  const words = trimmed.split(/\s+/u).filter((w) => w.length > 0);
  return Math.ceil(words.length * TOKEN_RATIO);
}

/**
 * Split `text` into its heading-aware chunks. ATX headings (`# ... ######`)
 * are detected at line start; other markdown (setext headings, lists, code
 * fences) passes through as prose.
 */
export function chunkMarkdown(text: string): Chunk[] {
  const lines = text.split(/\r?\n/);
  const chunks: Chunk[] = [];
  const headingStack: string[] = [];
  let buffer: string[] = [];
  let ord = 0;

  const flushBuffer = (): void => {
    const joined = buffer.join('\n').trim();
    if (joined.length === 0) {
      buffer = [];
      return;
    }
    const tokens = estimateTokens(joined);
    chunks.push({
      text: joined,
      heading_path: [...headingStack],
      ord,
      token_count: tokens,
    });
    ord++;

    // Carry the tail as overlap for the next chunk (words, not lines, so the
    // overlap is deterministic regardless of line wrapping in the source).
    const words = joined.split(/\s+/u).filter((w) => w.length > 0);
    const overlapWords = Math.ceil(OVERLAP_TOKENS / TOKEN_RATIO);
    const tail = words.slice(Math.max(0, words.length - overlapWords)).join(' ');
    buffer = tail.length > 0 ? [tail] : [];
  };

  for (const line of lines) {
    const h = parseHeading(line);
    if (h) {
      // A new heading closes the current buffer (prose under the previous
      // heading is emitted as-is), then resets the heading stack to the new
      // ancestry before we begin accumulating under it.
      flushBuffer();
      // Preserve any overlap tail the flush seeded: we keep it — prose flows
      // across heading boundaries in a document, and stripping it would
      // silently lose coverage. The heading path that decorates the NEXT
      // emitted chunk will be the new path.
      updateHeadingStack(headingStack, h.level, h.title);
      // Don't add the heading line itself to the buffer — the heading_path
      // carries that information already. This keeps chunks denser.
      continue;
    }

    // Fast path: if the CURRENT line alone would push us past TARGET_TOKENS,
    // walk it word-by-word so no single line produces a giant chunk.
    const lineTokens = estimateTokens(line);
    if (lineTokens >= TARGET_TOKENS) {
      // Drain the existing buffer first so we don't mix a heading's prose into
      // this fresh run.
      flushBuffer();
      const words = line.split(/\s+/u).filter((w) => w.length > 0);
      const wordsPerChunk = Math.max(
        1,
        Math.floor(TARGET_TOKENS / TOKEN_RATIO),
      );
      for (let i = 0; i < words.length; i += wordsPerChunk) {
        const segment = words.slice(i, i + wordsPerChunk).join(' ');
        buffer.push(segment);
        flushBuffer();
      }
      continue;
    }

    buffer.push(line);

    // If the current buffer is at or above TARGET_TOKENS, emit.
    const bufferJoined = buffer.join('\n').trim();
    if (bufferJoined.length > 0 && estimateTokens(bufferJoined) >= TARGET_TOKENS) {
      flushBuffer();
    }
  }

  // Trailing content.
  flushBuffer();

  return chunks;
}

interface HeadingMatch {
  level: number;
  title: string;
}

function parseHeading(line: string): HeadingMatch | null {
  // ATX heading: 1–6 '#' characters, space, text. No leading whitespace.
  const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
  if (!m) return null;
  return { level: m[1]!.length, title: m[2]!.trim() };
}

function updateHeadingStack(
  stack: string[],
  level: number,
  title: string,
): void {
  // Pop any deeper or same-level headings, then push the new one so the stack
  // always reflects the ancestry of the NEXT line.
  while (stack.length >= level) {
    stack.pop();
  }
  // If we jumped from H1 straight to H3 (no H2), pad with empty strings to
  // preserve positional level semantics (H3 lives at index 2).
  while (stack.length < level - 1) {
    stack.push('');
  }
  stack.push(title);
}
