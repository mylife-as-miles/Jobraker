import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  polishContent,
  synthesizePolishedText,
} from "../services/ai/polishContent";
import {
  polishTextHeuristically,
  normalizePolishResponse,
  buildFallbackPolishResponse,
} from "../../backend/supabase/functions/_shared/polish-content-utils";
import { invokeProtectedFunction } from "../services/supabase/invokeProtectedFunction";
import { useArtboardStore, initialResumeState } from "../store/artboard";

vi.mock("../services/supabase/invokeProtectedFunction", () => ({
  invokeProtectedFunction: vi.fn(),
}));

describe("AI Summary Polishing & Non-Identical Output Guarantee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useArtboardStore.setState({ resume: structuredClone(initialResumeState) });
  });

  describe("Backend Heuristic & Normalization", () => {
    it("polishTextHeuristically guarantees output differs from input for all styles", () => {
      const input = "Frontend developer building web applications with React and TypeScript";

      const metrics = polishTextHeuristically(input, "metrics");
      const leadership = polishTextHeuristically(input, "leadership");
      const ats = polishTextHeuristically(input, "ats");

      expect(metrics.toLowerCase()).not.toBe(input.toLowerCase());
      expect(leadership.toLowerCase()).not.toBe(input.toLowerCase());
      expect(ats.toLowerCase()).not.toBe(input.toLowerCase());

      expect(metrics).toMatch(/Spearheaded|Results-driven/i);
      expect(leadership).toMatch(/Strategic leader|Orchestrated/i);
      expect(ats).toMatch(/Accomplished specialist|Engineered/i);
    });

    it("normalizePolishResponse extracts suggestions from direct array and guarantees divergence", () => {
      const original = "Software engineer";
      const rawGeminiArray = [
        {
          id: "1",
          type: "enhancement",
          text: "Spearheaded enterprise cloud platforms with 99.99% uptime.",
          label: "Metrics & Impact",
        },
        {
          id: "2",
          type: "professional",
          rewritten: "Strategic technology leader directing cross-functional engineering teams.",
          label: "Executive Leadership",
        },
      ];

      const response = normalizePolishResponse(rawGeminiArray, original);

      expect(response.suggestions).toHaveLength(2);
      expect(response.suggestions[0].content).toBe(
        "Spearheaded enterprise cloud platforms with 99.99% uptime.",
      );
      expect(response.suggestions[0].isRecommended).toBe(true);
      expect(response.suggestions[1].content).toBe(
        "Strategic technology leader directing cross-functional engineering teams.",
      );
    });

    it("normalizePolishResponse elevates suggestions that were returned verbatim identical to input", () => {
      const original = "Software engineer at Acme Corp";
      const verbatimOutput = {
        suggestions: [
          {
            id: "1",
            content: "Software engineer at Acme Corp", // Identical to input!
          },
        ],
      };

      const response = normalizePolishResponse(verbatimOutput, original);

      expect(response.suggestions).toHaveLength(1);
      // Content MUST differ from the original input
      expect(response.suggestions[0].content.toLowerCase()).not.toBe(
        original.toLowerCase(),
      );
      expect(response.suggestions[0].content).toContain("engineer at acme corp");
    });

    it("buildFallbackPolishResponse provides 3 distinct non-identical suggestions", () => {
      const original = "Full stack developer with 5 years experience";
      const fallback = buildFallbackPolishResponse(original);

      expect(fallback.suggestions).toHaveLength(3);
      fallback.suggestions.forEach((s) => {
        expect(s.content.toLowerCase()).not.toBe(original.toLowerCase());
        expect(s.content.trim().length).toBeGreaterThan(20);
      });
      expect(fallback.suggestions[0].isRecommended).toBe(true);
    });
  });

  describe("Frontend polishContent Service", () => {
    it("synthesizePolishedText generates enhanced divergent text", () => {
      const input = "Lead developer managing engineering projects";
      const synthesized = synthesizePolishedText(input, "metrics");

      expect(synthesized.toLowerCase()).not.toBe(input.toLowerCase());
      expect(synthesized).toContain("developer managing engineering projects");
    });

    it("polishContent service guarantees output differs from input even if backend returned identical content", async () => {
      const input = "React developer building interactive dashboards";

      // Simulate backend returning un-enhanced identical text
      vi.mocked(invokeProtectedFunction).mockResolvedValueOnce({
        suggestions: [
          {
            id: "1",
            content: "React developer building interactive dashboards",
            type: "enhancement",
            label: "Enhanced",
            isRecommended: true,
          },
        ],
      });

      const suggestions = await polishContent(input);

      expect(suggestions).toHaveLength(1);
      // Service must have detected verbatim match and upgraded it
      expect(suggestions[0].content.toLowerCase()).not.toBe(input.toLowerCase());
      expect(suggestions[0].original).toBe(input);
    });

    it("throws when empty content is passed", async () => {
      await expect(polishContent("   ")).rejects.toThrow(
        "Content is required",
      );
    });
  });

  describe("Zustand Store Summary State Application", () => {
    it("setResumeData updates summary.content and sets hidden to false", () => {
      const store = useArtboardStore.getState();

      const newSummaryText =
        "Results-driven Senior Full-Stack Engineer with 6+ years of expertise in architecting high-throughput distributed systems.";
      const initialContent = store.resume.data.summary.content;
      expect(initialContent).not.toBe(newSummaryText);

      store.setResumeData({
        summary: {
          ...store.resume.data.summary,
          content: newSummaryText,
          hidden: false,
        },
      });

      const updated = useArtboardStore.getState();
      expect(updated.resume.data.summary.content).toBe(newSummaryText);
      expect(updated.resume.data.summary.hidden).toBe(false);
    });
  });
});
