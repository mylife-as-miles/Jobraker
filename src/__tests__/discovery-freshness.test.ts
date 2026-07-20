import { describe, expect, it } from "vitest";
import {
  normalizeFreshnessDays,
  resolveFirecrawlTimeFilter,
  resolveRawCandidatePoolLimit,
  shouldDisplayFreshRunResult,
} from "../../backend/supabase/functions/_shared/discovery-freshness";

describe("job discovery freshness", () => {
  it("normalizes freshness windows to safe bounds", () => {
    expect(normalizeFreshnessDays(undefined)).toBe(30);
    expect(normalizeFreshnessDays(0)).toBe(1);
    expect(normalizeFreshnessDays(999)).toBe(365);
  });

  it("uses supported Firecrawl time filters sorted by date", () => {
    expect(resolveFirecrawlTimeFilter(1)).toBe("sbd:1,qdr:d");
    expect(resolveFirecrawlTimeFilter(7)).toBe("sbd:1,qdr:w");
    expect(resolveFirecrawlTimeFilter(30)).toBe("sbd:1,qdr:m");
    expect(resolveFirecrawlTimeFilter(60)).toBe("sbd:1,qdr:y");
  });

  it("scales candidate pools for paid plan limits without exceeding provider bounds", () => {
    expect(resolveRawCandidatePoolLimit(10)).toBe(30);
    expect(resolveRawCandidatePoolLimit(20)).toBe(60);
    expect(resolveRawCandidatePoolLimit(50)).toBe(100);
    expect(resolveRawCandidatePoolLimit(100)).toBe(100);
  });

  it("never presents duplicate run rows as refreshed jobs", () => {
    expect(shouldDisplayFreshRunResult({ displayable: true, is_new_to_user: true })).toBe(true);
    expect(shouldDisplayFreshRunResult({ displayable: true, is_new_to_user: false })).toBe(false);
    expect(shouldDisplayFreshRunResult({ displayable: false, is_new_to_user: true })).toBe(false);
  });
});
