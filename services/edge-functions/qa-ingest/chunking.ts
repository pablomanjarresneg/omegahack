// Deno-side port of packages/rag/src/chunking.ts. Kept in sync by hand — a
// single sibling unit test ensures behaviour matches.
//
// Why a copy instead of imports: Supabase edge functions run on Deno and
// cannot resolve pnpm workspace packages; a monorepo bundler would fix that
// but is overkill for two files of pure-TS logic.

export interface Chunk {
  text: string;
  heading_path: string[];
  ord: number;
  token_count: number;
}

const TARGET_TOKENS = 800;
const OVERLAP_TOKENS = 100;
const TOKEN_RATIO = 1.3;

export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  const words = trimmed.split(/\s+/u).filter((w) => w.length > 0);
  return Math.ceil(words.length * TOKEN_RATIO);
}

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
    const words = joined.split(/\s+/u).filter((w) => w.length > 0);
    const overlapWords = Math.ceil(OVERLAP_TOKENS / TOKEN_RATIO);
    const tail = words.slice(Math.max(0, words.length - overlapWords)).join(' ');
    buffer = tail.length > 0 ? [tail] : [];
  };

  for (const line of lines) {
    const h = parseHeading(line);
    if (h) {
      flushBuffer();
      updateHeadingStack(headingStack, h.level, h.title);
      continue;
    }

    const lineTokens = estimateTokens(line);
    if (lineTokens >= TARGET_TOKENS) {
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

    const bufferJoined = buffer.join('\n').trim();
    if (bufferJoined.length > 0 && estimateTokens(bufferJoined) >= TARGET_TOKENS) {
      flushBuffer();
    }
  }

  flushBuffer();
  return chunks;
}

function parseHeading(line: string): { level: number; title: string } | null {
  const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
  if (!m) return null;
  return { level: m[1]!.length, title: m[2]!.trim() };
}

function updateHeadingStack(
  stack: string[],
  level: number,
  title: string,
): void {
  while (stack.length >= level) {
    stack.pop();
  }
  while (stack.length < level - 1) {
    stack.push('');
  }
  stack.push(title);
}
