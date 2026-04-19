import type { ProblemGroupTag } from './types.js';

export function uniqueTagIds(tagIds: readonly string[]): string[] {
  return [...new Set(tagIds.filter((id) => id.trim() !== ''))];
}

export function countSharedTags(
  leftTagIds: readonly string[],
  rightTagIds: readonly string[],
): number {
  const right = new Set(uniqueTagIds(rightTagIds));
  let count = 0;

  for (const tagId of uniqueTagIds(leftTagIds)) {
    if (right.has(tagId)) count++;
  }

  return count;
}

export function isComunaTag(tag: Pick<ProblemGroupTag, 'namespace' | 'slug'>): boolean {
  const namespace = tag.namespace.trim().toLowerCase();
  const slug = tag.slug.trim().toLowerCase();

  return (
    namespace === 'ubicacion' &&
    (slug === 'comuna' ||
      slug.startsWith('comuna:') ||
      slug.startsWith('comuna-') ||
      slug.startsWith('comuna_') ||
      slug.startsWith('comuna/'))
  );
}

export function comunaTagIds(tags: readonly ProblemGroupTag[]): string[] {
  return uniqueTagIds(tags.filter(isComunaTag).map((tag) => tag.id));
}

export function matchingComunaTagIds(
  leftTags: readonly ProblemGroupTag[],
  rightTags: readonly ProblemGroupTag[],
): string[] {
  const rightComuna = new Set(comunaTagIds(rightTags));
  return comunaTagIds(leftTags).filter((tagId) => rightComuna.has(tagId));
}

export function hasMatchingComunaTag(
  leftTags: readonly ProblemGroupTag[],
  rightTags: readonly ProblemGroupTag[],
): boolean {
  return matchingComunaTagIds(leftTags, rightTags).length > 0;
}
