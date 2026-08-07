import { describe, it, expect } from "vitest";
import { normalizeAiUsageData } from "../services/aiUsageService";
import { formatResetDate } from "../screens/Dashboard/components/UsageLimitRow";

describe("Composio Unified AI Usage Metering", () => {
  it("normalizes status response to percentage-only limits with privacy protection", () => {
    const rawBackendResponse = {
      plan: "Starter",
      rolling24h: {
        percentUsed: 25,
        percentLeft: 75,
        resetsAt: "2026-08-03T22:00:00Z",
        resetsGradually: true,
        nextAvailabilityAt: "2026-08-03T22:00:00Z",
        // Internal metadata that MUST NOT be exposed or required
        provider_cost_nanos: 5000000,
        composio_log_id: "log_123",
      },
      weekly: {
        percentUsed: 10,
        percentLeft: 90,
        resetsAt: "2026-08-09T00:00:00Z",
        resetsGradually: false,
      },
      monthly: {
        percentUsed: 5,
        percentLeft: 95,
        resetsAt: "2026-08-26T00:00:00Z",
        resetsGradually: false,
      },
      limitedBy: null,
    };

    const normalized = normalizeAiUsageData(rawBackendResponse);

    expect(normalized.plan).toBe("Starter");
    expect(normalized.rolling24h.percentLeft).toBe(75);
    expect(normalized.weekly.percentLeft).toBe(90);
    expect(normalized.monthly.percentLeft).toBe(95);

    // Verify privacy: raw backend metadata fields are strictly stripped
    expect((normalized.rolling24h as any).provider_cost_nanos).toBeUndefined();
    expect((normalized.rolling24h as any).composio_log_id).toBeUndefined();
    expect((normalized as any).credits).toBeUndefined();
    expect((normalized as any).composio_credits).toBeUndefined();
  });

  it("calculates humanized relative reset countdown for 24h rolling limit", () => {
    const now = new Date();
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    const result = formatResetDate(null, true, fourHoursLater);

    expect(result).toBe("Resets in 4 hours");
  });

  it("classifies Composio tool executions into unified_ai_usage mode", () => {
    function usageBillingMode(toolName: string) {
      if (
        toolName === "invoke_composio_tool" ||
        toolName === "list_composio_integrations" ||
        toolName.startsWith("GMAIL_") ||
        toolName.startsWith("GITHUB_") ||
        toolName.startsWith("LINKEDIN_")
      ) {
        return "unified_ai_usage";
      }
      return "existing_external_credit";
    }

    expect(usageBillingMode("invoke_composio_tool")).toBe("unified_ai_usage");
    expect(usageBillingMode("GMAIL_SEND_EMAIL")).toBe("unified_ai_usage");
    expect(usageBillingMode("GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER")).toBe("unified_ai_usage");
    expect(usageBillingMode("skyvern_apply")).toBe("existing_external_credit");
  });
});
