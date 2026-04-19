export const EMBEDDING_DIM = 1024;

function assertFiniteVector(vector: readonly number[], name: string): void {
  if (vector.length === 0) {
    throw new Error(`${name} must not be empty`);
  }

  for (let i = 0; i < vector.length; i++) {
    const value = vector[i];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${name}[${i}] must be a finite number`);
    }
  }
}

export function toVectorLiteral(
  vector: readonly number[],
  expectedDimensions = EMBEDDING_DIM,
): string {
  if (vector.length !== expectedDimensions) {
    throw new Error(
      `embedding must have exactly ${expectedDimensions} dimensions, got ${vector.length}`,
    );
  }

  assertFiniteVector(vector, 'embedding');
  return `[${vector.join(',')}]`;
}

export function parseVectorLiteral(
  value: string | readonly number[] | null | undefined,
): number[] | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    assertFiniteVector(value, 'vector');
    return [...value];
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    throw new Error('vector literal must be wrapped in square brackets');
  }

  const body = trimmed.slice(1, -1).trim();
  if (body === '') return [];

  const vector = body.split(',').map((part, index) => {
    const value = Number(part.trim());
    if (!Number.isFinite(value)) {
      throw new Error(`vector[${index}] must be a finite number`);
    }
    return value;
  });

  return vector;
}

export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length) {
    throw new Error(`vectors must have equal dimensions, got ${a.length} and ${b.length}`);
  }

  assertFiniteVector(a, 'a');
  assertFiniteVector(b, 'b');

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    throw new Error('cosine similarity requires non-zero vectors');
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function runningCentroid(
  currentCentroid: readonly number[] | null | undefined,
  currentCount: number,
  nextVector: readonly number[],
): number[] {
  if (!Number.isInteger(currentCount) || currentCount < 0) {
    throw new Error('currentCount must be a non-negative integer');
  }

  assertFiniteVector(nextVector, 'nextVector');

  if (!currentCentroid || currentCount === 0) {
    return [...nextVector];
  }

  if (currentCentroid.length !== nextVector.length) {
    throw new Error(
      `centroid and nextVector must have equal dimensions, got ${currentCentroid.length} and ${nextVector.length}`,
    );
  }

  assertFiniteVector(currentCentroid, 'currentCentroid');

  const nextCount = currentCount + 1;
  return nextVector.map((value, index) => {
    const current = currentCentroid[index] ?? 0;
    return (current * currentCount + value) / nextCount;
  });
}
