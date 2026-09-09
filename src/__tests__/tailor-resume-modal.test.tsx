import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { TailorResumeModal } from "@/screens/Dashboard/components/jobs/TailorResumeModal";
import * as tailorModule from "@/services/ai/tailorResume";
import { ToastProvider } from "@/components/ui/toast-provider";

vi.mock("@/services/ai/tailorResume", () => ({
  tailorResumeViaEdge: vi.fn(),
  recalculateConfidence: vi.fn(),
}));

describe("TailorResumeModal Infinite Loop and State Bug Fixes", () => {
  const mockJob = {
    id: "job-remoterocketship-1",
    title: "Remote Project Manager Jobs in Africa",
    company: "Remoterocketship",
    description: "Looking for an experienced project manager with Agile and Jira skills.",
    apply_url: "https://example.com/apply",
  };

  const sampleResume = "Experienced Project Manager skilled in Jira, Agile, and cross-functional leadership.";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls tailorResumeViaEdge exactly once when opened and avoids infinite re-triggering on parent re-renders", async () => {
    const mockTailorResult: tailorModule.TailorResumeResponse = {
      tailored_resume: "# Tailored CV for Remoterocketship\nExperienced Project Manager...",
      confidence_score: 93,
      previous_confidence_score: 68,
      matched_keywords: ["jira", "agile", "project manager"],
      missing_keywords: [],
      ats_keyword_coverage: {
        score: 93,
        matched: ["jira", "agile"],
        missing: [],
      },
      tailoring_highlights: ["Aligned core competencies to Remoterocketship requirements"],
      canonical_decision: "strong_yes",
    };

    vi.mocked(tailorModule.tailorResumeViaEdge).mockResolvedValue(mockTailorResult);

    const onApply = vi.fn();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <ToastProvider>
        <TailorResumeModal
          open={true}
          onOpenChange={onOpenChange}
          job={{ ...mockJob }}
          baseResumeText={sampleResume}
          resumeName="Miles-Cv (2).pdf"
          onApply={onApply}
        />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(tailorModule.tailorResumeViaEdge).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText("93%")).toBeDefined();
    });

    rerender(
      <ToastProvider>
        <TailorResumeModal
          open={true}
          onOpenChange={onOpenChange}
          job={{ ...mockJob }}
          baseResumeText={sampleResume}
          resumeName="Miles-Cv (2).pdf"
          onApply={onApply}
        />
      </ToastProvider>,
    );

    rerender(
      <ToastProvider>
        <TailorResumeModal
          open={true}
          onOpenChange={onOpenChange}
          job={{ ...mockJob }}
          baseResumeText={sampleResume}
          resumeName="Miles-Cv (2).pdf"
          onApply={onApply}
        />
      </ToastProvider>,
    );

    expect(tailorModule.tailorResumeViaEdge).toHaveBeenCalledTimes(1);
  });

  it("handles empty baseResumeText gracefully without getting stuck in a loading loop", async () => {
    const onApply = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ToastProvider>
        <TailorResumeModal
          open={true}
          onOpenChange={onOpenChange}
          job={mockJob}
          baseResumeText=""
          resumeName="No Resume"
          onApply={onApply}
        />
      </ToastProvider>,
    );

    expect(tailorModule.tailorResumeViaEdge).not.toHaveBeenCalled();
    expect(screen.getByText("No Resume Content Detected")).toBeDefined();
  });

  it("allows user to manually re-run AI tailoring via Re-tailor with AI button", async () => {
    const mockTailorResult: tailorModule.TailorResumeResponse = {
      tailored_resume: "First tailored resume draft",
      confidence_score: 91,
      previous_confidence_score: 65,
      matched_keywords: ["agile"],
      missing_keywords: [],
      ats_keyword_coverage: { score: 91, matched: ["agile"], missing: [] },
      tailoring_highlights: ["Highlight 1"],
      canonical_decision: "strong_yes",
    };

    vi.mocked(tailorModule.tailorResumeViaEdge).mockResolvedValue(mockTailorResult);

    render(
      <ToastProvider>
        <TailorResumeModal
          open={true}
          onOpenChange={vi.fn()}
          job={mockJob}
          baseResumeText={sampleResume}
          onApply={vi.fn()}
        />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(tailorModule.tailorResumeViaEdge).toHaveBeenCalledTimes(1);
    });

    const reTailorBtn = screen.getByRole("button", { name: /re-tailor with ai/i });
    fireEvent.click(reTailorBtn);

    await waitFor(() => {
      expect(tailorModule.tailorResumeViaEdge).toHaveBeenCalledTimes(2);
    });
  });
});
