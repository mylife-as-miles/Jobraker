import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scoreCandidateFit } from "../candidateFitEngine";
import { detectJobDuplicates } from "../jobDedupeEngine";
import { scoreLeadQuality } from "../leadQualityEngine";
import { scoreExplainableOpportunity } from "../opportunityScoreEngine";
import type { CandidateProfileInput, JobIntelligenceJobInput } from "../types";

const baseJob: JobIntelligenceJobInput = {
  id: "job-1",
  title: "Frontend Engineer",
  company: "Acme AI",
  description:
    "We are hiring a Frontend Engineer to build React and TypeScript interfaces. Requirements include experience with React, TypeScript, REST APIs, and product-minded collaboration. Nice to have Supabase experience.",
  location: "Remote",
  remote_type: "remote",
  apply_url: "https://boards.greenhouse.io/acme/jobs/123",
  posted_at: "2026-05-20T12:00:00Z",
  discovered_at: "2026-05-21T12:00:00Z",
  salary_min: 120000,
  salary_max: 150000,
  salary_currency: "USD",
  source_type: "ats",
  source_kind: "greenhouse",
  source_confidence: 0.95,
};

const baseProfile: CandidateProfileInput = {
  targetTitle: "Frontend Engineer",
  searchQuery: "frontend engineer",
  location: "Lagos",
  locationScope: "global",
  experienceYears: 4,
  goals: ["AI", "remote"],
  skills: [
    { name: "React", level: "Expert", category: "Frontend" },
    { name: "TypeScript", level: "Advanced", category: "Frontend" },
    { name: "REST", level: "Advanced", category: "API" },
    { name: "Supabase", level: "Intermediate", category: "Backend" },
  ],
  experiences: [
    {
      title: "Frontend Engineer",
      company: "Jobraker",
      description:
        "Built React, TypeScript, Supabase, and AI workflows for a job intelligence product.",
      is_current: true,
    },
  ],
  proofPoints: [
    {
      title: "Jobraker platform",
      evidence: "Built explainable React and Supabase workflows.",
      tags: ["React", "Supabase"],
    },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-23T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("lead quality engine", () => {
  it("scores fresh trusted ATS leads highly with visible reasons", () => {
    const result = scoreLeadQuality(baseJob);

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.reasons.some((item) => item.category === "source")).toBe(true);
    expect(result.reasons.some((item) => item.category === "freshness")).toBe(true);
  });

  it("caps expired jobs at 20", () => {
    const result = scoreLeadQuality({
      ...baseJob,
      expires_at: "2026-05-01T00:00:00Z",
    });

    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.caps.some((cap) => cap.id === "expired-job-cap")).toBe(true);
  });

  it("caps suspicious spammy sources at 30", () => {
    const result = scoreLeadQuality({
      ...baseJob,
      id: "spam",
      company: "Unknown",
      apply_url: "https://tinyurl.com/apply-now",
      source_type: "custom",
      source_kind: "scraped",
      source_confidence: 0.2,
      description:
        "No experience needed. Earn money fast. Contact us on WhatsApp and pay a training fee.",
    });

    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.caps.some((cap) => cap.category === "source")).toBe(true);
  });
});

describe("candidate fit engine", () => {
  it("scores a strong skills and seniority match highly", () => {
    const result = scoreCandidateFit(baseJob, baseProfile);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.supportingEvidence.length).toBeGreaterThan(0);
    expect(result.missingSignals.find((signal) => signal.title.includes("React"))).toBeUndefined();
  });

  it("caps severe seniority mismatch", () => {
    const result = scoreCandidateFit(
      {
        ...baseJob,
        title: "Staff Platform Engineer",
        experience_level: "Staff",
        description:
          "Requirements include 8+ years experience with Kubernetes, AWS, Go, and platform architecture.",
      },
      {
        ...baseProfile,
        targetTitle: "Junior Frontend Engineer",
        searchQuery: "junior frontend engineer",
        experienceYears: 1,
        skills: [{ name: "React", level: "Intermediate" }],
      },
    );

    expect(result.score).toBeLessThanOrEqual(65);
    expect(result.caps.some((cap) => cap.category === "seniority")).toBe(true);
    expect(result.blockers.some((blocker) => blocker.id === "seniority-mismatch")).toBe(true);
  });

  it("caps when explicit required skills lack evidence", () => {
    const result = scoreCandidateFit(
      {
        ...baseJob,
        description:
          "Requirements: must have Kubernetes and AWS experience. Nice to have React.",
      },
      {
        ...baseProfile,
        skills: [{ name: "React", level: "Advanced" }],
        experiences: [],
      },
    );

    expect(result.score).toBeLessThanOrEqual(75);
    expect(result.missingSignals.some((signal) => signal.title.includes("Kubernetes"))).toBe(true);
    expect(result.caps.some((cap) => cap.id === "missing-required-skill-cap")).toBe(true);
  });
});

describe("job dedupe engine", () => {
  it("detects same company and title duplicates", () => {
    const results = detectJobDuplicates([
      baseJob,
      {
        ...baseJob,
        id: "job-2",
        apply_url: "https://jobs.acme.ai/frontend-duplicate",
        created_at: "2026-05-22T00:00:00Z",
      },
    ]);

    const duplicateCount = [...results.values()].filter((result) => result.isDuplicate).length;
    expect(duplicateCount).toBe(1);
  });
});

describe("opportunity score engine", () => {
  it("combines lead quality, fit, evidence, strategy, and feedback", () => {
    const result = scoreExplainableOpportunity(baseJob, baseProfile);

    expect(result.opportunityScore).toBeGreaterThanOrEqual(80);
    expect(result.leadQualityScore).toBeGreaterThan(0);
    expect(result.candidateFitScore).toBeGreaterThan(0);
    expect(result.visibleReasons.length).toBeGreaterThan(0);
    expect(result.recommendedAction).toMatch(/apply_now|save_for_later|tailor_resume_first/);
  });

  it("does not let weighted score override hard caps", () => {
    const result = scoreExplainableOpportunity(
      {
        ...baseJob,
        expires_at: "2026-05-01T00:00:00Z",
      },
      baseProfile,
      { feedbackLearningScore: 100 },
    );

    expect(result.opportunityScore).toBeLessThanOrEqual(20);
    expect(result.capsApplied.some((cap) => cap.maxScore === 20)).toBe(true);
  });
});
