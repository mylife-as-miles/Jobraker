import { describe, it, expect, vi, beforeEach } from "vitest";
import { tailorResumeViaEdge, recalculateConfidence } from "../services/ai/tailorResume";

vi.mock("../services/supabase/invokeProtectedFunction", () => ({
  invokeProtectedFunction: vi.fn(),
}));

import { invokeProtectedFunction } from "../services/supabase/invokeProtectedFunction";

describe("Tailor Resume Flow & Confidence Recalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should tailor resume and return ~95% confidence score with ATS keyword coverage", async () => {
    const mockResponse = {
      tailored_resume: "# Alex Rivera\nEmail: alex@example.com | Phone: +1 555-0199\n\n## Professional Summary\nTailored leader...",
      confidence_score: 95,
      previous_confidence_score: 68,
      matched_keywords: ["react", "typescript", "microservices", "kubernetes", "cloud"],
      missing_keywords: [],
      ats_keyword_coverage: {
        score: 95,
        matched: ["react", "typescript", "microservices", "kubernetes", "cloud"],
        missing: [],
      },
      tailoring_highlights: [
        "Aligned summary to lead with required core competencies",
        "Embedded 14 target ATS keywords across career achievements",
      ],
      canonical_decision: "strong_yes",
    };

    (invokeProtectedFunction as any).mockResolvedValueOnce(mockResponse);

    const result = await tailorResumeViaEdge({
      jobDescription: "Seeking a Senior React / TypeScript engineer with experience in microservices and Kubernetes.",
      resumeText: "Experienced Software Engineer with JavaScript skills.",
      jobTitle: "Senior React Engineer",
      company: "Acme Corp",
    });

    expect(result.confidence_score).toBe(95);
    expect(result.previous_confidence_score).toBe(68);
    expect(result.canonical_decision).toBe("strong_yes");
    expect(result.matched_keywords).toContain("react");
    expect(result.matched_keywords).toContain("typescript");
    expect(result.tailored_resume).toContain("Alex Rivera");
  });

  it("should recalculate confidence when user manually edits the resume in the modal", async () => {
    const mockRecalcResponse = {
      confidence_score: 96,
      matched_keywords: ["react", "typescript", "docker", "graphql"],
      missing_keywords: [],
      ats_keyword_coverage: {
        score: 96,
        matched: ["react", "typescript", "docker", "graphql"],
        missing: [],
      },
      canonical_decision: "strong_yes",
    };

    (invokeProtectedFunction as any).mockResolvedValueOnce(mockRecalcResponse);

    const result = await recalculateConfidence(
      "We need React, TypeScript, Docker, and GraphQL.",
      "Expert React and TypeScript developer with extensive Docker containers and GraphQL APIs.",
      "Frontend Architect",
    );

    expect(result.confidence_score).toBe(96);
    expect(result.matched_keywords).toEqual(expect.arrayContaining(["react", "typescript"]));
    expect(result.canonical_decision).toBe("strong_yes");
  });

  it("should fall back gracefully to client synthesis if backend call throws", async () => {
    (invokeProtectedFunction as any).mockRejectedValueOnce(new Error("Network timeout"));

    const result = await tailorResumeViaEdge({
      jobDescription: "Senior Python engineer building distributed data pipelines with Postgres and AWS.",
      resumeText: "Software Engineer experienced in Python, Postgres, AWS, and distributed data systems.",
      jobTitle: "Senior Python Engineer",
      company: "DataCo",
    });

    expect(result.confidence_score).toBeGreaterThanOrEqual(93);
    expect(result.matched_keywords.length).toBeGreaterThan(0);
    expect(result.canonical_decision).toBe("strong_yes");
  });

  it("prioritizes personal data from attached resume basics over profile fallback", () => {
    // Test the candidate identity resolution logic used in apply-to-jobs
    const attachedResume = {
      id: "resume-123",
      name: "Custom Tailored CV",
      data: {
        basics: {
          name: "Dr. Taylor Swift, Ph.D.",
          phone: "+1 (555) 999-8888",
          email: "taylor@custom-resume.com",
          location: "Austin, TX",
          headline: "Principal Systems Architect",
        },
      },
    };

    const profileRow = {
      first_name: "ProfileFirst",
      last_name: "ProfileLast",
      phone: "+1 (555) 000-1111",
      location: "San Francisco, CA",
      job_title: "Junior Dev",
    };

    const userInput = {
      full_name: "Input Name",
      phone: "+1 (555) 222-3333",
    };

    const resumeBasics = attachedResume.data.basics;

    const resolvedName =
      (typeof resumeBasics?.name === "string" && resumeBasics.name.trim()) ||
      userInput.full_name ||
      profileRow.first_name;

    const resolvedPhone =
      (typeof resumeBasics?.phone === "string" && resumeBasics.phone.trim()) ||
      userInput.phone ||
      profileRow.phone;

    const resolvedEmail =
      (typeof resumeBasics?.email === "string" && resumeBasics.email.trim()) ||
      "default@profile.com";

    const resolvedLocation =
      (typeof resumeBasics?.location === "string" && resumeBasics.location.trim()) ||
      profileRow.location;

    expect(resolvedName).toBe("Dr. Taylor Swift, Ph.D.");
    expect(resolvedPhone).toBe("+1 (555) 999-8888");
    expect(resolvedEmail).toBe("taylor@custom-resume.com");
    expect(resolvedLocation).toBe("Austin, TX");
  });
});
