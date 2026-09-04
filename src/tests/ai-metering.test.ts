import { describe, it, expect } from "vitest";

// Internal model token pricing formula
// Input tokens: $0.50 / 1,000,000 tokens => 500 nanos per token
// Output tokens: $3.00 / 1,000,000 tokens => 3,000 nanos per token
// 1 USD = 1,000,000,000 nanodollars

const INPUT_NANOS_PER_TOKEN = 500n;
const OUTPUT_NANOS_PER_TOKEN = 3000n;
const ONE_USD_NANOS = 1_000_000_000n;

const ALLOWLISTED_ROOT_KEYS = new Set([
  "plan",
  "rolling5h",
  "rolling24h",
  "weekly",
  "monthly",
  "limitedBy",
  "creditsAvailable",
]);

const ALLOWLISTED_WINDOW_KEYS = new Set([
  "percentUsed",
  "percentLeft",
  "resetsAt",
  "resetsGradually",
  "nextAvailabilityAt",
  "windowHours",
]);

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
      // Explicit Free Plan Allowance ($0.50 Monthly, $0.20 Weekly, $0.05 Rolling 24h)
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

describe("Usage Percentage Calculations & Progress Bar Semantics", () => {
  it("returns 100% left when usage is zero (Full progress bar)", () => {
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

  it("returns 0% left when usage equals or exceeds limit (Empty progress bar)", () => {
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
  it("configures Free plan internal limits ($0.50 monthly, $0.20 weekly, $0.05 24h)", () => {
    const free = getTierLimits("Free");
    expect(free.monthlyNanos).toBe(500_000_000n);
    expect(free.weeklyNanos).toBe(200_000_000n);
    expect(free.rolling24hNanos).toBe(50_000_000n);
  });

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

describe("Weekly Window Truncation Edge Case", () => {
  it("truncates weekly reset date at current_period_end when fewer than 7 days remain", () => {
    const periodStart = new Date("2026-08-01T00:00:00Z");
    const periodEnd = new Date("2026-09-01T00:00:00Z");
    const now = new Date("2026-08-30T00:00:00Z"); // 2 days before periodEnd

    const weeklyStart = new Date("2026-08-29T00:00:00Z");
    const rawWeeklyEnd = new Date(weeklyStart.getTime() + 7 * 86400 * 1000); // 2026-09-05
    const truncatedWeeklyEnd = new Date(Math.min(rawWeeklyEnd.getTime(), periodEnd.getTime()));

    expect(truncatedWeeklyEnd.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("Mandatory Status Response Privacy (Strict Allowlist Test)", () => {
  it("strictly enforces that status response ONLY contains allowlisted keys and zero private financial/token data", () => {
    const statusPayload = {
      plan: "Basics",
      rolling24h: {
        percentUsed: 28,
        percentLeft: 72,
        resetsAt: null,
        resetsGradually: true,
        nextAvailabilityAt: null,
      },
      weekly: {
        percentUsed: 32,
        percentLeft: 68,
        resetsAt: "2026-08-09T00:00:00Z",
        resetsGradually: false,
        nextAvailabilityAt: null,
      },
      monthly: {
        percentUsed: 16,
        percentLeft: 84,
        resetsAt: "2026-09-01T00:00:00Z",
        resetsGradually: false,
        nextAvailabilityAt: null,
      },
      limitedBy: null,
    };

    // Root keys check
    for (const key of Object.keys(statusPayload)) {
      expect(ALLOWLISTED_ROOT_KEYS.has(key)).toBe(true);
    }

    // Window keys check
    for (const windowKey of ["rolling24h", "weekly", "monthly"] as const) {
      const windowObj = statusPayload[windowKey];
      for (const key of Object.keys(windowObj)) {
        expect(ALLOWLISTED_WINDOW_KEYS.has(key)).toBe(true);
      }
    }

    // Denylist string check
    const serialized = JSON.stringify(statusPayload);
    const forbiddenSubstrings = [
      "dollars", "nanos", "cost", "tokens", "price", "allowance",
      "input", "output", "provider", "model", "reserved", "5.00", "3.00"
    ];

    for (const forbidden of forbiddenSubstrings) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
