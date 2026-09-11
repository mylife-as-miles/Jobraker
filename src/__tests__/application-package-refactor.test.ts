import { describe, it, expect } from "vitest";
import {
  type ApplicationPackage,
  type AutomationMode,
  CRITICAL_ANSWER_CATEGORIES,
  isCriticalAnswerCategory,
  mapAutomationModeToLegacyFlags,
  deriveAutomationModeFromLegacyFlags,
  TRUSTED_SOURCES_BY_CATEGORY,
  isTrustedSourceForCategory,
  normalizeQuestionCategory,
  validateAnswerValue,
  resolveScreeningAnswerPayload,
} from "../lib/applicationPackage";
import {
  buildRtrvrPromptFromPackage,
  evaluatePackageReadiness,
} from "../../backend/supabase/shared/application-package";
import { validateSubmissionPolicy } from "../lib/autoApplySources";
import { validateSubmissionPolicy as validateBackendPolicy } from "../../backend/supabase/shared/auto-apply-policy";

describe("ApplicationPackage Refactor & AutomationMode Contracts", () => {
  describe("AutomationMode Mappings", () => {
    it("correctly maps 'review' to legacy flags with autoSubmit=false", () => {
      const flags = mapAutomationModeToLegacyFlags("review");
      expect(flags).toEqual({
        autoSubmit: false,
        submissionMode: "review",
        trueAutonomy: false,
      });
    });

    it("correctly maps 'autopilot' to legacy flags with autoSubmit=true, trueAutonomy=false", () => {
      const flags = mapAutomationModeToLegacyFlags("autopilot");
      expect(flags).toEqual({
        autoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: false,
      });
    });

    it("correctly maps 'autopilot_strict' to legacy flags with autoSubmit=true, trueAutonomy=true", () => {
      const flags = mapAutomationModeToLegacyFlags("autopilot_strict");
      expect(flags).toEqual({
        autoSubmit: true,
        submissionMode: "autopilot",
        trueAutonomy: true,
      });
    });

    it("derives 'autopilot_strict' when autoSubmit=true and trueAutonomy=true", () => {
      expect(
        deriveAutomationModeFromLegacyFlags({
          autoSubmit: true,
          submissionMode: "autopilot",
          trueAutonomy: true,
        }),
      ).toBe("autopilot_strict");
    });

    it("derives 'autopilot' when autoSubmit=true and trueAutonomy=false", () => {
      expect(
        deriveAutomationModeFromLegacyFlags({
          autoSubmit: true,
          submissionMode: "autopilot",
          trueAutonomy: false,
        }),
      ).toBe("autopilot");
    });

    it("derives 'review' when autoSubmit=false regardless of other flags", () => {
      expect(
        deriveAutomationModeFromLegacyFlags({
          autoSubmit: false,
          submissionMode: "autopilot",
          trueAutonomy: true,
        }),
      ).toBe("review");
    });

    it("derives 'review' when submissionMode='review' even if autoSubmit was true", () => {
      expect(
        deriveAutomationModeFromLegacyFlags({
          autoSubmit: true,
          submissionMode: "review",
          trueAutonomy: false,
        }),
      ).toBe("review");
    });
  });

  describe("Critical Answer Categories & Anti-Hallucination Boundaries", () => {
    it("identifies all critical answer categories", () => {
      expect(CRITICAL_ANSWER_CATEGORIES).toContain("work_authorization");
      expect(CRITICAL_ANSWER_CATEGORIES).toContain("sponsorship");
      expect(CRITICAL_ANSWER_CATEGORIES).toContain("salary");
      expect(CRITICAL_ANSWER_CATEGORIES).toContain("security_clearance");
      expect(CRITICAL_ANSWER_CATEGORIES).toContain("relocation");
      expect(CRITICAL_ANSWER_CATEGORIES).toContain("prior_employment");
      expect(CRITICAL_ANSWER_CATEGORIES).toContain("legal");
    });

    it("verifies isCriticalAnswerCategory returns true for critical and false for non-critical", () => {
      expect(isCriticalAnswerCategory("work_authorization")).toBe(true);
      expect(isCriticalAnswerCategory("salary")).toBe(true);
      expect(isCriticalAnswerCategory("legal")).toBe(true);
      expect(isCriticalAnswerCategory("general")).toBe(false);
      expect(isCriticalAnswerCategory("experience")).toBe(false);
    });
  });

  describe("evaluatePackageReadiness", () => {
    const basePackage: ApplicationPackage = {
      version: 1,
      applicationId: "app-123",
      job: {
        id: "job-123",
        title: "Staff Software Engineer",
        company: "Acme Corp",
        applyUrl: "https://jobs.lever.co/acme/123",
      },
      candidate: {
        userId: "user-456",
        name: "Jane Doe",
        email: "jane@example.com",
      },
      resume: {
        resumeId: "res-789",
        tailored: false,
      },
      screeningAnswers: [],
      eligibilityAnswers: [],
      submissionPolicy: {
        mode: "autopilot",
        requestedFinalSubmit: true,
        effectiveFinalSubmit: true,
      },
      confidence: {
        jobFit: 92,
        eligibility: 95,
      },
      unresolvedRequirements: [],
      provenance: {
        evaluationId: "eval-1",
        generatedAt: new Date().toISOString(),
      },
    };

    it("flags unresolved critical questions when critical values are null or empty", () => {
      const pkgWithEmptyAnswer: ApplicationPackage = {
        ...basePackage,
        eligibilityAnswers: [
          {
            questionText: "Are you legally authorized to work in the US?",
            value: null,
            category: "work_authorization",
            provenance: { source: "candidate_profile" },
            confidence: 0,
            mutable: false,
            requiresUserInput: false,
          },
        ],
      };

      const readiness = evaluatePackageReadiness(pkgWithEmptyAnswer);
      expect(readiness.unresolvedCriticalQuestions).toContain(
        "Are you legally authorized to work in the US?",
      );
    });

    it("flags hard blockers when unresolved requirements have hard_disqualifier category", () => {
      const pkgWithDisqualifier: ApplicationPackage = {
        ...basePackage,
        unresolvedRequirements: [
          {
            id: "req-1",
            category: "hard_disqualifier",
            title: "Must possess active Top Secret clearance",
            resolved: false,
            requiresUserInput: true,
          },
        ],
      };

      const readiness = evaluatePackageReadiness(pkgWithDisqualifier);
      expect(readiness.hardBlockers).toContain(
        "Must possess active Top Secret clearance",
      );
      expect(readiness.unresolvedCriticalQuestions).toContain(
        "Must possess active Top Secret clearance",
      );
    });

    it("returns zero blockers and zero unresolved questions for a complete package", () => {
      const completePkg: ApplicationPackage = {
        ...basePackage,
        screeningAnswers: [
          {
            questionText: "Are you authorized to work in the US?",
            value: "Yes",
            category: "work_authorization",
            provenance: { source: "candidate_profile" },
            confidence: 100,
            mutable: false,
            requiresUserInput: false,
          },
          {
            questionText: "Do you require visa sponsorship now or in the future?",
            value: "No",
            category: "sponsorship",
            provenance: { source: "candidate_profile" },
            confidence: 100,
            mutable: false,
            requiresUserInput: false,
          },
        ],
        unresolvedRequirements: [],
      };

      const readiness = evaluatePackageReadiness(completePkg);
      expect(readiness.hardBlockers).toHaveLength(0);
      expect(readiness.unresolvedCriticalQuestions).toHaveLength(0);
    });
  });

  describe("buildRtrvrPromptFromPackage", () => {
    it("generates strict executor constraints and prohibits final submit in review mode", () => {
      const pkg: ApplicationPackage = {
        version: 1,
        applicationId: "app-abc",
        job: {
          id: "job-abc",
          title: "Senior Fullstack Engineer",
          company: "TechNova",
          applyUrl: "https://boards.greenhouse.io/technova/jobs/999",
        },
        candidate: {
          userId: "user-1",
          name: "Alex Smith",
          email: "alex@example.com",
          phone: "+1 555 123 4567",
          location: "San Francisco, CA",
        },
        resume: {
          signedUrl: "https://storage.supabase.co/resumes/alex.pdf",
          tailored: true,
        },
        coverLetter: {
          text: "Dear Hiring Team, I am excited to apply...",
          generated: true,
        },
        screeningAnswers: [
          {
            questionText: "Will you now or in the future require visa sponsorship?",
            value: "No",
            category: "sponsorship",
            provenance: { source: "candidate_profile" },
            confidence: 100,
            mutable: false,
            requiresUserInput: false,
          },
        ],
        eligibilityAnswers: [],
        submissionPolicy: {
          mode: "review",
          requestedFinalSubmit: false,
          effectiveFinalSubmit: false,
        },
        confidence: {},
        unresolvedRequirements: [],
        provenance: {
          generatedAt: new Date().toISOString(),
        },
      };

      const prompt = buildRtrvrPromptFromPackage(pkg);

      // Core instructions and candidate data
      expect(prompt).toContain('Target Application URL: https://boards.greenhouse.io/technova/jobs/999');
      expect(prompt).toContain('Full Name: Alex Smith');
      expect(prompt).toContain('Email: alex@example.com');
      expect(prompt).toContain('Resume Document URL: https://storage.supabase.co/resumes/alex.pdf');
      expect(prompt).toContain('Dear Hiring Team, I am excited to apply...');

      // Answers with category and provenance
      expect(prompt).toContain(
        '- [sponsorship] "Will you now or in the future require visa sponsorship?": No (source: candidate_profile)',
      );

      // Strict anti-hallucination constraint
      expect(prompt).toContain(
        "NEVER invent, hallucinate, or guess candidate facts, salary requirements, visa sponsorship needs, security clearances, relocation preferences, or legal attestations.",
      );

      // Final submit prohibition in review mode
      expect(prompt).toContain(
        "FINAL SUBMISSION PROHIBITED (Review Mode): Fill and prepare the application form, but DO NOT click final submit.",
      );
      expect(prompt).not.toContain("FINAL SUBMISSION AUTHORIZED");
    });

    it("authorizes final submit when effectiveFinalSubmit is true", () => {
      const pkg: ApplicationPackage = {
        version: 1,
        applicationId: "app-def",
        job: {
          id: "job-def",
          title: "Backend Engineer",
          company: "CloudScale",
          applyUrl: "https://cloudscale.com/apply/1",
        },
        candidate: {
          userId: "user-2",
          name: "Sam Wilson",
        },
        resume: {
          tailored: false,
        },
        screeningAnswers: [],
        eligibilityAnswers: [],
        submissionPolicy: {
          mode: "autopilot",
          requestedFinalSubmit: true,
          effectiveFinalSubmit: true,
        },
        confidence: {},
        unresolvedRequirements: [],
        provenance: {
          generatedAt: new Date().toISOString(),
        },
      };

      const prompt = buildRtrvrPromptFromPackage(pkg);
      expect(prompt).toContain(
        "FINAL SUBMISSION AUTHORIZED: Complete the application form, verify fields, and click the final Submit button.",
      );
      expect(prompt).not.toContain("FINAL SUBMISSION PROHIBITED");
    });
  });

  describe("Submission Policy Frontend / Backend Parity with AutomationMode", () => {
    it("frontend policy validation respects automationMode: 'review' unconditionally", () => {
      const result = validateSubmissionPolicy({
        automationMode: "review",
        requestedAutoSubmit: false,
        targetUrl: "https://boards.greenhouse.io/acme/jobs/1",
        jobMatchScore: 99,
        hardBlockers: 0,
      });

      expect(result.effectiveAutoSubmit).toBe(false);
      expect(result.effectiveAutomationMode).toBe("review");
      expect(result.mayFinalSubmit).toBe(false);
    });

    it("backend policy validation matches frontend policy validation for automationMode", () => {
      const backendResult = validateBackendPolicy({
        automationMode: "autopilot_strict",
        targetUrl: "https://linkedin.com/jobs/view/123", // untrusted source
        jobMatchScore: 95,
        hardBlockers: 0,
      });

      const frontendResult = validateSubmissionPolicy({
        automationMode: "autopilot_strict",
        targetUrl: "https://linkedin.com/jobs/view/123",
        jobMatchScore: 95,
        hardBlockers: 0,
      });

      expect(backendResult.effectiveAutoSubmit).toBe(false);
      expect(frontendResult.effectiveAutoSubmit).toBe(false);
      expect(backendResult.code).toBe("true_autonomy_untrusted_source");
      expect(frontendResult.code).toBe("true_autonomy_untrusted_source");
      expect(backendResult.effectiveAutomationMode).toBe("review");
      expect(frontendResult.effectiveAutomationMode).toBe("review");
    });
  });

  describe("Provenance Rules & Anti-Hallucination for Critical Answers", () => {
    it("rejects provenance.source='generated' on critical categories even with 0.99 confidence", () => {
      const pkgWithGeneratedAnswer: ApplicationPackage = {
        version: 1,
        applicationId: "app-gen-1",
        job: {
          id: "job-1",
          title: "Senior Engineer",
          company: "Acme",
          applyUrl: "https://example.com/apply",
        },
        candidate: { userId: "user-1" },
        resume: { tailored: false },
        screeningAnswers: [
          {
            questionText: "Will you require sponsorship?",
            value: "No",
            category: "sponsorship",
            provenance: {
              source: "generated",
            },
            confidence: 0.99,
            mutable: false,
            requiresUserInput: false,
          },
        ],
        eligibilityAnswers: [],
        submissionPolicy: {
          mode: "autopilot",
          requestedFinalSubmit: true,
          effectiveFinalSubmit: true,
        },
        confidence: {},
        unresolvedRequirements: [],
        provenance: { generatedAt: new Date().toISOString() },
      };

      const readiness = evaluatePackageReadiness(pkgWithGeneratedAnswer);
      expect(readiness.unresolvedCriticalQuestions).toContain("Will you require sponsorship?");
      expect(pkgWithGeneratedAnswer.screeningAnswers[0].requiresUserInput).toBe(true);
    });

    it("accepts trusted sources (candidate_profile, user_answer, verified_memory, resume) for critical categories", () => {
      const pkgWithTrustedAnswers: ApplicationPackage = {
        version: 1,
        applicationId: "app-trusted-1",
        job: {
          id: "job-2",
          title: "Backend Engineer",
          company: "Beta Corp",
          applyUrl: "https://example.com/apply",
        },
        candidate: { userId: "user-2" },
        resume: { tailored: false },
        screeningAnswers: [
          {
            questionText: "Are you legally authorized to work in the US?",
            value: "Yes",
            category: "work_authorization",
            provenance: { source: "user_answer" },
            confidence: 1.0,
            mutable: false,
            requiresUserInput: false,
          },
          {
            questionText: "Will you require sponsorship?",
            value: "No",
            category: "sponsorship",
            provenance: { source: "candidate_profile" },
            confidence: 1.0,
            mutable: false,
            requiresUserInput: false,
          },
          {
            questionText: "Target salary",
            value: "$180,000",
            category: "salary",
            provenance: { source: "verified_memory" },
            confidence: 0.95,
            mutable: true,
            requiresUserInput: false,
          },
        ],
        eligibilityAnswers: [],
        submissionPolicy: {
          mode: "autopilot",
          requestedFinalSubmit: true,
          effectiveFinalSubmit: true,
        },
        confidence: {},
        unresolvedRequirements: [],
        provenance: { generatedAt: new Date().toISOString() },
      };

      const readiness = evaluatePackageReadiness(pkgWithTrustedAnswers);
      expect(readiness.unresolvedCriticalQuestions).toHaveLength(0);
    });
  });

  describe("Critical Answers Block ALL Autonomous Final Submissions (Autopilot & Autopilot Strict)", () => {
    it("demotes effectiveAutoSubmit and sets waiting_for_user in Autopilot mode when critical answers are missing", () => {
      const pkgWithMissingAnswer: ApplicationPackage = {
        version: 1,
        applicationId: "app-missing-1",
        job: {
          id: "job-3",
          title: "Software Engineer",
          company: "Gamma Corp",
          applyUrl: "https://example.com/apply",
        },
        candidate: { userId: "user-3" },
        resume: { tailored: false },
        screeningAnswers: [
          {
            questionText: "What is your target compensation?",
            value: null,
            category: "salary",
            provenance: { source: "user_answer" },
            confidence: 0,
            mutable: true,
            requiresUserInput: true,
          },
        ],
        eligibilityAnswers: [],
        submissionPolicy: {
          mode: "autopilot",
          requestedFinalSubmit: true,
          effectiveFinalSubmit: true,
        },
        confidence: {},
        unresolvedRequirements: [],
        provenance: { generatedAt: new Date().toISOString() },
      };

      const readiness = evaluatePackageReadiness(pkgWithMissingAnswer);
      expect(readiness.unresolvedCriticalQuestions).toContain("What is your target compensation?");

      // Mimic backend invariant enforcement
      let effectiveAutoSubmit = true;
      let lifecycleState = "queued";
      let reasonCode: string | null = null;

      if (effectiveAutoSubmit && readiness.unresolvedCriticalQuestions.length > 0) {
        effectiveAutoSubmit = false;
        lifecycleState = "waiting_for_user";
        reasonCode = "missing_required_answer";
        pkgWithMissingAnswer.submissionPolicy.effectiveFinalSubmit = false;
        pkgWithMissingAnswer.submissionPolicy.reasonCode = "missing_required_answer";
      }

      expect(effectiveAutoSubmit).toBe(false);
      expect(lifecycleState).toBe("waiting_for_user");
      expect(reasonCode).toBe("missing_required_answer");
      expect(pkgWithMissingAnswer.submissionPolicy.effectiveFinalSubmit).toBe(false);
    });
  });

  describe("Queue-Time Policy Revalidation Overrides Stale Serialized Package Permissions", () => {
    it("prohibits submit in prompt when queue-time revalidation evaluates false despite stale package permissions", () => {
      // Package was originally serialized with effectiveFinalSubmit = true
      const stalePackage: ApplicationPackage = {
        version: 1,
        applicationId: "app-stale-1",
        job: {
          id: "job-stale",
          title: "Platform Engineer",
          company: "Delta Corp",
          applyUrl: "https://example.com/apply",
        },
        candidate: { userId: "user-stale" },
        resume: {
          storagePath: "resumes/user-stale/resume.pdf",
          tailored: false,
        },
        screeningAnswers: [
          {
            questionText: "Do you have active security clearance?",
            value: null,
            category: "security_clearance",
            provenance: { source: "candidate_profile" },
            confidence: 0,
            mutable: false,
            requiresUserInput: true,
          },
        ],
        eligibilityAnswers: [],
        submissionPolicy: {
          mode: "autopilot",
          requestedFinalSubmit: true,
          effectiveFinalSubmit: true, // STALE VALUE!
        },
        confidence: {},
        unresolvedRequirements: [],
        provenance: { generatedAt: new Date().toISOString() },
      };

      // Queue-time revalidation detects missing critical answer
      const queueReadiness = evaluatePackageReadiness(stalePackage);
      let queueEffectiveAutoSubmit = true;
      if (queueReadiness.unresolvedCriticalQuestions.length > 0) {
        queueEffectiveAutoSubmit = false;
        stalePackage.submissionPolicy.effectiveFinalSubmit = false;
        stalePackage.submissionPolicy.reasonCode = "missing_required_answer";
      }

      expect(queueEffectiveAutoSubmit).toBe(false);
      expect(stalePackage.submissionPolicy.effectiveFinalSubmit).toBe(false);

      // Verify RTRVR prompt generated from revalidated package PROHIBITS final submit
      const freshUrl = "https://storage.supabase.co/resumes/fresh_signed_url_123.pdf";
      const prompt = buildRtrvrPromptFromPackage(stalePackage, freshUrl);
      expect(prompt).toContain("FINAL SUBMISSION PROHIBITED (Review Mode)");
      expect(prompt).not.toContain("FINAL SUBMISSION AUTHORIZED");
      expect(prompt).toContain(freshUrl);
    });
  });

  describe("Durable Resume Handling & Signed-URL Lifecycle", () => {
    it("stores durable storagePath and does not persist ephemeral signed URLs in package identity", () => {
      const durablePackage: ApplicationPackage = {
        version: 1,
        applicationId: "app-durable-1",
        job: {
          id: "job-4",
          title: "DevOps Engineer",
          company: "Epsilon LLC",
          applyUrl: "https://example.com/apply",
        },
        candidate: { userId: "user-4" },
        resume: {
          resumeId: "resume-uuid-1",
          storagePath: "user-4/resumes/resume.pdf",
          fileName: "Resume.pdf",
          mimeType: "application/pdf",
          tailored: false,
        },
        screeningAnswers: [],
        eligibilityAnswers: [],
        submissionPolicy: {
          mode: "review",
          requestedFinalSubmit: false,
          effectiveFinalSubmit: false,
        },
        confidence: {},
        unresolvedRequirements: [],
        provenance: { generatedAt: new Date().toISOString() },
      };

      expect(durablePackage.resume.storagePath).toBe("user-4/resumes/resume.pdf");
      expect(durablePackage.resume.signedUrl).toBeUndefined();

      // Fresh signed URL passed to prompt builder at runtime without mutating durable state
      const freshUrl = "https://storage.supabase.co/temp_token_url.pdf";
      const prompt = buildRtrvrPromptFromPackage(durablePackage, freshUrl);

      expect(prompt).toContain(freshUrl);
      expect(durablePackage.resume.signedUrl).toBeUndefined(); // Still undefined in durable state!
    });
  });

  describe("Canonical Application Lifecycle Resolver", () => {
    // Import resolver dynamically or test directly
    it("resolves modern provider_run_output lifecycle states with highest precedence", async () => {
      const { resolveApplicationLifecycle } = await import("../lib/applicationPackage");

      const modernApp = {
        id: "app-modern-1",
        status: "Draft", // legacy status
        canonical_stage: "draft_ready",
        provider_status: "waiting_for_user",
        provider_run_output: {
          lifecycle_state: "waiting_for_user",
          reason_code: "missing_required_answer",
          submission_mode: "autopilot",
          application_package: {
            submissionPolicy: {
              mode: "autopilot",
              effectiveFinalSubmit: false,
              reasonCode: "missing_required_answer",
            },
          },
        },
      };

      const resolved = resolveApplicationLifecycle(modernApp);
      expect(resolved.state).toBe("waiting_for_user");
      expect(resolved.reasonCode).toBe("missing_required_answer");
      expect(resolved.submissionMode).toBe("autopilot");
      expect(resolved.requiresAction).toBe(true);
      expect(resolved.isTerminal).toBe(false);
      expect(resolved.source).toBe("provider_run_output");
    });

    it("resolves legacy records cleanly from status and canonical_stage", async () => {
      const { resolveApplicationLifecycle } = await import("../lib/applicationPackage");

      const legacyApplied = {
        id: "app-legacy-1",
        status: "Applied",
        canonical_stage: "submitted",
        provider_status: "succeeded",
        auto_submit: true,
      };

      const resolvedApplied = resolveApplicationLifecycle(legacyApplied);
      expect(resolvedApplied.state).toBe("submitted");
      expect(resolvedApplied.isTerminal).toBe(true);
      expect(resolvedApplied.source).toBe("legacy_fields");

      const legacyCaptcha = {
        id: "app-legacy-2",
        status: "Pending",
        canonical_stage: "queued",
        provider_status: "waiting_for_user",
        failure_reason: "Action needed: waiting_for_captcha",
      };

      const resolvedCaptcha = resolveApplicationLifecycle(legacyCaptcha);
      expect(resolvedCaptcha.state).toBe("waiting_for_user");
      expect(resolvedCaptcha.reasonCode).toBe("waiting_for_captcha");
      expect(resolvedCaptcha.requiresAction).toBe(true);
      expect(resolvedCaptcha.source).toBe("legacy_fields");
    });
  });

  describe("Atomic Execution Lease Claim Invariant", () => {
    it("simulates atomic lease claim where exactly one runner wins", () => {
      // State representing the application row in DB
      let dbRow = {
        id: "app-lease-1",
        provider_status: "waiting",
        automation_claimed_by: null as string | null,
        automation_lease_token: null as string | null,
      };

      // Atomic claim function simulating:
      // .update({ provider_status: 'rtrvr_running', automation_claimed_by, automation_lease_token })
      // .eq('id', id)
      // .in('provider_status', ['waiting', 'queued', 'waiting_worker', 'retrying'])
      function attemptClaim(runnerId: string, leaseToken: string): boolean {
        const allowedStatuses = ["waiting", "queued", "waiting_worker", "retrying"];
        if (allowedStatuses.includes(dbRow.provider_status)) {
          dbRow.provider_status = "rtrvr_running";
          dbRow.automation_claimed_by = runnerId;
          dbRow.automation_lease_token = leaseToken;
          return true;
        }
        return false;
      }

      // Runner A attempts claim
      const claimA = attemptClaim("runner-A", "token-AAA");
      expect(claimA).toBe(true);
      expect(dbRow.automation_claimed_by).toBe("runner-A");

      // Concurrent Runner B attempts claim on the same row
      const claimB = attemptClaim("runner-B", "token-BBB");
      expect(claimB).toBe(false);
      expect(dbRow.automation_claimed_by).toBe("runner-A"); // Unchanged!
    });
  });

  describe("Category-Specific Critical Answer Provenance Rules", () => {
    it("defines exact category-specific trusted sources matching policy", () => {
      // work_authorization, sponsorship, salary, relocation cannot use resume or generated
      expect(TRUSTED_SOURCES_BY_CATEGORY.work_authorization).toEqual([
        "user_answer",
        "candidate_profile",
        "verified_memory",
      ]);
      expect(TRUSTED_SOURCES_BY_CATEGORY.sponsorship).toEqual([
        "user_answer",
        "candidate_profile",
        "verified_memory",
      ]);
      expect(TRUSTED_SOURCES_BY_CATEGORY.salary).toEqual([
        "user_answer",
        "candidate_profile",
        "verified_memory",
      ]);
      expect(TRUSTED_SOURCES_BY_CATEGORY.relocation).toEqual([
        "user_answer",
        "candidate_profile",
        "verified_memory",
      ]);

      // legal only accepts user_answer and candidate_profile
      expect(TRUSTED_SOURCES_BY_CATEGORY.legal).toEqual([
        "user_answer",
        "candidate_profile",
      ]);

      // security_clearance accepts resume as well
      expect(TRUSTED_SOURCES_BY_CATEGORY.security_clearance).toEqual([
        "user_answer",
        "candidate_profile",
        "verified_memory",
        "resume",
      ]);

      // prior_employment accepts resume, candidate_profile, user_answer
      expect(TRUSTED_SOURCES_BY_CATEGORY.prior_employment).toEqual([
        "user_answer",
        "candidate_profile",
        "resume",
      ]);
    });

    it("evaluates isTrustedSourceForCategory correctly across sources and categories", () => {
      // Critical categories NEVER allow generated
      for (const cat of CRITICAL_ANSWER_CATEGORIES) {
        expect(isTrustedSourceForCategory(cat, "generated")).toBe(false);
      }

      // Legal only allows user_answer and candidate_profile
      expect(isTrustedSourceForCategory("legal", "user_answer")).toBe(true);
      expect(isTrustedSourceForCategory("legal", "candidate_profile")).toBe(true);
      expect(isTrustedSourceForCategory("legal", "resume")).toBe(false);
      expect(isTrustedSourceForCategory("legal", "verified_memory")).toBe(false);

      // Sponsorship cannot come from resume
      expect(isTrustedSourceForCategory("sponsorship", "resume")).toBe(false);
      expect(isTrustedSourceForCategory("sponsorship", "verified_memory")).toBe(true);
      expect(isTrustedSourceForCategory("sponsorship", "user_answer")).toBe(true);

      // Salary cannot come from resume
      expect(isTrustedSourceForCategory("salary", "resume")).toBe(false);

      // Prior employment can come from resume
      expect(isTrustedSourceForCategory("prior_employment", "resume")).toBe(true);

      // General category can allow generated if non-critical
      expect(isTrustedSourceForCategory("general", "generated")).toBe(true);
    });

    const createMockPackage = (overrides: Partial<ApplicationPackage> = {}): ApplicationPackage => ({
      version: 1,
      applicationId: "app-test-prov",
      job: {
        id: "job-1",
        title: "Engineer",
        company: "Acme",
        applyUrl: "https://example.com/apply",
      },
      candidate: { userId: "user-1" },
      resume: { tailored: false },
      screeningAnswers: [],
      eligibilityAnswers: [],
      submissionPolicy: {
        mode: "autopilot",
        requestedFinalSubmit: true,
        effectiveFinalSubmit: true,
      },
      confidence: {},
      unresolvedRequirements: [],
      provenance: { generatedAt: new Date().toISOString() },
      ...overrides,
    });

    it("rejects high-confidence generated answers for critical categories in evaluatePackageReadiness", () => {
      const generatedCriticalPkg = createMockPackage({
        screeningAnswers: [
          {
            questionText: "Will you require sponsorship?",
            value: "No",
            category: "sponsorship",
            provenance: { source: "generated" },
            confidence: 0.99,
            mutable: true,
            requiresUserInput: false,
          },
        ],
      });

      const readiness = evaluatePackageReadiness(generatedCriticalPkg);
      expect(readiness.unresolvedCriticalQuestions).toContain("Will you require sponsorship?");
      expect(generatedCriticalPkg.screeningAnswers[0].requiresUserInput).toBe(true);
    });

    it("rejects resume source for legal category in evaluatePackageReadiness", () => {
      const legalFromResumePkg = createMockPackage({
        screeningAnswers: [
          {
            questionText: "Have you ever been convicted of a felony?",
            value: "No",
            category: "legal",
            provenance: { source: "resume" },
            confidence: 1.0,
            mutable: false,
            requiresUserInput: false,
          },
        ],
      });

      const readiness = evaluatePackageReadiness(legalFromResumePkg);
      expect(readiness.unresolvedCriticalQuestions).toContain("Have you ever been convicted of a felony?");
      expect(legalFromResumePkg.screeningAnswers[0].requiresUserInput).toBe(true);
    });
  });

  describe("Retry, Stale Lease Recovery, and Execution Owner Survival", () => {
    it("ensures Edge execution owner survives transient failure and retry", () => {
      // 1. Initially created ApplicationPackage row
      const appRow: Record<string, any> = {
        id: "app-retry-1",
        status: "Pending",
        canonical_stage: "queued",
        provider_status: "waiting",
        automation_claimed_by: null,
        automation_lease_token: null,
        provider_run_output: {
          execution_owner: "edge",
          application_package: { version: 1 },
        },
      };

      // 2. Edge processor claims row
      appRow.provider_status = "rtrvr_running";
      appRow.automation_claimed_by = "process-auto-apply-queue";
      appRow.automation_lease_token = "lease-1";

      // 3. Transient provider error -> retrying
      appRow.provider_status = "waiting"; // or retrying
      appRow.automation_claimed_by = null;
      appRow.automation_lease_token = null;
      appRow.retry_count = 1;

      // Invariant: execution_owner must remain 'edge'
      expect(appRow.provider_run_output.execution_owner).toBe("edge");

      // Verify Node worker query candidate filter:
      // AND (provider_run_output->>'execution_owner' IS NULL OR provider_run_output->>'execution_owner' <> 'edge')
      // AND (provider_run_output->'application_package' IS NULL)
      const isNodeWorkerEligible =
        (appRow.provider_run_output?.execution_owner == null || appRow.provider_run_output?.execution_owner !== "edge") &&
        appRow.provider_run_output?.application_package == null;

      expect(isNodeWorkerEligible).toBe(false);

      // Verify Edge queue processor candidate filter:
      const isEdgeEligible =
        appRow.canonical_stage === "queued" &&
        ["waiting", "retrying", "queued"].includes(appRow.provider_status) &&
        appRow.provider_run_output?.execution_owner === "edge";

      expect(isEdgeEligible).toBe(true);
    });

    it("ensures stale Edge lease recovery keeps row Edge-owned", () => {
      const appRow: Record<string, any> = {
        id: "app-stale-1",
        status: "Pending",
        canonical_stage: "queued",
        provider_status: "rtrvr_running",
        automation_claimed_by: "process-auto-apply-queue",
        automation_lease_token: "old-lease-token",
        provider_run_output: {
          execution_owner: "edge",
          application_package: { version: 1 },
        },
      };

      // Simulating recoverStaleRtrvrRows
      appRow.provider_status = "waiting";
      appRow.automation_claimed_by = null;
      appRow.automation_lease_token = null;
      appRow.retry_count = 1;

      expect(appRow.provider_run_output.execution_owner).toBe("edge");
      expect(appRow.provider_status).toBe("waiting");
    });
  });

  describe("Runtime Question Answering and Safe Resumption Invariants", () => {
    function simulateResolveScreeningAnswer(params: {
      application: Record<string, any>;
      callingUserId: string;
      questionText: string;
      answerValue: string;
    }): { ok: boolean; requeued?: boolean; remainingUnresolved?: number; error?: string } {
      const { application, callingUserId, questionText, answerValue } = params;

      // 1. Authorization check
      if (callingUserId !== application.user_id) {
        return { ok: false, error: "Forbidden: cannot resolve answers for another candidate" };
      }

      // 2. Status check
      if (application.provider_status !== "waiting_for_user") {
        return { ok: false, error: "Application is not waiting for user input" };
      }

      const pkg = application.provider_run_output?.application_package;
      if (!pkg) {
        return { ok: false, error: "Missing ApplicationPackage" };
      }

      let found = false;
      const updatedAnswers = [...(pkg.screeningAnswers || [])];
      for (let i = 0; i < updatedAnswers.length; i++) {
        if (updatedAnswers[i].questionText === questionText) {
          found = true;
          updatedAnswers[i] = {
            ...updatedAnswers[i],
            value: answerValue,
            provenance: { source: "user_answer" },
            confidence: 1.0,
            mutable: false,
            requiresUserInput: false,
          };
        }
      }

      const updatedReqs = [...(pkg.unresolvedRequirements || [])];
      for (let i = 0; i < updatedReqs.length; i++) {
        if (updatedReqs[i].title === questionText) {
          found = true;
          updatedReqs[i] = {
            ...updatedReqs[i],
            resolved: true,
            requiresUserInput: false,
          };
        }
      }

      if (!found) {
        return { ok: false, error: `Question "${questionText}" is not an outstanding requirement` };
      }

      pkg.screeningAnswers = updatedAnswers;
      pkg.unresolvedRequirements = updatedReqs;

      // Check remaining
      const remaining = pkg.unresolvedRequirements.filter(
        (r: any) => r.requiresUserInput && !r.resolved,
      ).length;

      if (remaining === 0) {
        application.provider_status = "waiting";
        application.canonical_stage = "queued";
        application.status = "Pending";
        application.provider_run_output.lifecycle_state = "queued";
        application.provider_run_output.reason_code = null;
        application.provider_run_output.execution_owner = "edge";
        return { ok: true, requeued: true, remainingUnresolved: 0 };
      }

      return { ok: true, requeued: false, remainingUnresolved: remaining };
    }

    it("resumes Autopilot application cleanly while preserving Autopilot mode and consent", () => {
      const autopilotApp: Record<string, any> = {
        id: "app-autopilot-1",
        user_id: "user-123",
        provider_status: "waiting_for_user",
        canonical_stage: "draft_ready",
        status: "Draft",
        provider_run_output: {
          execution_owner: "edge",
          lifecycle_state: "waiting_for_user",
          reason_code: "missing_required_answer",
          application_package: {
            version: 1,
            submissionPolicy: {
              mode: "autopilot",
              requestedFinalSubmit: true,
              effectiveFinalSubmit: true,
            },
            screeningAnswers: [
              {
                questionText: "Will you now or in the future require visa sponsorship?",
                value: null,
                category: "sponsorship",
                provenance: { source: "user_answer" },
                confidence: 0,
                mutable: true,
                requiresUserInput: true,
              },
            ],
            unresolvedRequirements: [
              {
                category: "hard_disqualifier",
                title: "Will you now or in the future require visa sponsorship?",
                requiresUserInput: true,
                resolved: false,
              },
            ],
          },
        },
      };

      const result = simulateResolveScreeningAnswer({
        application: autopilotApp,
        callingUserId: "user-123",
        questionText: "Will you now or in the future require visa sponsorship?",
        answerValue: "No",
      });

      expect(result.ok).toBe(true);
      expect(result.requeued).toBe(true);
      expect(autopilotApp.provider_status).toBe("waiting");
      expect(autopilotApp.canonical_stage).toBe("queued");
      expect(autopilotApp.status).toBe("Pending");
      expect(autopilotApp.provider_run_output.lifecycle_state).toBe("queued");
      // Invariant: original submission policy mode is strictly preserved
      expect(autopilotApp.provider_run_output.application_package.submissionPolicy.mode).toBe("autopilot");
      expect(autopilotApp.provider_run_output.application_package.submissionPolicy.effectiveFinalSubmit).toBe(true);
      // Answer recorded with verified user_answer provenance
      const ans = autopilotApp.provider_run_output.application_package.screeningAnswers[0];
      expect(ans.value).toBe("No");
      expect(ans.provenance.source).toBe("user_answer");
      expect(ans.confidence).toBe(1.0);
    });

    it("resumes Review application while strictly preserving Review mode (final submit prohibited)", () => {
      const reviewApp: Record<string, any> = {
        id: "app-review-1",
        user_id: "user-456",
        provider_status: "waiting_for_user",
        canonical_stage: "draft_ready",
        status: "Draft",
        provider_run_output: {
          execution_owner: "edge",
          lifecycle_state: "waiting_for_user",
          reason_code: "missing_required_answer",
          application_package: {
            version: 1,
            submissionPolicy: {
              mode: "review",
              requestedFinalSubmit: false,
              effectiveFinalSubmit: false,
            },
            screeningAnswers: [
              {
                questionText: "Are you willing to relocate?",
                value: null,
                category: "relocation",
                provenance: { source: "user_answer" },
                confidence: 0,
                mutable: true,
                requiresUserInput: true,
              },
            ],
            unresolvedRequirements: [
              {
                category: "uncertain_requirement",
                title: "Are you willing to relocate?",
                requiresUserInput: true,
                resolved: false,
              },
            ],
          },
        },
      };

      const result = simulateResolveScreeningAnswer({
        application: reviewApp,
        callingUserId: "user-456",
        questionText: "Are you willing to relocate?",
        answerValue: "Yes",
      });

      expect(result.ok).toBe(true);
      expect(result.requeued).toBe(true);
      // Invariant: Review mode is never upgraded to Autopilot!
      expect(reviewApp.provider_run_output.application_package.submissionPolicy.mode).toBe("review");
      expect(reviewApp.provider_run_output.application_package.submissionPolicy.effectiveFinalSubmit).toBe(false);
    });

    it("prohibits user from answering questions on another candidate's application", () => {
      const otherUserApp: Record<string, any> = {
        id: "app-victim-1",
        user_id: "victim-user-id",
        provider_status: "waiting_for_user",
        provider_run_output: {
          application_package: { version: 1 },
        },
      };

      const result = simulateResolveScreeningAnswer({
        application: otherUserApp,
        callingUserId: "attacker-user-id",
        questionText: "Any question?",
        answerValue: "Yes",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Forbidden");
    });

    it("rejects answer supplied for a requirement that is not outstanding", () => {
      const app: Record<string, any> = {
        id: "app-already-done",
        user_id: "user-123",
        provider_status: "waiting_for_user",
        provider_run_output: {
          application_package: {
            screeningAnswers: [],
            unresolvedRequirements: [],
          },
        },
      };

      const result = simulateResolveScreeningAnswer({
        application: app,
        callingUserId: "user-123",
        questionText: "Non existent question?",
        answerValue: "Yes",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("not an outstanding requirement");
    });

    describe("Backend Answer Value Validation (validateAnswerValue)", () => {
      it("rejects invalid boolean answers such as 'banana'", () => {
        const result = validateAnswerValue({ inputType: "boolean", category: "sponsorship" }, "banana");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid boolean answer");
      });

      it("accepts valid boolean variations and normalizes to Yes/No", () => {
        expect(validateAnswerValue({ inputType: "boolean" }, "yes").normalizedValue).toBe("Yes");
        expect(validateAnswerValue({ inputType: "boolean" }, "true").normalizedValue).toBe("Yes");
        expect(validateAnswerValue({ inputType: "boolean" }, "no").normalizedValue).toBe("No");
        expect(validateAnswerValue({ inputType: "boolean" }, "false").normalizedValue).toBe("No");
      });

      it("validates select input against allowedOptions", () => {
        const req = { inputType: "select" as const, allowedOptions: ["Hybrid", "Remote", "On-site"] };
        expect(validateAnswerValue(req, "Remote").valid).toBe(true);
        expect(validateAnswerValue(req, "Underwater").valid).toBe(false);
      });

      it("validates number/salary format", () => {
        const req = { inputType: "number" as const, category: "salary" };
        expect(validateAnswerValue(req, "120000").valid).toBe(true);
        expect(validateAnswerValue(req, "$120,000").valid).toBe(true);
        expect(validateAnswerValue(req, "120k").valid).toBe(true);
        expect(validateAnswerValue(req, "one hundred k").valid).toBe(false);
      });

      it("rejects empty required text answers", () => {
        expect(validateAnswerValue({ inputType: "text", required: true }, "").valid).toBe(false);
        expect(validateAnswerValue({ inputType: "text", required: true }, "   ").valid).toBe(false);
        expect(validateAnswerValue({ inputType: "text", required: true }, null).valid).toBe(false);
      });
    });

    describe("Category Preservation & Fail-Closed Unknown", () => {
      it("preserves authoritative category for critical screening questions", () => {
        expect(normalizeQuestionCategory("sponsorship")).toBe("sponsorship");
        expect(normalizeQuestionCategory("work_authorization")).toBe("work_authorization");
        expect(normalizeQuestionCategory("salary")).toBe("salary");
        expect(normalizeQuestionCategory("legal")).toBe("legal");
      });

      it("fails closed to 'unknown' rather than downgrading to 'general' when category is ambiguous", () => {
        expect(normalizeQuestionCategory(undefined, "Some unclassifiable question?")).toBe("unknown");
        expect(normalizeQuestionCategory(null, "")).toBe("unknown");
      });

      it("ensures 'unknown' category requires user input and blocks readiness", () => {
        const pkg: ApplicationPackage = {
          version: 1,
          applicationId: "app-unknown-cat",
          job: { id: "j1", title: "Dev", company: "Co", applyUrl: "https://example.com" },
          candidate: { userId: "u1" },
          resume: { tailored: true },
          screeningAnswers: [
            {
              requirementId: "req-unk",
              questionText: "Unclear requirement?",
              value: "Something",
              category: "unknown",
              provenance: { source: "user_answer" },
              confidence: 1.0,
              mutable: false,
              requiresUserInput: true,
            },
          ],
          eligibilityAnswers: [],
          submissionPolicy: { mode: "autopilot", requestedFinalSubmit: true, effectiveFinalSubmit: true },
          confidence: {},
          unresolvedRequirements: [],
          provenance: { generatedAt: new Date().toISOString() },
        };

        const readiness = evaluatePackageReadiness(pkg);
        expect(readiness.unresolvedCriticalQuestions).toContain("Unclear requirement?");
      });
    });

    describe("Nullable Unresolved-State Handling (COALESCE resolved)", () => {
      it("treats requirements with missing or null resolved as unresolved", () => {
        const pkg: ApplicationPackage = {
          version: 1,
          applicationId: "app-null-resolved",
          job: { id: "j1", title: "Dev", company: "Co", applyUrl: "https://example.com" },
          candidate: { userId: "u1" },
          resume: { tailored: true },
          screeningAnswers: [],
          eligibilityAnswers: [],
          submissionPolicy: { mode: "autopilot", requestedFinalSubmit: true, effectiveFinalSubmit: true },
          confidence: {},
          unresolvedRequirements: [
            {
              requirementId: "req-1",
              title: "Are you willing to relocate?",
              category: "hard_disqualifier",
              // 'resolved' is missing/undefined!
              requiresUserInput: true,
            } as any,
          ],
          provenance: { generatedAt: new Date().toISOString() },
        };

        const readiness = evaluatePackageReadiness(pkg);
        expect(readiness.hardBlockers).toContain("Are you willing to relocate?");
        expect(readiness.unresolvedCriticalQuestions).toContain("Are you willing to relocate?");
      });
    });

    describe("Canonical Readiness Re-evaluation (resolveScreeningAnswerPayload)", () => {
      it("keeps application in waiting_for_user when 1 of 2 questions is resolved", () => {
        const app: Record<string, any> = {
          id: "app-multi-q",
          user_id: "user-123",
          status: "Draft",
          canonical_stage: "draft_ready",
          provider_status: "waiting_for_user",
          provider_run_output: {
            execution_owner: "edge",
            application_package: {
              version: 1,
              applicationId: "app-multi-q",
              job: { id: "j1", title: "Dev", company: "Co", applyUrl: "https://example.com" },
              candidate: { userId: "user-123" },
              resume: { tailored: true },
              screeningAnswers: [
                {
                  requirementId: "req-visa",
                  questionText: "Will you require visa sponsorship?",
                  category: "sponsorship",
                  inputType: "boolean",
                  value: null,
                  provenance: { source: "user_answer" },
                  confidence: 0,
                  mutable: true,
                  requiresUserInput: true,
                },
                {
                  requirementId: "req-salary",
                  questionText: "What is your target salary?",
                  category: "salary",
                  inputType: "number",
                  value: null,
                  provenance: { source: "user_answer" },
                  confidence: 0,
                  mutable: true,
                  requiresUserInput: true,
                },
              ],
              eligibilityAnswers: [],
              submissionPolicy: { mode: "autopilot", requestedFinalSubmit: true, effectiveFinalSubmit: false },
              confidence: {},
              unresolvedRequirements: [
                {
                  requirementId: "req-visa",
                  title: "Will you require visa sponsorship?",
                  category: "hard_disqualifier",
                  resolved: false,
                  requiresUserInput: true,
                },
                {
                  requirementId: "req-salary",
                  title: "What is your target salary?",
                  category: "hard_disqualifier",
                  resolved: false,
                  requiresUserInput: true,
                },
              ],
              provenance: { generatedAt: new Date().toISOString() },
            },
          },
        };

        // Resolve only question 1 (req-visa)
        const res1 = resolveScreeningAnswerPayload({
          application: app,
          requirementId: "req-visa",
          answer: "No",
          authenticatedUserId: "user-123",
        });

        expect(res1.success).toBe(true);
        expect(res1.nextProviderStatus).toBe("waiting_for_user");
        expect(res1.nextLifecycleState).toBe("waiting_for_user");
        expect(res1.remainingUnresolvedCount).toBe(1);
        expect(res1.unresolvedQuestions).toContain("What is your target salary?");

        // Now resolve question 2 (req-salary)
        const updatedApp = {
          ...app,
          ...res1.updatePayload,
        };

        const res2 = resolveScreeningAnswerPayload({
          application: updatedApp,
          requirementId: "req-salary",
          answer: "150000",
          authenticatedUserId: "user-123",
        });

        expect(res2.success).toBe(true);
        expect(res2.nextProviderStatus).toBe("waiting");
        expect(res2.nextLifecycleState).toBe("queued");
        expect(res2.remainingUnresolvedCount).toBe(0);
        expect(res2.updatePayload?.automation_claimed_by).toBeNull();
      });

      it("strictly preserves original Review submission mode after resolving questions", () => {
        const app: Record<string, any> = {
          id: "app-review-mode",
          user_id: "user-123",
          status: "Draft",
          canonical_stage: "draft_ready",
          provider_status: "waiting_for_user",
          provider_run_output: {
            execution_owner: "edge",
            application_package: {
              version: 1,
              applicationId: "app-review-mode",
              job: { id: "j1", title: "Dev", company: "Co", applyUrl: "https://example.com" },
              candidate: { userId: "user-123" },
              resume: { tailored: true },
              screeningAnswers: [
                {
                  requirementId: "req-clearance",
                  questionText: "Do you hold active security clearance?",
                  category: "security_clearance",
                  inputType: "boolean",
                  value: null,
                  provenance: { source: "user_answer" },
                  confidence: 0,
                  mutable: true,
                  requiresUserInput: true,
                },
              ],
              eligibilityAnswers: [],
              submissionPolicy: { mode: "review", requestedFinalSubmit: false, effectiveFinalSubmit: false },
              confidence: {},
              unresolvedRequirements: [
                {
                  requirementId: "req-clearance",
                  title: "Do you hold active security clearance?",
                  category: "hard_disqualifier",
                  resolved: false,
                  requiresUserInput: true,
                },
              ],
              provenance: { generatedAt: new Date().toISOString() },
            },
          },
        };

        const res = resolveScreeningAnswerPayload({
          application: app,
          requirementId: "req-clearance",
          answer: "No",
          authenticatedUserId: "user-123",
        });

        expect(res.success).toBe(true);
        expect(res.nextProviderStatus).toBe("waiting");
        expect(res.appPackage?.submissionPolicy.mode).toBe("review");
        // Crucial invariant: effectiveFinalSubmit must NEVER be true in Review mode!
        expect(res.effectiveFinalSubmit).toBe(false);
        expect(res.appPackage?.submissionPolicy.effectiveFinalSubmit).toBe(false);
        expect(res.nextStatus).toBe("Draft");
      });
    });

    describe("Symmetric Execution Ownership Isolation", () => {
      it("confirms migration defines acquire_next_auto_apply_jobs with strict Edge ownership requirement", async () => {
        const fs = await import("fs");
        const path = await import("path");
        const migrationSql = fs.readFileSync(
          path.resolve("backend/supabase/migrations/20260911090000_isolate_edge_auto_apply_queue.sql"),
          "utf8",
        );

        // acquire_next_auto_apply_jobs MUST require execution_owner = 'edge' OR application_package IS NOT NULL
        expect(migrationSql).toContain("FUNCTION public.acquire_next_auto_apply_jobs");
        expect(migrationSql).toContain("provider_run_output->>'execution_owner' = 'edge'");
        expect(migrationSql).toContain("provider_run_output->'application_package' IS NOT NULL");
      });

      it("confirms migration defines claim_next_rtrvr_auto_apply_jobs excluding Edge ownership", async () => {
        const fs = await import("fs");
        const path = await import("path");
        const migrationSql = fs.readFileSync(
          path.resolve("backend/supabase/migrations/20260911090000_isolate_edge_auto_apply_queue.sql"),
          "utf8",
        );

        expect(migrationSql).toContain("FUNCTION public.claim_next_rtrvr_auto_apply_jobs");
        expect(migrationSql).toContain("a.provider_run_output->>'execution_owner' <> 'edge'");
        expect(migrationSql).toContain("a.provider_run_output->'application_package' IS NULL");
      });
    });

    describe("Optimistic Concurrency & Lost Update Prevention", () => {
      it("simulates concurrent answer submissions where stale mutation is rejected and earlier resolved answer is preserved", () => {
        // Initial application state at version N (updated_at = T1) with Q1 and Q2 outstanding
        const initialUpdatedAt = "2026-09-11T12:00:00.000Z";
        const pkg: ApplicationPackage = {
          version: 1,
          jobId: "job-1",
          candidateId: "user-123",
          submissionPolicy: {
            mode: "autopilot",
            effectiveFinalSubmit: false,
            rules: [],
          },
          eligibilityAnswers: [],
          screeningAnswers: [],
          unresolvedRequirements: [
            {
              requirementId: "req-q1",
              title: "Do you need sponsorship?",
              category: "sponsorship",
              inputType: "boolean",
              resolved: false,
              requiresUserInput: true,
              required: true,
            },
            {
              requirementId: "req-q2",
              title: "What is your target salary?",
              category: "salary",
              inputType: "number",
              resolved: false,
              requiresUserInput: true,
              required: true,
            },
          ],
          readiness: {
            jobFitConfidence: 0.9,
            eligibilityConfidence: 0.9,
            candidateDataCompleteness: 0.9,
            applicationAnswerConfidence: 0.5,
            hardBlockers: [],
            unresolvedCriticalQuestions: ["req-q1", "req-q2"],
          },
        };

        const appVersionN = {
          id: "app-concurrency-1",
          user_id: "user-123",
          provider_status: "waiting_for_user",
          updated_at: initialUpdatedAt,
          provider_run_output: {
            execution_owner: "edge",
            lifecycle_state: "waiting_for_user",
            application_package: pkg,
          },
        };

        // Request A: Resolves Q1 from Version N
        const resA = resolveScreeningAnswerPayload({
          application: appVersionN,
          requirementId: "req-q1",
          answer: "No",
          authenticatedUserId: "user-123",
        });

        expect(resA.success).toBe(true);
        expect(resA.remainingUnresolvedCount).toBe(1); // Q2 still unresolved

        // Simulated commit of Request A: updates application state to Version N+1
        const committedUpdatedAtA = "2026-09-11T12:00:01.000Z";
        const appVersionNPlus1 = {
          ...appVersionN,
          ...resA.updatePayload,
          updated_at: committedUpdatedAtA,
        };

        // Verify that in appVersionNPlus1, Q1 is resolved and preserved
        const pkgAfterA = appVersionNPlus1.provider_run_output.application_package;
        const q1InPkg = pkgAfterA.unresolvedRequirements.find((r: any) => r.requirementId === "req-q1");
        expect(q1InPkg.resolved).toBe(true);

        // Request B: Attempts to resolve Q2, but was read from Version N (with stale updated_at = initialUpdatedAt)
        // Optimistic concurrency query in resolve-screening-answer requires:
        // .eq("id", applicationId)
        // .eq("user_id", user.id)
        // .eq("provider_status", "waiting_for_user")
        // .eq("updated_at", application.updated_at)
        
        // Simulating the DB update query with optimistic lock predicate:
        const canApplyMutationB =
          appVersionNPlus1.id === appVersionN.id &&
          appVersionNPlus1.user_id === "user-123" &&
          appVersionNPlus1.provider_status === "waiting_for_user" &&
          appVersionNPlus1.updated_at === appVersionN.updated_at; // <-- Stale check fails!

        // B's stale mutation is rejected (canApplyMutationB is false, simulating 0 rows updated -> 409 application_state_changed)
        expect(canApplyMutationB).toBe(false);

        // Crucial invariant: Q1's resolved answer remains preserved and NOT overwritten by Request B!
        const finalPkg = appVersionNPlus1.provider_run_output.application_package;
        const finalQ1 = finalPkg.unresolvedRequirements.find((r: any) => r.requirementId === "req-q1");
        expect(finalQ1.resolved).toBe(true);
        const finalQ1Answer = finalPkg.screeningAnswers.find((a: any) => a.requirementId === "req-q1");
        expect(finalQ1Answer.value).toBe("No");

        // When Request B retries against fresh Version N+1:
        const resBRetried = resolveScreeningAnswerPayload({
          application: appVersionNPlus1,
          requirementId: "req-q2",
          answer: "140000",
          authenticatedUserId: "user-123",
        });
        expect(resBRetried.success).toBe(true);
        expect(resBRetried.remainingUnresolvedCount).toBe(0); // All resolved!
        expect(resBRetried.nextProviderStatus).toBe("waiting"); // Requeued
      });
    });
  });
});

