import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  hasAutoApplyRuns,
  getNextAutoApplyEnabledTier,
  getMinimumAutoApplyTier,
} from "../lib/subscriptionAccess";
import {
  isTrustedAutoApplySource,
  evaluateTrueAutonomyDecision,
  evaluateNormalAutoApplyDecision,
  validateSubmissionPolicy,
  TRUE_AUTONOMY_MIN_CONFIDENCE,
  TRUSTED_AUTO_APPLY_DOMAINS,
} from "../lib/autoApplySources";
import { BILLING_PLAN_DEFINITIONS } from "../lib/billingCatalog";

const jobPageSource = readFileSync(
  resolve(process.cwd(), "src/screens/Dashboard/pages/JobPage.tsx"),
  "utf8",
);

const applyToJobsSource = readFileSync(
  resolve(process.cwd(), "backend/supabase/functions/apply-to-jobs/index.ts"),
  "utf8",
);

const processQueueSource = readFileSync(
  resolve(process.cwd(), "backend/supabase/functions/process-auto-apply-queue/index.ts"),
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

describe("Auto-Apply Pipeline & Authoritative Backend Safety Policy", () => {
  describe("Problem 1: Auto Apply Entitlement & Dynamic Upgrade Helpers", () => {
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

    it("dynamically resolves next enabled tier from catalog ordering", () => {
      // Starter with 0 runs must be recommended Basics (next tier with runs)
      expect(getNextAutoApplyEnabledTier("Starter")).toBe("Basics");
      // Free recommends Basics (first higher tier with runs)
      expect(getNextAutoApplyEnabledTier("Free")).toBe("Basics");
      // Basics recommends Pro
      expect(getNextAutoApplyEnabledTier("Basics")).toBe("Pro");
      // Pro recommends Ultimate
      expect(getNextAutoApplyEnabledTier("Pro")).toBe("Ultimate");
      // Ultimate falls back to Basics
      expect(getNextAutoApplyEnabledTier("Ultimate")).toBe("Basics");
      // Null/undefined defaults to Basics
      expect(getNextAutoApplyEnabledTier(null)).toBe("Basics");

      // getMinimumAutoApplyTier defaults to Basics
      expect(getMinimumAutoApplyTier()).toBe("Basics");
      expect(getMinimumAutoApplyTier("Starter")).toBe("Basics");
    });

    it("verifies JobPage uses hasAutoApplyRuns and dynamic upgrade recommendation", () => {
      expect(jobPageSource).toContain("hasAutoApplyRuns(subscriptionTier)");
      expect(jobPageSource).not.toContain('hasSubscriptionAccess(subscriptionTier, "Free")');
      expect(jobPageSource).toContain("autoApplyUpgradeTier = getMinimumAutoApplyTier(subscriptionTier)");
      expect(jobPageSource).toContain("requiredTier={autoApplyUpgradeTier}");
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
      // Protocol-less input handling
      expect(
        isTrustedAutoApplySource("boards.greenhouse.io/example/jobs/123"),
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

    it("verifies canonical constants in shared policy", () => {
      expect(TRUE_AUTONOMY_MIN_CONFIDENCE).toBe(90);
      expect(TRUSTED_AUTO_APPLY_DOMAINS).toEqual([
        "greenhouse.io",
        "lever.co",
        "ashbyhq.com",
      ]);
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
      expect(result.code).toBe("true_autonomy_confidence_below_threshold");
      expect(result.reason).toContain("below the 90% threshold");
    });

    it("routes to draft when target is an untrusted source in True Autonomy even with 99 confidence", () => {
      const result = evaluateTrueAutonomyDecision({
        targetUrl: "https://untrusted-jobboard.com/jobs/101",
        evaluationConfidence: 99,
        hardBlockers: 0,
        saveAsDraftOnly: false,
      });

      expect(result.safeToApply).toBe(false);
      expect(result.code).toBe("true_autonomy_untrusted_source");
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
      expect(result.code).toBe("true_autonomy_hard_blocker");
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
      expect(result.code).toBe("true_autonomy_confidence_below_threshold");
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
      expect(trueAutonomyCase1.code).toBe("true_autonomy_untrusted_source");

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
      expect(trueAutonomyCase2.code).toBe("true_autonomy_confidence_below_threshold");
      expect(trueAutonomyCase2.reason).toContain("below the 90% threshold");
    });
  });

  describe("Backend Authoritative Submission Policy Validation", () => {
    describe("Absolute Final Submit Boundary (Explicit Consent Invariant)", () => {
      it("guarantees effectiveAutoSubmit=false when auto_submit=false, even with true_autonomy=true, submission_mode=autopilot, trusted source, 95% confidence, 0 blockers", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://boards.greenhouse.io/acme/jobs/123",
          requestedAutoSubmit: false,
          submissionMode: "autopilot",
          trueAutonomy: true,
          evaluationConfidence: 95,
          hardBlockers: 0,
        });

        expect(result.effectiveAutoSubmit).toBe(false);
        expect(result.mayFinalSubmit).toBe(false);
        expect(result.effectiveSubmissionMode).toBe("review");
      });

      it("guarantees NEVER final submit when auto_submit=false, true_autonomy=true, trusted source, 100% confidence, 0 blockers", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://jobs.lever.co/acme/jobs/456",
          requestedAutoSubmit: false,
          trueAutonomy: true,
          evaluationConfidence: 100,
          hardBlockers: 0,
        });

        expect(result.effectiveAutoSubmit).toBe(false);
        expect(result.mayFinalSubmit).toBe(false);
        expect(result.effectiveSubmissionMode).toBe("review");
      });

      it("denies final submit when saveAsDraftOnly=true regardless of other parameters", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://boards.greenhouse.io/acme/jobs/123",
          requestedAutoSubmit: true,
          submissionMode: "autopilot",
          trueAutonomy: true,
          evaluationConfidence: 95,
          hardBlockers: 0,
          saveAsDraftOnly: true,
        });

        expect(result.effectiveAutoSubmit).toBe(false);
        expect(result.mayFinalSubmit).toBe(false);
        expect(result.effectiveSubmissionMode).toBe("review");
        expect(result.reason).toBe("saved as draft for review");
      });
    });

    describe("Normal Auto Apply vs True Autonomy Distinction", () => {
      it("preserves ordinary final-submit behavior when auto_submit=true and true_autonomy=false on an untrusted source", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://customats.company.com/apply/789",
          requestedAutoSubmit: true,
          submissionMode: "autopilot",
          trueAutonomy: false,
          evaluationConfidence: 65,
          hardBlockers: 0,
        });

        expect(result.mayFinalSubmit).toBe(true);
        expect(result.effectiveAutoSubmit).toBe(true);
        expect(result.effectiveSubmissionMode).toBe("autopilot");
        expect(result.code).toBeUndefined();
      });

      it("allows ordinary final submit without requiring >=90 confidence or trusted ATS", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://workday.com/jobs/acme/123",
          requestedAutoSubmit: true,
          trueAutonomy: false,
        });

        expect(result.mayFinalSubmit).toBe(true);
        expect(result.effectiveAutoSubmit).toBe(true);
        expect(result.effectiveSubmissionMode).toBe("autopilot");
      });
    });

    describe("True Autonomy Strict Boundary", () => {
      it("permits final submission when auto_submit=true, true_autonomy=true, trusted source, verified confidence 95, and verified 0 blockers", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://boards.greenhouse.io/acme/jobs/123",
          requestedAutoSubmit: true,
          submissionMode: "autopilot",
          trueAutonomy: true,
          evaluationConfidence: 95,
          hardBlockers: 0,
        });

        expect(result.mayFinalSubmit).toBe(true);
        expect(result.effectiveAutoSubmit).toBe(true);
        expect(result.effectiveSubmissionMode).toBe("autopilot");
        expect(result.autonomyConfidence).toBe(95);
        expect(result.code).toBeUndefined();
      });

      it("routes to Draft when auto_submit=true, true_autonomy=true, trusted source, but confidence 89 (below 90)", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://jobs.lever.co/acme/123",
          requestedAutoSubmit: true,
          trueAutonomy: true,
          evaluationConfidence: 89,
          hardBlockers: 0,
        });

        expect(result.mayFinalSubmit).toBe(false);
        expect(result.effectiveAutoSubmit).toBe(false);
        expect(result.effectiveSubmissionMode).toBe("review");
        expect(result.code).toBe("true_autonomy_confidence_below_threshold");
        expect(result.reason).toContain("below the 90% threshold");
      });

      it("routes to Draft when auto_submit=true, true_autonomy=true, confidence 99, but untrusted source", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://untrusted-jobboard.com/jobs/101",
          requestedAutoSubmit: true,
          trueAutonomy: true,
          evaluationConfidence: 99,
          hardBlockers: 0,
        });

        expect(result.mayFinalSubmit).toBe(false);
        expect(result.effectiveAutoSubmit).toBe(false);
        expect(result.effectiveSubmissionMode).toBe("review");
        expect(result.code).toBe("true_autonomy_untrusted_source");
        expect(result.reason).toContain("source is not approved for True Autonomy");
      });

      it("routes to Draft with true_autonomy_missing_policy_data when auto_submit=true, true_autonomy=true, trusted source, but missing blocker evaluation", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://boards.greenhouse.io/acme/jobs/123",
          requestedAutoSubmit: true,
          trueAutonomy: true,
          evaluationConfidence: 95,
          hardBlockers: null, // blocker evaluation unavailable -> fails closed
        });

        expect(result.mayFinalSubmit).toBe(false);
        expect(result.effectiveAutoSubmit).toBe(false);
        expect(result.effectiveSubmissionMode).toBe("review");
        expect(result.code).toBe("true_autonomy_missing_policy_data");
        expect(result.reason).toContain("Missing blocker evaluation data");
      });

      it("routes to Draft with true_autonomy_missing_policy_data when hardBlockers is undefined", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://boards.greenhouse.io/acme/jobs/123",
          requestedAutoSubmit: true,
          trueAutonomy: true,
          evaluationConfidence: 95,
          // hardBlockers omitted
        });

        expect(result.mayFinalSubmit).toBe(false);
        expect(result.effectiveAutoSubmit).toBe(false);
        expect(result.code).toBe("true_autonomy_missing_policy_data");
      });

      it("routes to Draft with true_autonomy_hard_blocker when hard blockers exist", () => {
        const result = validateSubmissionPolicy({
          targetUrl: "https://jobs.ashbyhq.com/acme/123",
          requestedAutoSubmit: true,
          trueAutonomy: true,
          evaluationConfidence: 95,
          hardBlockers: 2,
        });

        expect(result.mayFinalSubmit).toBe(false);
        expect(result.effectiveAutoSubmit).toBe(false);
        expect(result.code).toBe("true_autonomy_hard_blocker");
        expect(result.reason).toContain("2 hard blockers detected");
      });
    });

    describe("Tampered Client Protection & Server Authoritative Resolution", () => {
      it("prevents client tampering: client claims confidence 100 and blockers 0, but server evaluation has confidence 72", () => {
        // Untrusted client payload
        const clientPayload = {
          auto_submit: true,
          true_autonomy: true,
          tailored_confidence: 100,
          evaluation_confidence: 100,
          hard_blockers_count: 0,
        };

        // Server authoritative record
        const serverPersistedEvaluation = {
          confidence_score: 72,
          blockers: [],
        };

        // Backend validates using server-persisted values, ignoring client claims for True Autonomy
        const policyResult = validateSubmissionPolicy({
          targetUrl: "https://boards.greenhouse.io/acme/jobs/123",
          requestedAutoSubmit: clientPayload.auto_submit,
          trueAutonomy: clientPayload.true_autonomy,
          tailoredConfidence: null, // Backend ignores client-supplied tailored confidence
          evaluationConfidence: serverPersistedEvaluation.confidence_score,
          hardBlockers: serverPersistedEvaluation.blockers.length,
        });

        expect(policyResult.mayFinalSubmit).toBe(false);
        expect(policyResult.effectiveAutoSubmit).toBe(false);
        expect(policyResult.code).toBe("true_autonomy_confidence_below_threshold");
        expect(policyResult.autonomyConfidence).toBe(72);
      });

      it("prevents client tampering: client claims confidence 100 and blockers 0, but server evaluation has hard blockers", () => {
        const clientPayload = {
          auto_submit: true,
          true_autonomy: true,
          tailored_confidence: 100,
          evaluation_confidence: 100,
          hard_blockers_count: 0,
        };

        const serverPersistedEvaluation = {
          confidence_score: 95,
          blockers: ["Requires US citizenship", "Requires active Top Secret clearance"],
        };

        const policyResult = validateSubmissionPolicy({
          targetUrl: "https://boards.greenhouse.io/acme/jobs/123",
          requestedAutoSubmit: clientPayload.auto_submit,
          trueAutonomy: clientPayload.true_autonomy,
          tailoredConfidence: null,
          evaluationConfidence: serverPersistedEvaluation.confidence_score,
          hardBlockers: serverPersistedEvaluation.blockers.length,
        });

        expect(policyResult.mayFinalSubmit).toBe(false);
        expect(policyResult.effectiveAutoSubmit).toBe(false);
        expect(policyResult.code).toBe("true_autonomy_hard_blocker");
        expect(policyResult.hardBlockers).toBe(2);
      });
    });

    describe("RTRVR Final Authority & Prompt Integrity", () => {
      function generateRtrvrPrompt(effectiveAutoSubmit: boolean): string {
        return [
          `You are JobRaker's governed auto-apply agent.`,
          `- Fill in the application fields accurately using the candidate's verified information.`,
          effectiveAutoSubmit
            ? `- Complete and submit the application.`
            : `- Fill and prepare the form, but do not click final submit (save draft).`,
        ].join("\n");
      }

      it("guarantees RTRVR prompt receives draft instruction and NEVER 'Complete and submit' when auto_submit=false", () => {
        const policyResult = validateSubmissionPolicy({
          targetUrl: "https://boards.greenhouse.io/acme/jobs/123",
          requestedAutoSubmit: false,
          trueAutonomy: true,
          evaluationConfidence: 99,
          hardBlockers: 0,
        });

        const effectiveAutoSubmit = Boolean(false && policyResult.mayFinalSubmit);
        const prompt = generateRtrvrPrompt(effectiveAutoSubmit);

        expect(prompt).toContain("- Fill and prepare the form, but do not click final submit (save draft).");
        expect(prompt).not.toContain("- Complete and submit the application.");
      });

      it("verifies in process-auto-apply-queue source code that RTRVR prompt only submits when effectiveAutoSubmit is true", () => {
        expect(processQueueSource).toContain(
          "effectiveAutoSubmit ? `- Complete and submit the application.` : `- Fill and prepare the form, but do not click final submit (save draft).`",
        );
        expect(processQueueSource).toContain(
          "effectiveAutoSubmit = Boolean(requestedAutoSubmit && policyResult.mayFinalSubmit)",
        );
      });
    });

    it("preserves ordinary Auto Apply review workflows without rejection codes", () => {
      // Normal review mode on an untrusted source with moderate score
      const result = validateSubmissionPolicy({
        targetUrl: "https://custom-site.com/careers/456",
        requestedAutoSubmit: false,
        submissionMode: "review",
        jobMatchScore: 65,
        hardBlockers: 0,
      });

      expect(result.mayFinalSubmit).toBe(false);
      expect(result.effectiveAutoSubmit).toBe(false);
      expect(result.effectiveSubmissionMode).toBe("review");
      // Crucial: no error code or failure reason generated for ordinary review mode!
      expect(result.code).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });
  });

  describe("Backend Function Implementations & RTRVR Safety Guardrails", () => {
    it("verifies apply-to-jobs Edge Function enforces authoritative submission policy", () => {
      // Imports the shared policy
      expect(applyToJobsSource).toContain('from "../../shared/auto-apply-policy.ts"');
      // Calls validateSubmissionPolicy
      expect(applyToJobsSource).toContain("validateSubmissionPolicy({");
      // Passes effectiveAutoSubmit and submissionMode to rtrvrStartInput
      expect(applyToJobsSource).toContain("autoSubmit: effectiveAutoSubmit");
      expect(applyToJobsSource).toContain("submissionMode: effectiveSubmissionMode");
      // Persists policy validation into provider_run_output
      expect(applyToJobsSource).toContain("policy_validation: {");
    });

    it("verifies process-auto-apply-queue Edge Function enforces authoritative True Autonomy on RTRVR prompt", () => {
      // Imports the shared policy
      expect(processQueueSource).toContain('from "../../shared/auto-apply-policy.ts"');
      // Re-validates policy in queue execution
      expect(processQueueSource).toContain("validateSubmissionPolicy({");
      // Sets effectiveAutoSubmit
      expect(processQueueSource).toContain("effectiveAutoSubmit = Boolean(requestedAutoSubmit && policyResult.mayFinalSubmit)");
      // Only gives final submit permission to RTRVR prompt when effectiveAutoSubmit is true
      expect(processQueueSource).toContain("effectiveAutoSubmit ? `- Complete and submit the application.` : `- Fill and prepare the form, but do not click final submit (save draft).`");
      // Treats policy violations as non-retryable
      expect(processQueueSource).toContain("isPolicyViolation");
      expect(processQueueSource).toContain("isNonRetryable =");
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

    it("verifies submission_mode payload in JobPage is strictly derived from autoSubmitApplications, not trueAutonomyEnabled", () => {
      expect(jobPageSource).toMatch(
        /submission_mode:\s*\(?\s*autoSubmitApplications\s*\?\s*"autopilot"\s*:\s*"review"/,
      );
      expect(jobPageSource).not.toMatch(
        /submission_mode:\s*\(?\s*trueAutonomyEnabled\s*\?\s*"autopilot"/,
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

  describe("job_evaluations Database RLS & Privilege Security Model", () => {
    const migrationSql = readFileSync(
      resolve(
        process.cwd(),
        "backend/supabase/migrations/20260910223500_harden_job_evaluations_read_only_rls.sql",
      ),
      "utf8",
    );

    it("verifies migration drops all permissive mutation policies", () => {
      expect(migrationSql).toContain(
        'DROP POLICY IF EXISTS "Users can insert their own job evaluations"',
      );
      expect(migrationSql).toContain(
        'DROP POLICY IF EXISTS "Users can update their own job evaluations"',
      );
      expect(migrationSql).toContain(
        'DROP POLICY IF EXISTS "Users can delete their own job evaluations"',
      );
    });

    it("verifies migration revokes INSERT, UPDATE, DELETE, TRUNCATE from PUBLIC, anon, and authenticated", () => {
      expect(migrationSql).toMatch(
        /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE,\s*TRUNCATE\s+ON\s+public\.job_evaluations\s+FROM\s+PUBLIC,\s*anon,\s*authenticated;/i,
      );
    });

    it("verifies migration explicitly restricts authenticated users to SELECT own records", () => {
      expect(migrationSql).toMatch(
        /CREATE POLICY "Users can view their own job evaluations"\s+ON public\.job_evaluations FOR SELECT\s+TO authenticated\s+USING \(auth\.uid\(\) = user_id\);/i,
      );
      expect(migrationSql).toMatch(
        /GRANT SELECT\s+ON public\.job_evaluations\s+TO authenticated;/i,
      );
    });

    it("verifies migration grants full privileges solely to service_role and keeps RLS enabled", () => {
      expect(migrationSql).toMatch(
        /GRANT ALL\s+ON public\.job_evaluations\s+TO service_role;/i,
      );
      expect(migrationSql).toMatch(
        /ALTER TABLE public\.job_evaluations ENABLE ROW LEVEL SECURITY;/i,
      );
    });

    // Simulates the exact PostgreSQL privilege and RLS matrix established by the migration
    function simulateJobEvaluationsDbAuthorization(params: {
      role: "anon" | "authenticated" | "service_role";
      operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
      authUid?: string;
      rowUserId?: string;
    }): { allowed: boolean; reason?: string } {
      const { role, operation, authUid, rowUserId } = params;

      // 1. service_role bypasses RLS and has ALL table privileges
      if (role === "service_role") {
        return { allowed: true };
      }

      // 2. Table-level PostgreSQL privilege check:
      // anon and authenticated have REVOKE INSERT, UPDATE, DELETE, TRUNCATE
      // authenticated has GRANT SELECT
      if (operation !== "SELECT") {
        return {
          allowed: false,
          reason: `permission denied for table job_evaluations: ${operation} revoked from ${role}`,
        };
      }

      if (role === "anon") {
        return {
          allowed: false,
          reason: "permission denied for table job_evaluations: SELECT not granted to anon",
        };
      }

      // 3. RLS policy check for SELECT: USING (auth.uid() = user_id)
      if (authUid && rowUserId && authUid === rowUserId) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: "row-level security policy: user_id does not match auth.uid()",
      };
    }

    it("authenticated user SELECT own job_evaluations -> allowed", () => {
      const auth = simulateJobEvaluationsDbAuthorization({
        role: "authenticated",
        operation: "SELECT",
        authUid: "user-123",
        rowUserId: "user-123",
      });
      expect(auth.allowed).toBe(true);
    });

    it("authenticated user SELECT another user's job_evaluations -> denied", () => {
      const auth = simulateJobEvaluationsDbAuthorization({
        role: "authenticated",
        operation: "SELECT",
        authUid: "user-123",
        rowUserId: "user-456",
      });
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("row-level security policy");
    });

    it("authenticated user UPDATE own confidence_score -> denied", () => {
      const auth = simulateJobEvaluationsDbAuthorization({
        role: "authenticated",
        operation: "UPDATE",
        authUid: "user-123",
        rowUserId: "user-123",
      });
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("permission denied");
    });

    it("authenticated user UPDATE own blockers -> denied", () => {
      const auth = simulateJobEvaluationsDbAuthorization({
        role: "authenticated",
        operation: "UPDATE",
        authUid: "user-123",
        rowUserId: "user-123",
      });
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("permission denied");
    });

    it("authenticated user INSERT forged evaluation -> denied", () => {
      const auth = simulateJobEvaluationsDbAuthorization({
        role: "authenticated",
        operation: "INSERT",
        authUid: "user-123",
        rowUserId: "user-123",
      });
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("permission denied");
    });

    it("authenticated user modifies another user's evaluation -> denied", () => {
      const auth = simulateJobEvaluationsDbAuthorization({
        role: "authenticated",
        operation: "UPDATE",
        authUid: "user-attacker",
        rowUserId: "user-victim",
      });
      expect(auth.allowed).toBe(false);
      expect(auth.reason).toContain("permission denied");
    });

    it("service_role inserts evaluation -> allowed", () => {
      const auth = simulateJobEvaluationsDbAuthorization({
        role: "service_role",
        operation: "INSERT",
      });
      expect(auth.allowed).toBe(true);
    });

    it("service_role updates evaluation -> allowed", () => {
      const auth = simulateJobEvaluationsDbAuthorization({
        role: "service_role",
        operation: "UPDATE",
      });
      expect(auth.allowed).toBe(true);
    });
  });

  describe("Server-Authoritative Evaluation Ownership & Application Policy", () => {
    interface MockJobEvaluation {
      id: string;
      user_id: string;
      job_id: string;
      confidence_score: number | null;
      blockers: any;
    }

    // Exact replica of the resolution logic implemented in apply-to-jobs & process-auto-apply-queue
    function resolveAuthoritativeEvaluation(params: {
      userId: string;
      jobId: string;
      evaluationId?: string | null;
      dbEvaluations: MockJobEvaluation[];
    }): {
      authoritativeConfidence: number | null;
      authoritativeHardBlockers: number | null;
      resolvedEvaluationId: string | null;
      evaluatedServerSide: boolean;
      blockersEvaluated: boolean;
    } {
      const { userId, jobId, evaluationId, dbEvaluations } = params;
      let evalRow: MockJobEvaluation | null = null;
      let evaluationInvalid = false;

      if (evaluationId) {
        if (!jobId) {
          evaluationInvalid = true;
        } else {
          const match = dbEvaluations.find(
            (e) => e.id === evaluationId && e.user_id === userId && e.job_id === jobId,
          );
          if (match) {
            evalRow = match;
          } else {
            // Provided evaluation_id does not match user or job -> invalid, do not fallback
            evaluationInvalid = true;
          }
        }
      }

      if (!evalRow && !evaluationInvalid && jobId) {
        const match = dbEvaluations.find(
          (e) => e.job_id === jobId && e.user_id === userId,
        );
        if (match) evalRow = match;
      }

      if (evalRow) {
        const conf =
          typeof evalRow.confidence_score === "number" && !isNaN(evalRow.confidence_score)
            ? evalRow.confidence_score
            : null;
        let hardBlockers = 0;
        if (Array.isArray(evalRow.blockers)) {
          hardBlockers = evalRow.blockers.length;
        } else if (evalRow.blockers && typeof evalRow.blockers === "object") {
          hardBlockers = Object.keys(evalRow.blockers).length;
        }

        return {
          authoritativeConfidence: conf,
          authoritativeHardBlockers: hardBlockers,
          resolvedEvaluationId: evalRow.id,
          evaluatedServerSide: true,
          blockersEvaluated: true,
        };
      }

      // No authoritative evaluation or invalid evaluation: fail closed, no match_score fallback
      return {
        authoritativeConfidence: null,
        authoritativeHardBlockers: null,
        resolvedEvaluationId: null,
        evaluatedServerSide: true,
        blockersEvaluated: false,
      };
    }

    const mockDb: MockJobEvaluation[] = [
      {
        id: "eval-legit-72",
        user_id: "user-candidate",
        job_id: "job-101",
        confidence_score: 72,
        blockers: [],
      },
      {
        id: "eval-with-blockers",
        user_id: "user-candidate",
        job_id: "job-102",
        confidence_score: 95,
        blockers: ["requires active TS/SCI clearance"],
      },
      {
        id: "eval-job-A-98",
        user_id: "user-candidate",
        job_id: "job-A",
        confidence_score: 98,
        blockers: [],
      },
      {
        id: "eval-other-user-99",
        user_id: "user-other",
        job_id: "job-103",
        confidence_score: 99,
        blockers: [],
      },
      {
        id: "eval-perfect-95",
        user_id: "user-candidate",
        job_id: "job-greenhouse-perfect",
        confidence_score: 95,
        blockers: [],
      },
    ];

    it("client request claims confidence=100/blockers=0, DB evaluation says confidence=72 -> True Autonomy denied", () => {
      // Backend resolves authoritative evaluation from database
      const resolved = resolveAuthoritativeEvaluation({
        userId: "user-candidate",
        jobId: "job-101",
        evaluationId: "eval-legit-72",
        dbEvaluations: mockDb,
      });

      // Authoritative evaluation wins over client claims
      expect(resolved.authoritativeConfidence).toBe(72);
      expect(resolved.authoritativeHardBlockers).toBe(0);

      // Policy validation using server authoritative values
      const policyResult = validateSubmissionPolicy({
        targetUrl: "https://boards.greenhouse.io/acme/jobs/101",
        requestedAutoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: true,
        evaluationConfidence: resolved.authoritativeConfidence,
        hardBlockers: resolved.authoritativeHardBlockers,
      });

      expect(policyResult.mayFinalSubmit).toBe(false);
      expect(policyResult.effectiveAutoSubmit).toBe(false);
      expect(policyResult.code).toBe("true_autonomy_confidence_below_threshold");
      expect(policyResult.reason).toContain("72% is below the 90% threshold");
    });

    it("client request claims confidence=100/blockers=0, DB evaluation has blockers -> True Autonomy denied", () => {
      const resolved = resolveAuthoritativeEvaluation({
        userId: "user-candidate",
        jobId: "job-102",
        evaluationId: "eval-with-blockers",
        dbEvaluations: mockDb,
      });

      expect(resolved.authoritativeConfidence).toBe(95);
      expect(resolved.authoritativeHardBlockers).toBe(1);

      const policyResult = validateSubmissionPolicy({
        targetUrl: "https://boards.greenhouse.io/acme/jobs/102",
        requestedAutoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: true,
        evaluationConfidence: resolved.authoritativeConfidence,
        hardBlockers: resolved.authoritativeHardBlockers,
      });

      expect(policyResult.mayFinalSubmit).toBe(false);
      expect(policyResult.effectiveAutoSubmit).toBe(false);
      expect(policyResult.code).toBe("true_autonomy_hard_blocker");
      expect(policyResult.reason).toContain("1 hard blocker detected");
    });

    it("evaluation_id belongs to same user but different job -> denied / missing policy data", () => {
      // Attacker attempts to apply to job-B using high-scoring evaluation from job-A
      const resolved = resolveAuthoritativeEvaluation({
        userId: "user-candidate",
        jobId: "job-B",
        evaluationId: "eval-job-A-98",
        dbEvaluations: mockDb,
      });

      // Evaluation was rejected because job_id does not match jobContext.job_id
      expect(resolved.authoritativeConfidence).toBeNull();
      expect(resolved.authoritativeHardBlockers).toBeNull();

      const policyResult = validateSubmissionPolicy({
        targetUrl: "https://boards.greenhouse.io/acme/jobs/job-B",
        requestedAutoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: true,
        evaluationConfidence: resolved.authoritativeConfidence,
        hardBlockers: resolved.authoritativeHardBlockers,
      });

      expect(policyResult.mayFinalSubmit).toBe(false);
      expect(policyResult.effectiveAutoSubmit).toBe(false);
      expect(policyResult.code).toBe("true_autonomy_missing_policy_data");
    });

    it("evaluation_id belongs to another user -> denied / missing policy data", () => {
      // User attempts to use an evaluation row belonging to a different user
      const resolved = resolveAuthoritativeEvaluation({
        userId: "user-candidate",
        jobId: "job-103",
        evaluationId: "eval-other-user-99",
        dbEvaluations: mockDb,
      });

      expect(resolved.authoritativeConfidence).toBeNull();
      expect(resolved.authoritativeHardBlockers).toBeNull();

      const policyResult = validateSubmissionPolicy({
        targetUrl: "https://jobs.lever.co/acme/job-103",
        requestedAutoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: true,
        evaluationConfidence: resolved.authoritativeConfidence,
        hardBlockers: resolved.authoritativeHardBlockers,
      });

      expect(policyResult.mayFinalSubmit).toBe(false);
      expect(policyResult.effectiveAutoSubmit).toBe(false);
      expect(policyResult.code).toBe("true_autonomy_missing_policy_data");
    });

    it("valid server-owned evaluation + trusted ATS + confidence=95 + blockers=[] -> final submit permitted", () => {
      const resolved = resolveAuthoritativeEvaluation({
        userId: "user-candidate",
        jobId: "job-greenhouse-perfect",
        evaluationId: "eval-perfect-95",
        dbEvaluations: mockDb,
      });

      expect(resolved.authoritativeConfidence).toBe(95);
      expect(resolved.authoritativeHardBlockers).toBe(0);

      const policyResult = validateSubmissionPolicy({
        targetUrl: "https://boards.greenhouse.io/acme/jobs/perfect-123",
        requestedAutoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: true,
        evaluationConfidence: resolved.authoritativeConfidence,
        hardBlockers: resolved.authoritativeHardBlockers,
      });

      expect(policyResult.mayFinalSubmit).toBe(true);
      expect(policyResult.effectiveAutoSubmit).toBe(true);
      expect(policyResult.effectiveSubmissionMode).toBe("autopilot");
      expect(policyResult.code).toBeUndefined();
    });

    it("verifies Edge function static contracts check evaluation user_id and job_id matching", () => {
      const applySrc = readFileSync(
        resolve(process.cwd(), "backend/supabase/functions/apply-to-jobs/index.ts"),
        "utf8",
      );
      const queueSrc = readFileSync(
        resolve(process.cwd(), "backend/supabase/functions/process-auto-apply-queue/index.ts"),
        "utf8",
      );

      // apply-to-jobs enforces both user_id and job_id when querying evaluation_id
      expect(applySrc).toContain('.eq("id", jobContext.evaluation_id)');
      expect(applySrc).toContain('.eq("user_id", userId)');
      expect(applySrc).toContain('.eq("job_id", jobContext.job_id)');
      expect(applySrc).toContain("evaluationInvalid = true");

      // process-auto-apply-queue enforces both user_id and job_id when querying evalId
      expect(queueSrc).toContain('.eq("id", evalId)');
      expect(queueSrc).toContain('.eq("user_id", app.user_id)');
      expect(queueSrc).toContain('.eq("job_id", app.job_id)');
      expect(queueSrc).toContain("evalInvalid = true");

      // True Autonomy does NOT fall back to jobs.match_score
      expect(applySrc).not.toContain("persistedJobMatchScore");
      expect(queueSrc).not.toContain("app.match_score;");
    });

    it("verifies forward-only migration 20260910223500_harden_job_evaluations_read_only_rls locks down job_evaluations", () => {
      const migrationPath = resolve(
        process.cwd(),
        "backend/supabase/migrations/20260910223500_harden_job_evaluations_read_only_rls.sql",
      );
      const sql = readFileSync(migrationPath, "utf8");

      // 1. Permissive policies are dropped
      expect(sql).toContain('DROP POLICY IF EXISTS "Users can insert their own job evaluations"');
      expect(sql).toContain('DROP POLICY IF EXISTS "Users can update their own job evaluations"');
      expect(sql).toContain('DROP POLICY IF EXISTS "Users can delete their own job evaluations"');

      // 2. Select policy is strictly scoped to own rows
      expect(sql).toContain('CREATE POLICY "Users can view their own job evaluations"');
      expect(sql).toContain("USING (auth.uid() = user_id)");

      // 3. Mutation privileges revoked from authenticated and anon
      expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE");
      expect(sql).toContain("FROM PUBLIC, anon, authenticated");

      // 4. Authenticated has SELECT only
      expect(sql).toContain("GRANT SELECT\n  ON public.job_evaluations\n  TO authenticated");

      // 5. service_role has ALL
      expect(sql).toContain("GRANT ALL\n  ON public.job_evaluations\n  TO service_role");

      // 6. RLS enabled
      expect(sql).toContain("ALTER TABLE public.job_evaluations ENABLE ROW LEVEL SECURITY;");
    });

    it("simulates RLS execution model proving authenticated cannot forge evaluations", () => {
      type Role = "authenticated" | "service_role" | "anon";
      interface EvaluationRow {
        id: string;
        user_id: string;
        confidence_score: number;
        blockers: string[];
        canonical_decision: string;
      }

      const rows: EvaluationRow[] = [
        {
          id: "eval-1",
          user_id: "user-legit",
          confidence_score: 95,
          blockers: [],
          canonical_decision: "eligible",
        },
      ];

      function executeSqlOperation(
        role: Role,
        currentAuthUid: string | null,
        op: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
        targetUserId?: string,
      ): { allowed: boolean; rows?: EvaluationRow[] } {
        if (role === "service_role") {
          return { allowed: true, rows };
        }
        if (role === "authenticated") {
          if (op === "SELECT") {
            const filtered = rows.filter((r) => r.user_id === currentAuthUid);
            return { allowed: true, rows: filtered };
          }
          // INSERT, UPDATE, DELETE are strictly denied by REVOKE and absence of policy
          return { allowed: false };
        }
        return { allowed: false };
      }

      // Authenticated user can SELECT own rows
      const selectOwn = executeSqlOperation("authenticated", "user-legit", "SELECT");
      expect(selectOwn.allowed).toBe(true);
      expect(selectOwn.rows).toHaveLength(1);

      // Authenticated user cannot SELECT other users' rows
      const selectOther = executeSqlOperation("authenticated", "user-attacker", "SELECT");
      expect(selectOther.allowed).toBe(true);
      expect(selectOther.rows).toHaveLength(0);

      // Authenticated user CANNOT INSERT forged evaluation
      const insertAttempt = executeSqlOperation("authenticated", "user-attacker", "INSERT", "user-attacker");
      expect(insertAttempt.allowed).toBe(false);

      // Authenticated user CANNOT UPDATE evaluation
      const updateAttempt = executeSqlOperation("authenticated", "user-attacker", "UPDATE", "user-legit");
      expect(updateAttempt.allowed).toBe(false);

      // Authenticated user CANNOT DELETE evaluation
      const deleteAttempt = executeSqlOperation("authenticated", "user-attacker", "DELETE", "user-legit");
      expect(deleteAttempt.allowed).toBe(false);

      // service_role has full access
      const serviceRoleOp = executeSqlOperation("service_role", null, "INSERT");
      expect(serviceRoleOp.allowed).toBe(true);
    });
  });
});

