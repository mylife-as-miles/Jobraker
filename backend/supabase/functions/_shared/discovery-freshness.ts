export const MIN_RAW_JOB_CANDIDATES = 24;
export const MAX_RAW_JOB_CANDIDATES = 100;

export function normalizeFreshnessDays(value: unknown, fallback = 30): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(365, Math.floor(parsed)))
    : fallback;
}

export function resolveFirecrawlTimeFilter(freshnessDays: number): string {
  const days = normalizeFreshnessDays(freshnessDays);
  if (days <= 1) return "sbd:1,qdr:d";
  if (days <= 7) return "sbd:1,qdr:w";
  if (days <= 31) return "sbd:1,qdr:m";
  return "sbd:1,qdr:y";
}

export function resolveRawCandidatePoolLimit(requestedLimit: number): number {
  const limit = Math.max(1, Math.floor(Number(requestedLimit) || 1));
  return Math.min(
    MAX_RAW_JOB_CANDIDATES,
    Math.max(MIN_RAW_JOB_CANDIDATES, limit * 3),
  );
}

export function shouldDisplayFreshRunResult(result: {
  displayable: boolean;
  is_new_to_user: boolean;
}): boolean {
  return result.displayable && result.is_new_to_user;
}
