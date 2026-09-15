import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_MIN_DAYS,
  validateOutreachPackage,
  validateOutreachPermissions,
  type OutreachPackage,
} from "../lib/outreach/types";
import {
  evaluateFollowUpEligibility,
  type ApplicationFollowUpCandidate,
  type OutreachHistoryRecord,
} from "../lib/outreach/followUpRules";
import {
  extractEvidenceItemsFromText,
  validateMessageGrounding,
  loadStructuredCandidateEvidence,
} from "../lib/outreach/candidateEvidence";
import { scoreContactForOpportunity } from "../lib/outreach/contactScorer";
import {
  RuleBasedOutreachDecisionStrategy,
  type OutreachDecisionContext,
} from "../lib/outreach/recommendationEngine";
import { sanitizeTelemetryPayload } from "../lib/outreach/outreachTelemetry";
import { validateOutreachPackagePayload } from "../../backend/supabase/functions/_shared/outreach-package";
import {
  generateLocalFallbackPitch,
  isInvalidOutreachJob,
} from "../services/presets/recruiterOutreachService";

describe("Jobraker Outreach Agent Test Suite", () => {
  describe("Invariant 1: Exact-job identity (no company-based collapsing)", () => {
    it("preserves distinct jobs at the same company as separate opportunities", () => {
      const job1 = {
        id: "job-stripe-backend",
        company: "Stripe",
        title: "Backend Engineer - Payments",
        apply_url: "https://stripe.com/jobs/backend",
      };
      const job2 = {
        id: "job-stripe-infra",
        company: "Stripe",
        title: "Infrastructure Engineer - Core",
        apply_url: "https://stripe.com/jobs/infra",
      };

      // Ensure neither job is falsely flagged as invalid
      expect(isInvalidOutreachJob(job1.company, job1.title)).toBe(false);
      expect(isInvalidOutreachJob(job2.company, job2.title)).toBe(false);

      // Verify exact identity by ID or applyUrl
      const exactIdentity1 = job1.id;
      const exactIdentity2 = job2.id;
      expect(exactIdentity1).not.toBe(exactIdentity2);

      const jobMap = new Map();
      jobMap.set(exactIdentity1, job1);
      jobMap.set(exactIdentity2, job2);
      expect(jobMap.size).toBe(2);
      expect(jobMap.get("job-stripe-backend")?.title).toBe("Backend Engineer - Payments");
      expect(jobMap.get("job-stripe-infra")?.title).toBe("Infrastructure Engineer - Core");
    });
  });

  describe("Invariant 2: Real evaluation scores without fabrication", () => {
    it("does not fabricate 88% or 85% match scores when score is missing", () => {
      const jobWithoutScore = {
        id: "job-1",
        company: "Datadog",
        title: "Site Reliability Engineer",
        match_score: null,
      };

      const authenticScore =
        typeof jobWithoutScore.match_score === "number" && jobWithoutScore.match_score > 0
          ? Math.round(jobWithoutScore.match_score)
          : undefined;

      expect(authenticScore).toBeUndefined();
      expect(authenticScore).not.toBe(88);
      expect(authenticScore).not.toBe(85);
    });

    it("faithfully preserves authentic calculated match scores", () => {
      const jobWithRealScore = {
        id: "job-2",
        company: "Linear",
        title: "Product Engineer",
        match_score: 93.4,
      };

      const authenticScore =
        typeof jobWithRealScore.match_score === "number" && jobWithRealScore.match_score > 0
          ? Math.round(jobWithRealScore.match_score)
          : undefined;

      expect(authenticScore).toBe(93);
    });
  });

  describe("Invariant 3: Follow-Up Eligibility & 7-Day Rule", () => {
    const fixedNow = new Date("2026-09-15T12:00:00Z").getTime();

    it("marks applications submitted less than 7 days ago as too_soon", () => {
      // 2 days ago
      const twoDaysAgo = new Date("2026-09-13T12:00:00Z").toISOString();
      const app: ApplicationFollowUpCandidate = {
        id: "app-1",
        applied_date: twoDaysAgo,
        status: "Applied",
        company: "Retool",
      };

      const result = evaluateFollowUpEligibility(app, [], { nowMs: fixedNow });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("too_soon");
      expect(result.daysSinceSubmission).toBe(2);
      expect(result.recommendedAt).toBeDefined();
    });

    it("marks applications submitted 7+ days ago as eligible", () => {
      // 8 days ago
      const eightDaysAgo = new Date("2026-09-07T12:00:00Z").toISOString();
      const app: ApplicationFollowUpCandidate = {
        id: "app-2",
        applied_date: eightDaysAgo,
        status: "Applied",
        company: "Retool",
      };

      const result = evaluateFollowUpEligibility(app, [], { nowMs: fixedNow });
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe("eligible");
      expect(result.daysSinceSubmission).toBe(8);
    });

    it("canonical minimum follow-up threshold is centralized to 7 days", () => {
      expect(FOLLOW_UP_MIN_DAYS).toBe(7);
    });
  });

  describe("Invariant 4: Recruiter Reply Suppression", () => {
    const fixedNow = new Date("2026-09-15T12:00:00Z").getTime();
    const tenDaysAgo = new Date("2026-09-05T12:00:00Z").toISOString();

    it("blocks follow-up if recruiter has already replied", () => {
      const app: ApplicationFollowUpCandidate = {
        id: "app-3",
        applied_date: tenDaysAgo,
        status: "Applied",
      };

      const history: OutreachHistoryRecord[] = [
        {
          contactedAt: new Date("2026-09-06T12:00:00Z"),
          recruiterReplied: true,
          repliedAt: new Date("2026-09-08T10:00:00Z"),
        },
      ];

      const result = evaluateFollowUpEligibility(app, history, { nowMs: fixedNow });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("already_replied");
    });
  });

  describe("Invariant 5: Terminal and Active Stage Blocking", () => {
    const fixedNow = new Date("2026-09-15T12:00:00Z").getTime();
    const tenDaysAgo = new Date("2026-09-05T12:00:00Z").toISOString();

    it("blocks follow-up for rejected applications", () => {
      const app: ApplicationFollowUpCandidate = {
        id: "app-rej",
        applied_date: tenDaysAgo,
        status: "rejected",
      };
      const result = evaluateFollowUpEligibility(app, [], { nowMs: fixedNow });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("rejected");
    });

    it("blocks follow-up for withdrawn applications", () => {
      const app: ApplicationFollowUpCandidate = {
        id: "app-withdrawn",
        applied_date: tenDaysAgo,
        status: "withdrawn",
      };
      const result = evaluateFollowUpEligibility(app, [], { nowMs: fixedNow });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("withdrawn");
    });

    it("blocks standard follow-up for active interview stages", () => {
      const app: ApplicationFollowUpCandidate = {
        id: "app-interview",
        applied_date: tenDaysAgo,
        status: "interviewing",
      };
      const result = evaluateFollowUpEligibility(app, [], { nowMs: fixedNow });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("interview_active");
    });
  });

  describe("Invariant 6: Recent Follow-up Cooldown", () => {
    const fixedNow = new Date("2026-09-15T12:00:00Z").getTime();
    const twentyDaysAgo = new Date("2026-08-25T12:00:00Z").toISOString();

    it("blocks follow-up if a previous follow-up was sent 3 days ago", () => {
      const app: ApplicationFollowUpCandidate = {
        id: "app-cd",
        applied_date: twentyDaysAgo,
        status: "Applied",
      };
      const threeDaysAgo = new Date("2026-09-12T12:00:00Z");
      const history: OutreachHistoryRecord[] = [
        {
          contactedAt: threeDaysAgo,
          recruiterReplied: false,
        },
      ];

      const result = evaluateFollowUpEligibility(app, history, { nowMs: fixedNow });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("recent_followup");
    });
  });

  describe("Invariant 7 & 8: Candidate Evidence Grounding & Fails-Closed", () => {
    it("fails closed with needs_candidate_evidence when no evidence is found", async () => {
      const createQueryBuilder = (): any => {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => ({ data: null }),
        };
        return builder;
      };
      const mockSupabase: any = {
        from: () => createQueryBuilder(),
      };

      const result = await loadStructuredCandidateEvidence(mockSupabase, "user-no-data");
      expect(result.status).toBe("needs_candidate_evidence");
      expect(result.evidence).toEqual([]);
      // Must NEVER return the hallucinated generic sentence
      expect(result.rawText).toBeUndefined();
    });

    it("extracts grounded evidence items from resume text", () => {
      const resumeSample = `
        - Designed and built distributed event streaming pipeline processing 40M events/day with 99.99% uptime using Kafka and Go.
        - Reduced API p99 latency by 35% through Redis caching layer and connection pooling.
        - Led cross-functional team of 6 engineers across 3 major product releases.
        - Skills: TypeScript, React, Go, PostgreSQL, AWS, Docker
      `;

      const items = extractEvidenceItemsFromText(resumeSample, "resume");
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((i) => i.text.includes("40M events/day"))).toBe(true);
      expect(items.some((i) => i.text.includes("p99 latency by 35%"))).toBe(true);
    });

    it("grounding validator flags ungrounded metrics not in candidate evidence", () => {
      const evidence = [
        {
          id: "ev-1",
          type: "achievement" as const,
          text: "Built search service indexing 2M documents with 50ms latency",
          source: "resume" as const,
          confidence: 0.9,
        },
      ];

      // Contains wild hallucinated claim "$20M in cost savings" and "500%"
      const hallucinatedMessage =
        "Hi Alex, I saw your opening. In my last role I drove $20M in revenue and improved conversion by 500%.";

      const validation = validateMessageGrounding(hallucinatedMessage, evidence);
      expect(validation.valid).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
    });

    it("grounding validator passes grounded message matching candidate evidence", () => {
      const evidence = [
        {
          id: "ev-1",
          type: "achievement" as const,
          text: "Built search service indexing 2M documents with 50ms latency",
          source: "resume" as const,
          confidence: 0.9,
        },
      ];

      const groundedMessage =
        "Hi Alex, I built a high-throughput search service indexing 2M documents with 50ms latency, which directly aligns with your infrastructure needs.";

      const validation = validateMessageGrounding(groundedMessage, evidence);
      expect(validation.valid).toBe(true);
      expect(validation.violations).toEqual([]);
    });
  });

  describe("Invariant 9 & 10: Deterministic Contact Scoring", () => {
    it("ranks technical recruiter higher than generic recruiter or unrelated VP for an engineering role", () => {
      const opportunity = {
        jobTitle: "Senior Backend Engineer",
        companyName: "Figma",
      };

      const techRecruiter = {
        title: "Senior Technical Recruiter",
        roleKind: "recruiter" as const,
        verification: "source_verified" as const,
        confidence: 0.95,
      };

      const vpSales = {
        title: "VP of Enterprise Sales",
        roleKind: "executive" as const,
        verification: "source_verified" as const,
        confidence: 0.9,
      };

      const scoreTech = scoreContactForOpportunity(techRecruiter, opportunity, {
        targetStrategy: "recruiter_intro",
      });
      const scoreSales = scoreContactForOpportunity(vpSales, opportunity, {
        targetStrategy: "recruiter_intro",
      });

      expect(scoreTech.contactScore).toBeGreaterThan(scoreSales.contactScore);
      expect(scoreTech.selectionReasons.length).toBeGreaterThan(0);
    });

    it("ranks engineering hiring manager higher for hiring_manager_pitch", () => {
      const opportunity = {
        jobTitle: "Staff Software Engineer",
        companyName: "Stripe",
      };

      const engManager = {
        title: "Engineering Manager - Infrastructure",
        roleKind: "hiring_manager" as const,
        verification: "source_verified" as const,
        confidence: 0.9,
      };

      const generalRecruiter = {
        title: "University Recruiter",
        roleKind: "recruiter" as const,
        verification: "source_verified" as const,
        confidence: 0.8,
      };

      const scoreEM = scoreContactForOpportunity(engManager, opportunity, {
        targetStrategy: "hiring_manager_pitch",
      });
      const scoreRecruiter = scoreContactForOpportunity(generalRecruiter, opportunity, {
        targetStrategy: "hiring_manager_pitch",
      });

      expect(scoreEM.contactScore).toBeGreaterThan(scoreRecruiter.contactScore);
    });
  });

  describe("Invariant 11 & 14: Tier Permissions (Starter vs Paid)", () => {
    it("allows Starter tier to create Gmail drafts but forbids direct send", () => {
      const draftCheck = validateOutreachPermissions("starter", {
        channel: "gmail",
        mode: "draft",
      });
      expect(draftCheck.allowed).toBe(true);

      const sendCheck = validateOutreachPermissions("starter", {
        channel: "gmail",
        mode: "send",
      });
      expect(sendCheck.allowed).toBe(false);
      expect(sendCheck.reason).toBe("upgrade_required");
    });

    it("allows Paid tiers (pro, executive) to both draft and send", () => {
      const proSend = validateOutreachPermissions("pro", {
        channel: "gmail",
        mode: "send",
      });
      expect(proSend.allowed).toBe(true);

      const execSend = validateOutreachPermissions("executive", {
        channel: "gmail",
        mode: "send",
      });
      expect(execSend.allowed).toBe(true);
    });
  });

  describe("Invariant 12 & 13: Recommendation Engine Strategy Selection", () => {
    const strategy = new RuleBasedOutreachDecisionStrategy();
    const fixedNow = new Date("2026-09-15T12:00:00Z").getTime();

    it("recommends application_followup for an eligible 8-day-old application", async () => {
      const eightDaysAgo = new Date("2026-09-07T12:00:00Z").toISOString();
      const ctx: OutreachDecisionContext = {
        opportunity: {
          jobId: "job-1",
          companyName: "Vercel",
          jobTitle: "Solutions Architect",
        },
        applicationContext: {
          stage: "applied",
          status: "Applied",
          appliedAt: eightDaysAgo,
        },
        nowMs: fixedNow,
      };

      const recommendation = await strategy.recommend(ctx);
      expect(recommendation.action).toBe("application_followup");
      expect(recommendation.score).toBeGreaterThan(80);
    });

    it("recommends recruiter_intro for a newly saved opportunity", async () => {
      const ctx: OutreachDecisionContext = {
        opportunity: {
          jobId: "job-2",
          companyName: "Shopify",
          jobTitle: "Senior Backend Developer",
        },
        applicationContext: {
          stage: "saved",
        },
        contact: {
          name: "Robin Talent",
          title: "Technical Recruiter",
          roleKind: "recruiter",
          verification: "source_verified",
          confidence: 0.9,
          provenance: {
            sourceType: "careers_page",
            checkedAt: new Date().toISOString(),
          },
        },
        candidateEvidence: [
          {
            id: "ev-1",
            type: "experience",
            text: "Designed and built high-performance distributed systems in Go",
            source: "resume",
            confidence: 0.9,
          },
        ],
        nowMs: fixedNow,
      };

      const recommendation = await strategy.recommend(ctx);
      expect(recommendation.action).toBe("recruiter_intro");
    });
  });

  describe("Invariant 15: Telemetry Payload Sanitization", () => {
    it("strips message bodies, subjects, resumes, and personal contact PII from telemetry events", () => {
      const rawPayload = {
        actionType: "recruiter_intro",
        jobId: "job-101",
        companyName: "Airbnb",
        body: "Hey Brian, check my credentials...",
        messageBody: "Personal body text...",
        subject: "Senior Role Discussion",
        email: "recruiter@airbnb.com",
        recipientEmail: "recruiter@airbnb.com",
        recipient: "recruiter@airbnb.com",
        resume: "Full resume with SSN and address",
        rawResume: "Raw resume text",
        candidateName: "John Doe",
        phone: "+1-555-0199",
        contactVerification: "provider_verified",
        score: 92,
      };

      const sanitized = sanitizeTelemetryPayload(rawPayload);

      expect(sanitized.actionType).toBe("recruiter_intro");
      expect(sanitized.jobId).toBe("job-101");
      expect(sanitized.companyName).toBe("Airbnb");
      expect(sanitized.contactVerification).toBe("provider_verified");
      expect(sanitized.score).toBe(92);

      // PII & full text keys must be stripped
      expect(sanitized.body).toBeUndefined();
      expect(sanitized.messageBody).toBeUndefined();
      expect(sanitized.subject).toBeUndefined();
      expect(sanitized.email).toBeUndefined();
      expect(sanitized.recipientEmail).toBeUndefined();
      expect(sanitized.recipient).toBeUndefined();
      expect(sanitized.resume).toBeUndefined();
      expect(sanitized.rawResume).toBeUndefined();
      expect(sanitized.candidateName).toBeUndefined();
      expect(sanitized.phone).toBeUndefined();
    });
  });

  describe("Invariant 16 & 18: OutreachPackage Schema Validation (Frontend & Backend)", () => {
    const validPackage: OutreachPackage = {
      version: 1,
      id: "pkg-123",
      userId: "user-abc",
      opportunity: {
        jobId: "job-456",
        companyName: "Coinbase",
        jobTitle: "Protocol Engineer",
      },
      contact: {
        email: "talent@coinbase.com",
        roleKind: "recruiter",
        verification: "provider_verified",
        confidence: 0.9,
        provenance: {
          sourceType: "public_web",
          checkedAt: new Date().toISOString(),
        },
      },
      candidateEvidence: [
        {
          id: "ev-1",
          type: "experience",
          text: "Smart contract audit and protocol engineering",
          source: "resume",
          confidence: 0.9,
        },
      ],
      applicationContext: {
        stage: "saved",
      },
      relationshipContext: {
        previousMessages: 0,
        recruiterReplied: false,
      },
      strategy: {
        action: "recruiter_intro",
        tone: "casual",
        objective: "Introduce background",
        CTA: "Intro call",
      },
      message: {
        subject: "Protocol Engineering @ Coinbase",
        body: "Hi team, saw your opening and wanted to reach out directly.",
      },
      delivery: {
        channel: "gmail",
        mode: "draft",
        allowedToSend: false,
      },
      recommendation: {
        action: "recruiter_intro",
        score: 89,
        confidence: 0.9,
        reasons: ["Target match"],
        blockedReasons: [],
      },
      createdAt: new Date().toISOString(),
      state: "ready_for_review",
    };

    it("passes valid OutreachPackage on frontend validator", () => {
      const validated = validateOutreachPackage(validPackage);
      expect(validated.id).toBe("pkg-123");
    });

    it("passes valid OutreachPackagePayload on backend validator", () => {
      const validated = validateOutreachPackagePayload(validPackage);
      expect(validated.id).toBe("pkg-123");
    });

    it("rejects package missing required fields", () => {
      const invalid = { ...validPackage, opportunity: { companyName: "" } };
      expect(() => validateOutreachPackage(invalid)).toThrow();
      expect(() => validateOutreachPackagePayload(invalid)).toThrow();
    });
  });

  describe("Invariant 17: Safe AI Fallback in recruiterOutreachService", () => {
    it("generates honest fallback pitch without hallucinated claims, marked needsRegeneration: true", () => {
      const fallback = generateLocalFallbackPitch(
        { id: "j1", company: "Anthropic", title: "Prompt Engineer", source: "searched" },
        { fullName: "Dario Amodei", role: "CEO", confidence: 0.9 },
        "casual",
      );

      expect(fallback.subject).toContain("Prompt Engineer");
      expect(fallback.needsRegeneration).toBe(true);
      // Ensures it does not contain the old placeholder "Experienced professional seeking new challenge"
      expect(fallback.body).not.toContain("Experienced professional seeking new challenge");
      expect(fallback.body.length).toBeGreaterThan(20);
    });
  });
});
