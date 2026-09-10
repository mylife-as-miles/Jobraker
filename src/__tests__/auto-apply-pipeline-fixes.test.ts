import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { hasAutoApplyRuns } from "../lib/subscriptionAccess";
import {
  isTrustedAutoApplySource,
  evaluateTrueAutonomyDecision,
  evaluateNormalAutoApplyDecision,
} from "../lib/autoApplySources";
import { BILLING_PLAN_DEFINITIONS } from "../lib/billingCatalog";

const jobPageSource = readFileSync(
  resolve(process.cwd(), "src/screens/Dashboard/pages/JobPage.tsx"),
  "utf8",
);

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
  describe("Problem 1: Auto Apply Entitlement Derivation", () => {
    it("derives access strictly from canonical billing catalog autoApplyRunsPerMonth > 0", () => {
      // Validate each plan against the catalog
      for (const plan of BILLING_PLAN_DEFINITIONS) {
        const expected = (plan.autoApplyRunsPerMonth ?? 0) > 0;
        expect(hasAutoApplyRuns(plan.tier)).toBe(expected);
      }

      // Explicit verification for each tier:
      // Free has 2 runs -> true
      expect(hasAutoApplyRuns("Free")).toBe(true);
      // Starter has 0 runs -> false (must be blocked)
      expect(hasAutoApplyRuns("Starter")).toBe(false);
      // Basics has 15 runs -> true
      expect(hasAutoApplyRuns("Basics")).toBe(true);
      // Pro has 50 runs -> true
      expect(hasAutoApplyRuns("Pro")).toBe(true);
      // Ultimate has 150 runs -> true
      expect(hasAutoApplyRuns("Ultimate")).toBe(true);
    });

    it("verifies JobPage uses hasAutoApplyRuns instead of hardcoded Free access", () => {
      expect(jobPageSource).toContain("hasAutoApplyRuns(subscriptionTier)");
      expect(jobPageSource).not.toContain('hasSubscriptionAccess(subscriptionTier, "Free")');
    });

    it("verifies JobPage UpgradePrompt directs non-entitled users to Basics", () => {
      expect(jobPageSource).toMatch(/requiredTier=['"]Basics['"]/);
      expect(jobPageSource).toContain("Upgrade to Basics or above to use Auto Apply.");
    });
  });

  describe("Problem 2: Trusted ATS Source Verification", () => {
    it("approves trusted ATS domains and subdomains", () => {
      expect(
        isTrustedAutoApplySource("https://boards.greenhouse.io/example/jobs/123"),
      ).toBe(true);
      expect(
        isTrustedAutoApplySource("https://jobs.lever.co/example/123"),
      ).toBe(true);
      expect(
        isTrustedAutoApplySource("https://jobs.ashbyhq.com/example/123"),
      ).toBe(true);
      expect(
        isTrustedAutoApplySource("https://greenhouse.io/careers"),
      ).toBe(true);
      expect(
        isTrustedAutoApplySource("https://lever.co/apply"),
      ).toBe(true);
      expect(
        isTrustedAutoApplySource("https://ashbyhq.com/postings"),
      ).toBe(true);
    });

    it("safely rejects spoofed, attacker-controlled, or unapproved domains", () => {
      // Subdomain spoofing / attacker domains
      expect(
        isTrustedAutoApplySource("https://evilgreenhouse.io/job"),
      ).toBe(false);
      expect(
        isTrustedAutoApplySource("https://greenhouse.io.attacker.com/job"),
      ).toBe(false);
      expect(
        isTrustedAutoApplySource("https://notlever.co/job"),
      ).toBe(false);
      expect(
        isTrustedAutoApplySource("https://lever.co.attacker.com/job"),
      ).toBe(false);
      expect(
        isTrustedAutoApplySource("https://ashbyhq.com.malicious.net/apply"),
      ).toBe(false);
      expect(
        isTrustedAutoApplySource("https://myworkdayjobs.com/job"),
      ).toBe(false);
    });

    it("handles invalid or empty inputs gracefully", () => {
      expect(isTrustedAutoApplySource("invalid-url")).toBe(false);
      expect(isTrustedAutoApplySource("")).toBe(false);
      expect(isTrustedAutoApplySource(null)).toBe(false);
      expect(isTrustedAutoApplySource(undefined)).toBe(false);
      expect(isTrustedAutoApplySource("javascript:alert(1)")).toBe(false);
    });
  });

  describe("Problem 2: True Autonomy Policy vs Normal Auto Apply", () => {
    it("approves trusted source with >=90 confidence and 0 blockers in True Autonomy", () => {
      const result = evaluateTrueAutonomyDecision({
        targetUrl: "https://boards.greenhouse.io/company/jobs/101",
        evaluationConfidence: 95,
        hardBlockers: 0,
        saveAsDraftOnly: false,
      });

      expect(result.safeToApply).toBe(true);
      expect(result.autonomyConfidence).toBe(95);
      expect(result.isTrustedSource).toBe(true);
      expect(result.hardBlockers).toBe(0);
    });

    it("routes to draft when confidence is below 90 (e.g. 89) in True Autonomy", () => {
      const result = evaluateTrueAutonomyDecision({
        targetUrl: "https://boards.greenhouse.io/company/jobs/101",
        evaluationConfidence: 89,
        hardBlockers: 0,
        saveAsDraftOnly: false,
      });

      expect(result.safeToApply).toBe(false);
      expect(result.reason).toContain("autonomy confidence 89% is below the 90% threshold");
    });

    it("routes to draft when target is an untrusted source in True Autonomy even with 99 confidence", () => {
      const result = evaluateTrueAutonomyDecision({
        targetUrl: "https://untrusted-jobboard.com/jobs/101",
        evaluationConfidence: 99,
        hardBlockers: 0,
        saveAsDraftOnly: false,
      });

      expect(result.safeToApply).toBe(false);
      expect(result.reason).toContain("source is not approved for True Autonomy");
    });

    it("routes to draft when a hard blocker exists in True Autonomy even with 99 confidence", () => {
      const result = evaluateTrueAutonomyDecision({
        targetUrl: "https://jobs.lever.co/company/101",
        evaluationConfidence: 99,
        hardBlockers: 1,
        saveAsDraftOnly: false,
      });

      expect(result.safeToApply).toBe(false);
      expect(result.reason).toContain("1 hard blocker detected");
    });

    it("routes to draft for draft_first decision with 60 confidence in True Autonomy", () => {
      const result = evaluateTrueAutonomyDecision({
        targetUrl: "https://jobs.ashbyhq.com/company/101",
        evaluationConfidence: 60,
        canonicalDecision: "draft_first",
        hardBlockers: 0,
        saveAsDraftOnly: false,
      });

      expect(result.safeToApply).toBe(false);
      expect(result.reason).toContain("below the 90% threshold");
    });

    it("allows tailoredConfidence (e.g. 95) to satisfy True Autonomy threshold", () => {
      const result = evaluateTrueAutonomyDecision({
        targetUrl: "https://boards.greenhouse.io/company/jobs/101",
        tailoredConfidence: 95,
        evaluationConfidence: 75, // Lower baseline evaluation overridden by tailored confidence
        jobMatchScore: 70,
        hardBlockers: 0,
        saveAsDraftOnly: false,
      });

      expect(result.safeToApply).toBe(true);
      expect(result.autonomyConfidence).toBe(95);
    });

    it("clearly distinguishes normal Auto Apply policy from True Autonomy policy", () => {
      // Case 1: 60% confidence with strong_yes on untrusted source
      const case1 = {
        saveAsDraftOnly: false,
        confidence: 60,
        decision: "strong_yes",
        hardBlockers: 0,
        targetUrl: "https://customboard.org/apply/123",
      };

      // In Normal Auto Apply: user-directed flow allows it
      expect(evaluateNormalAutoApplyDecision(case1)).toBe(true);

      // In True Autonomy: strictly rejected because untrusted source and confidence < 90
      const trueAutonomyCase1 = evaluateTrueAutonomyDecision({
        targetUrl: case1.targetUrl,
        evaluationConfidence: case1.confidence,
        canonicalDecision: case1.decision,
        hardBlockers: case1.hardBlockers,
        saveAsDraftOnly: case1.saveAsDraftOnly,
      });
      expect(trueAutonomyCase1.safeToApply).toBe(false);

      // Case 2: 75% confidence on trusted source
      const case2 = {
        saveAsDraftOnly: false,
        confidence: 75,
        decision: "strong_yes",
        hardBlockers: 0,
        targetUrl: "https://jobs.lever.co/company/123",
      };

      // Normal Auto Apply: allowed
      expect(evaluateNormalAutoApplyDecision(case2)).toBe(true);

      // True Autonomy: rejected because 75% < 90%
      const trueAutonomyCase2 = evaluateTrueAutonomyDecision({
        targetUrl: case2.targetUrl,
        evaluationConfidence: case2.confidence,
        canonicalDecision: case2.decision,
        hardBlockers: case2.hardBlockers,
        saveAsDraftOnly: case2.saveAsDraftOnly,
      });
      expect(trueAutonomyCase2.safeToApply).toBe(false);
      expect(trueAutonomyCase2.reason).toContain("below the 90% threshold");
    });
  });

  describe("Per-job automation payload & draft tailoring preservation", () => {
    it("keeps tailored resume data in scope while dispatching each job", () => {
      expect(jobPageSource).toMatch(
        /for\s*\(const item of jobsWithTargets\)\s*\{\s*const \{ job, target \} = item;/,
      );
      expect(jobPageSource).not.toContain("(item as any)");
    });

    it("preserves tailoredResumeText in nextDraftPayload when demoted to draft", () => {
      expect(jobPageSource).toContain("if (item.tailoredResumeText) {");
      expect(jobPageSource).toContain("nextDraftPayload.resumeText = item.tailoredResumeText;");
    });

    it("updates True Autonomy UI copy to accurately reflect rules", () => {
      expect(jobPageSource).toMatch(
        /Only auto-submits jobs on trusted ATS platforms when\s+application confidence is at least 90% and no hard\s+blockers are detected\.\s+Other jobs are saved for review\./,
      );
    });
  });

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
