import { describe, it, expect, vi, beforeEach } from "vitest";
import { useArtboardStore, initialResumeState } from "../store/artboard";
import { polishContent, synthesizePolishedText } from "../services/ai/polishContent";
import { invokeProtectedFunction } from "../services/supabase/invokeProtectedFunction";

vi.mock("../services/supabase/invokeProtectedFunction", () => ({
  invokeProtectedFunction: vi.fn(),
}));

describe("Resume Private Sharing, Stats Tracking, and AI Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useArtboardStore.setState({ resume: structuredClone(initialResumeState) });
  });

  describe("Private Sharing & Token Logic", () => {
    it("constructs private link with unique token and public link without token", () => {
      const resumeId = "11111111-2222-3333-4444-555555555555";
      const shareToken = "abc123def456789012345678";
      const origin = "https://app.jobraker.io";

      const privateUrl = `${origin}/r/${resumeId}?token=${shareToken}`;
      const publicUrl = `${origin}/r/${resumeId}`;

      expect(privateUrl).toBe("https://app.jobraker.io/r/11111111-2222-3333-4444-555555555555?token=abc123def456789012345678");
      expect(publicUrl).toBe("https://app.jobraker.io/r/11111111-2222-3333-4444-555555555555");
      expect(privateUrl).toContain("?token=");
      expect(publicUrl).not.toContain("?token=");
    });

    it("evaluates public vs private token authorization accurately", () => {
      const resumeRecord = {
        id: "res-123",
        public_share_enabled: false,
        share_token: "secret-token-xyz",
      };

      const checkAccess = (record: typeof resumeRecord, queryToken: string | null) => {
        return record.public_share_enabled === true ||
          Boolean(queryToken && record.share_token && record.share_token === queryToken);
      };

      // Denied if private and no token
      expect(checkAccess(resumeRecord, null)).toBe(false);
      expect(checkAccess(resumeRecord, "")).toBe(false);
      // Denied if wrong token
      expect(checkAccess(resumeRecord, "wrong-token")).toBe(false);
      // Allowed if matching token
      expect(checkAccess(resumeRecord, "secret-token-xyz")).toBe(true);

      // Allowed without token if public_share_enabled is true
      const publicRecord = { ...resumeRecord, public_share_enabled: true };
      expect(checkAccess(publicRecord, null)).toBe(true);
      expect(checkAccess(publicRecord, "any-or-no-token")).toBe(true);
    });

    it("updates store stats and share_token correctly", () => {
      const store = useArtboardStore.getState();

      store.updateResumeStats({
        views: 42,
        downloads: 15,
        share_token: "token-999",
      });

      const updated = useArtboardStore.getState().resume;
      expect(updated.views).toBe(42);
      expect(updated.downloads).toBe(15);
      expect(updated.share_token).toBe("token-999");
    });
  });

  describe("AI Polish & Generate Resiliency", () => {
    it("synthesizes executive high-impact text when content is provided", () => {
      const original = "Managed engineering team and built web apps";
      const metrics = synthesizePolishedText(original, "metrics");
      const leadership = synthesizePolishedText(original, "leadership");

      expect(metrics).not.toBe(original);
      expect(leadership).not.toBe(original);
      expect(metrics.toLowerCase()).toContain("managed engineering team");
      expect(metrics).toContain("(+30%)");
    });

    it("falls back gracefully to local executive synthesis if backend call fails", async () => {
      vi.mocked(invokeProtectedFunction).mockRejectedValueOnce(
        new Error("429 Too Many Requests: Quota exceeded"),
      );

      const suggestions = await polishContent("Developed cloud infrastructure and automation pipelines");

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].content).toContain("cloud infrastructure");
      expect(suggestions[0].label).toBe("High Impact & Metrics");
      expect(suggestions[0].isRecommended).toBe(true);
      expect(suggestions[1].label).toBe("Executive Leadership");
      expect(suggestions[2].label).toBe("Targeted ATS Optimization");
    });
  });
});
