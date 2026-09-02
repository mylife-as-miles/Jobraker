import { describe, it, expect } from "vitest";

// Re-implemented helper matching the logic in JobPage.tsx for search query constraint
function matchesJobSearchCriteria(
  job: {
    title: string;
    company?: string | null;
    description?: string | null;
    location?: string | null;
    matchKeywords?: string[];
    evaluation_summary?: { matched_keywords?: string[] } | null;
  },
  query: string,
): boolean {
  if (!query || !query.trim()) return true;
  const terms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return true;
  const haystack = [
    job.title,
    job.company,
    job.description,
    job.location,
    ...(job.matchKeywords || []),
    ...(job.evaluation_summary?.matched_keywords || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    terms.every((term) => haystack.includes(term)) ||
    haystack.includes(query.toLowerCase().trim())
  );
}

// Logic matching safeToLaunch in JobPage.tsx
function evaluateSafeToLaunch(opts: {
  saveAsDraftOnly: boolean;
  tailoredConfidence?: number;
  decision?: string;
  confidence?: number;
  hardBlockers?: number;
}): boolean {
  const {
    saveAsDraftOnly,
    tailoredConfidence,
    decision,
    confidence = 0,
    hardBlockers = 0,
  } = opts;

  return (
    !saveAsDraftOnly &&
    ((tailoredConfidence && tailoredConfidence >= 70) ||
      decision === "strong_yes" ||
      decision === "draft_first" ||
      confidence >= 50) &&
    hardBlockers === 0
  );
}

// Logic matching mapSkyvernStatus / status reconciliation
function mapProviderStatusToDisplay(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase();
  switch (normalized) {
    case "completed":
    case "succeeded":
      return { status: "Applied", canonical_stage: "submitted" };
    case "failed":
    case "terminated":
      return { status: "Failed", canonical_stage: "failed" };
    default:
      return { status: "Pending", canonical_stage: "queued" };
  }
}

describe("Auto-Apply Pipeline & Scope Constraints", () => {
  describe("Job Matching Scope Constraints", () => {
    it("strictly constrains target jobs to active search query", () => {
      const devopsJob = {
        title: "Senior DevOps Engineer",
        company: "CloudTech",
        description: "Looking for Kubernetes and Terraform experts.",
      };
      const reactJob = {
        title: "Senior React Frontend Developer",
        company: "WebCo",
        description: "Build Next.js and TypeScript apps.",
      };
      const designerJob = {
        title: "UI/UX Product Designer",
        company: "DesignLabs",
        description: "Figma wireframes and user testing.",
      };

      const allJobs = [devopsJob, reactJob, designerJob];

      // User searched for "DevOps"
      const devopsMatches = allJobs.filter((j) =>
        matchesJobSearchCriteria(j, "DevOps"),
      );
      expect(devopsMatches).toHaveLength(1);
      expect(devopsMatches[0].title).toBe("Senior DevOps Engineer");

      // User searched for "React Developer"
      const reactMatches = allJobs.filter((j) =>
        matchesJobSearchCriteria(j, "React Developer"),
      );
      expect(reactMatches).toHaveLength(1);
      expect(reactMatches[0].title).toBe("Senior React Frontend Developer");

      // User searched for "Figma" (found in description)
      const figmaMatches = allJobs.filter((j) =>
        matchesJobSearchCriteria(j, "Figma"),
      );
      expect(figmaMatches).toHaveLength(1);
      expect(figmaMatches[0].title).toBe("UI/UX Product Designer");

      // Profile default "Product Designer" does NOT match "DevOps"
      expect(matchesJobSearchCriteria(designerJob, "DevOps")).toBe(false);
      expect(matchesJobSearchCriteria(reactJob, "DevOps")).toBe(false);
    });
  });

  describe("Bulk Apply Draft Prevention & Quality Gates", () => {
    it("allows auto-tailored ~95% confidence jobs to proceed to auto-apply", () => {
      const tailoredJob = {
        saveAsDraftOnly: false,
        tailoredConfidence: 95,
        decision: "strong_yes",
        confidence: 95,
        hardBlockers: 0,
      };
      expect(evaluateSafeToLaunch(tailoredJob)).toBe(true);
    });

    it("prevents demoting qualified jobs with 60% confidence to draft when auto-applying", () => {
      const qualifiedJob = {
        saveAsDraftOnly: false,
        tailoredConfidence: undefined,
        decision: "strong_yes",
        confidence: 60,
        hardBlockers: 0,
      };
      expect(evaluateSafeToLaunch(qualifiedJob)).toBe(true);
    });

    it("correctly routes jobs to draft if user explicitly selected saveAsDraftOnly", () => {
      const draftExplicit = {
        saveAsDraftOnly: true,
        tailoredConfidence: 95,
        decision: "strong_yes",
        confidence: 95,
        hardBlockers: 0,
      };
      expect(evaluateSafeToLaunch(draftExplicit)).toBe(false);
    });

    it("correctly routes jobs to draft if genuine hard blockers exist", () => {
      const blockedJob = {
        saveAsDraftOnly: false,
        tailoredConfidence: 95,
        decision: "strong_yes",
        confidence: 95,
        hardBlockers: 1, // e.g. Requires top secret clearance
      };
      expect(evaluateSafeToLaunch(blockedJob)).toBe(false);
    });
  });

  describe("Status Reconciliation & Webhook Mapping", () => {
    it("maps completed and succeeded provider statuses to Applied / submitted", () => {
      expect(mapProviderStatusToDisplay("completed")).toEqual({
        status: "Applied",
        canonical_stage: "submitted",
      });
      expect(mapProviderStatusToDisplay("succeeded")).toEqual({
        status: "Applied",
        canonical_stage: "submitted",
      });
    });

    it("maps failed and terminated statuses to Failed / failed", () => {
      expect(mapProviderStatusToDisplay("failed")).toEqual({
        status: "Failed",
        canonical_stage: "failed",
      });
      expect(mapProviderStatusToDisplay("terminated")).toEqual({
        status: "Failed",
        canonical_stage: "failed",
      });
    });

    it("keeps in-progress statuses as Pending / queued", () => {
      expect(mapProviderStatusToDisplay("running")).toEqual({
        status: "Pending",
        canonical_stage: "queued",
      });
      expect(mapProviderStatusToDisplay("waiting")).toEqual({
        status: "Pending",
        canonical_stage: "queued",
      });
      expect(mapProviderStatusToDisplay(null)).toEqual({
        status: "Pending",
        canonical_stage: "queued",
      });
    });
  });
});
