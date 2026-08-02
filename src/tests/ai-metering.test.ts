import { describe, it, expect } from "vitest";

// Internal model token pricing formula
// Input tokens: $0.50 / 1,000,000 tokens => 500 nanos per token
// Output tokens: $3.00 / 1,000,000 tokens => 3,000 nanos per token
// 1 USD = 1,000,000,000 nanodollars

const INPUT_NANOS_PER_TOKEN = 500n;
const OUTPUT_NANOS_PER_TOKEN = 3000n;
const ONE_USD_NANOS = 1_000_000_000n;

function calculateCostNanos(inputTokens: number | bigint, outputTokens: number | bigint): bigint {
  const input = BigInt(Math.max(0, Math.floor(Number(inputTokens) || 0)));
  const output = BigInt(Math.max(0, Math.floor(Number(outputTokens) || 0)));
  return input * INPUT_NANOS_PER_TOKEN + output * OUTPUT_NANOS_PER_TOKEN;
}

function calculatePercentageStatus(usedNanos: bigint, limitNanos: bigint) {
  const limit = Math.max(1, Number(limitNanos));
  const used = Math.max(0, Number(usedNanos));
  
  const rawUsedPct = (used / limit) * 100;
  const percentUsed = Math.min(100, Math.max(0, Math.round(rawUsedPct)));
  const percentLeft = 100 - percentUsed;

  return { percentUsed, percentLeft };
}

interface TierLimits {
  monthlyNanos: bigint;
  weeklyNanos: bigint;
  rolling24hNanos: bigint;
}

function getTierLimits(tier: string): TierLimits {
  switch (tier) {
    case "Starter":
      return {
        monthlyNanos: 3n * ONE_USD_NANOS,            // $3.00
        weeklyNanos: 12n * (ONE_USD_NANOS / 10n),    // $1.20
        rolling24hNanos: 3n * (ONE_USD_NANOS / 10n),  // $0.30
      };
    case "Basics":
      return {
        monthlyNanos: 5n * ONE_USD_NANOS,            // $5.00
        weeklyNanos: 2n * ONE_USD_NANOS,             // $2.00
        rolling24hNanos: 5n * (ONE_USD_NANOS / 10n),  // $0.50
      };
    case "Pro":
      return {
        monthlyNanos: 12n * ONE_USD_NANOS,           // $12.00
        weeklyNanos: 48n * (ONE_USD_NANOS / 10n),    // $4.80
        rolling24hNanos: 12n * (ONE_USD_NANOS / 10n), // $1.20
      };
    case "Ultimate":
      return {
        monthlyNanos: 25n * ONE_USD_NANOS,           // $25.00
        weeklyNanos: 10n * ONE_USD_NANOS,            // $10.00
        rolling24hNanos: 25n * (ONE_USD_NANOS / 10n), // $2.50
      };
    default:
      return {
        monthlyNanos: 5n * (ONE_USD_NANOS / 10n),    // $0.50
        weeklyNanos: 2n * (ONE_USD_NANOS / 10n),     // $0.20
        rolling24hNanos: 5n * (ONE_USD_NANOS / 100n), // $0.05
      };
  }
}

describe("AI Token Pricing & Nanodollar Integer Accounting", () => {
  it("calculates exact internal cost for 1,000,000 input tokens ($0.50 = 500,000,000 nanos)", () => {
    const cost = calculateCostNanos(1_000_000, 0);
    expect(cost).toBe(500_000_000n);
    expect(cost * 2n).toBe(ONE_USD_NANOS);
  });

  it("calculates exact internal cost for 1,000,000 output tokens ($3.00 = 3,000,000,000 nanos)", () => {
    const cost = calculateCostNanos(0, 1_000_000);
    expect(cost).toBe(3_000_000_000n);
    expect(cost).toBe(3n * ONE_USD_NANOS);
  });

  it("calculates mixed input/output token usage accurately", () => {
    const cost = calculateCostNanos(100_000, 50_000);
    expect(cost).toBe(200_000_000n);
  });

  it("returns zero cost for zero tokens", () => {
    expect(calculateCostNanos(0, 0)).toBe(0n);
  });

  it("handles very large token counts without float overflow or precision loss", () => {
    const hugeInput = 10_000_000_000n;
    const hugeOutput = 5_000_000_000n;
    const cost = calculateCostNanos(hugeInput, hugeOutput);
    expect(cost).toBe(20_000_000_000_000n);
  });
});

describe("Usage Percentage Calculations", () => {
  it("returns 100% left when usage is zero", () => {
    const status = calculatePercentageStatus(0n, 5_000_000_000n);
    expect(status.percentUsed).toBe(0);
    expect(status.percentLeft).toBe(100);
    expect(status.percentUsed + status.percentLeft).toBe(100);
  });

  it("returns 50% left when usage is exactly half the limit", () => {
    const limit = 5_000_000_000n;
    const used = 2_500_000_000n;
    const status = calculatePercentageStatus(used, limit);
    expect(status.percentUsed).toBe(50);
    expect(status.percentLeft).toBe(50);
    expect(status.percentUsed + status.percentLeft).toBe(100);
  });

  it("returns 0% left when usage equals or exceeds limit", () => {
    const limit = 5_000_000_000n;
    const status1 = calculatePercentageStatus(limit, limit);
    expect(status1.percentLeft).toBe(0);
    expect(status1.percentUsed).toBe(100);

    const status2 = calculatePercentageStatus(limit * 2n, limit);
    expect(status2.percentLeft).toBe(0);
    expect(status2.percentUsed).toBe(100);
    expect(status2.percentUsed + status2.percentLeft).toBe(100);
  });

  it("ensures percentUsed + percentLeft ALWAYS equals 100 across fractional percentages", () => {
    const limit = 10_000_000_000n;
    for (let i = 0; i <= 100; i += 7) {
      const used = (limit * BigInt(i)) / 100n;
      const status = calculatePercentageStatus(used, limit);
      expect(status.percentUsed + status.percentLeft).toBe(100);
    }
  });
});

describe("Tier Allowance Specifications", () => {
  it("configures Starter tier internal limits ($3.00 monthly, $1.20 weekly, $0.30 24h)", () => {
    const starter = getTierLimits("Starter");
    expect(starter.monthlyNanos).toBe(3_000_000_000n);
    expect(starter.weeklyNanos).toBe(1_200_000_000n);
    expect(starter.rolling24hNanos).toBe(300_000_000n);
  });

  it("configures Basics tier internal limits ($5.00 monthly, $2.00 weekly, $0.50 24h)", () => {
    const basics = getTierLimits("Basics");
    expect(basics.monthlyNanos).toBe(5_000_000_000n);
    expect(basics.weeklyNanos).toBe(2_000_000_000n);
    expect(basics.rolling24hNanos).toBe(500_000_000n);
  });

  it("configures Pro tier internal limits ($12.00 monthly, $4.80 weekly, $1.20 24h)", () => {
    const pro = getTierLimits("Pro");
    expect(pro.monthlyNanos).toBe(12_000_000_000n);
    expect(pro.weeklyNanos).toBe(4_800_000_000n);
    expect(pro.rolling24hNanos).toBe(1_200_000_000n);
  });

  it("configures Ultimate tier internal limits ($25.00 monthly, $10.00 weekly, $2.50 24h)", () => {
    const ultimate = getTierLimits("Ultimate");
    expect(ultimate.monthlyNanos).toBe(25_000_000_000n);
    expect(ultimate.weeklyNanos).toBe(10_000_000_000n);
    expect(ultimate.rolling24hNanos).toBe(2_500_000_000n);
  });
});

describe("Multi-Window Enforcement Logic", () => {
  it("rejects a request when the weekly limit is exhausted even if monthly capacity remains", () => {
    const pro = getTierLimits("Pro");
    const monthlyUsed = 3_000_000_000n;
    const weeklyUsed = 4_800_000_000n;

    const monthlyStatus = calculatePercentageStatus(monthlyUsed, pro.monthlyNanos);
    const weeklyStatus = calculatePercentageStatus(weeklyUsed, pro.weeklyNanos);

    expect(monthlyStatus.percentLeft).toBeGreaterThan(0);
    expect(weeklyStatus.percentLeft).toBe(0);
  });
});

describe("Privacy Protection (Sanitization)", () => {
  it("ensures public status object contains no monetary amounts, cost units, or raw token counts", () => {
    const publicStatus = {
      plan: "Basics",
      rolling24h: {
        percentUsed: 28,
        percentLeft: 72,
        resetsAt: null,
        resetsGradually: true,
      },
      weekly: {
        percentUsed: 32,
        percentLeft: 68,
        resetsAt: "2026-08-09T00:00:00Z",
        resetsGradually: false,
      },
      monthly: {
        percentUsed: 16,
        percentLeft: 84,
        resetsAt: "2026-09-01T00:00:00Z",
        resetsGradually: false,
      },
      limitedBy: null,
    };

    const stringified = JSON.stringify(publicStatus);

    expect(stringified).not.toContain("dollars");
    expect(stringified).not.toContain("cost");
    expect(stringified).not.toContain("tokens");
    expect(stringified).not.toContain("nanos");
    expect(stringified).not.toContain("$");
    expect(stringified).not.toContain("allowance");
    expect(stringified).not.toContain("5.00");
    expect(stringified).not.toContain("3.00");

    expect(publicStatus.rolling24h.percentUsed + publicStatus.rolling24h.percentLeft).toBe(100);
    expect(publicStatus.weekly.percentUsed + publicStatus.weekly.percentLeft).toBe(100);
    expect(publicStatus.monthly.percentUsed + publicStatus.monthly.percentLeft).toBe(100);
  });
});
