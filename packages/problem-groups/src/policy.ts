import type {
  HotDetectionInput,
  HotDetectionPolicy,
  MatchEvaluation,
  MatchInput,
  MatchPolicy,
} from './types.js';

export const DEFAULT_MATCH_POLICY: MatchPolicy = {
  minSimilarity: 0.8,
  minSharedTags: 2,
  requireSameComunaTag: true,
};

export const DEFAULT_HOT_POLICY: HotDetectionPolicy = {
  minMembers: 5,
  windowDays: 7,
};

export function resolveMatchPolicy(policy: Partial<MatchPolicy> = {}): MatchPolicy {
  return {
    ...DEFAULT_MATCH_POLICY,
    ...policy,
  };
}

export function evaluateMatchPolicy(
  input: MatchInput,
  policy: Partial<MatchPolicy> = {},
): MatchEvaluation {
  const resolved = resolveMatchPolicy(policy);
  const reasons: string[] = [];

  if (!Number.isFinite(input.similarity) || input.similarity < resolved.minSimilarity) {
    reasons.push('similarity_below_threshold');
  }

  if (
    !Number.isInteger(input.sharedTagCount) ||
    input.sharedTagCount < resolved.minSharedTags
  ) {
    reasons.push('shared_tags_below_threshold');
  }

  if (resolved.requireSameComunaTag && !input.hasMatchingComunaTag) {
    reasons.push('missing_matching_comuna_tag');
  }

  return {
    ...input,
    attach: reasons.length === 0,
    reasons,
  };
}

export function shouldAttachToGroup(
  input: MatchInput,
  policy: Partial<MatchPolicy> = {},
): boolean {
  return evaluateMatchPolicy(input, policy).attach;
}

export function resolveHotDetectionPolicy(
  policy: Partial<HotDetectionPolicy> = {},
): HotDetectionPolicy {
  return {
    ...DEFAULT_HOT_POLICY,
    ...policy,
  };
}

export function isHotProblemGroup(
  input: HotDetectionInput,
  policy: Partial<HotDetectionPolicy> = {},
): boolean {
  const resolved = resolveHotDetectionPolicy(policy);

  if (!Number.isInteger(input.memberCount) || input.memberCount < resolved.minMembers) {
    return false;
  }

  const createdAt = new Date(input.createdAt).getTime();
  const now = new Date(input.now ?? Date.now()).getTime();

  if (!Number.isFinite(createdAt) || !Number.isFinite(now)) {
    throw new Error('createdAt and now must be valid dates');
  }

  const windowMs = resolved.windowDays * 24 * 60 * 60 * 1000;
  return createdAt > now - windowMs;
}
