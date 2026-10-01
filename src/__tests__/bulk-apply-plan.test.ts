import { describe, it, expect } from "vitest";
import { countryFromText, planBulkApply } from "@/lib/bulkApplyPlan";

const job = (id: string, company: string, matchScore: number | null, remote_scope?: string, countries: string[] = []) => ({
  id, title: `Role ${id}`, company, matchScore,
  raw_data: remote_scope ? { ats: { remote_scope, countries } } : {},
});

describe("countryFromText", () => {
  it("reads countries and known cities", () => {
    expect(countryFromText("Lagos, Nigeria")).toBe("NG");
    expect(countryFromText("Lagos")).toBe("NG");
    expect(countryFromText("Somewhere")).toBeNull();
  });
});

describe("planBulkApply", () => {
  it("skips unscored and below-55% jobs", () => {
    const plan = planBulkApply([job("a", "A", null, "worldwide"), job("b", "B", 54, "worldwide"), job("c", "C", 55, "worldwide")], { country: "NG", recentByCompany: {} });
    expect(plan.selected.map((j) => j.id)).toEqual(["c"]);
    expect(plan.skipped.map((j) => j.reason)).toEqual(["Below 55% fit", "Not scored yet"]);
  });

  it("skips jobs not workable from the candidate country", () => {
    const plan = planBulkApply(
      [job("sf", "Asana", 80, "onsite", ["US"]), job("ng", "X", 80, "restricted", ["NG"]), job("ww", "Y", 80, "worldwide"), job("old", "Z", 80)],
      { country: "NG", recentByCompany: {} },
    );
    expect(plan.selected.map((j) => j.id).sort()).toEqual(["ng", "ww"]);
    expect(plan.skipped.find((j) => j.id === "sf")?.reason).toBe("On-site role not open to Nigeria");
    expect(plan.skipped.find((j) => j.id === "old")?.reason).toBe("Location not verified");
  });

  it("allows any location when no country filter applies", () => {
    const plan = planBulkApply([job("sf", "Asana", 80, "onsite", ["US"])], { country: null, recentByCompany: {} });
    expect(plan.selected).toHaveLength(1);
  });

  it("limits each employer to 2 applications in 30 days, best matches first", () => {
    const jobs = [60, 90, 70, 80].map((s, i) => job(`c${i}`, "Canonical", s, "worldwide"));
    const plan = planBulkApply(jobs, { country: "NG", recentByCompany: {} });
    expect(plan.selected.map((j) => j.matchScore)).toEqual([90, 80]);
    expect(plan.skipped).toHaveLength(2);

    const withHistory = planBulkApply(jobs, { country: "NG", recentByCompany: { canonical: 1 } });
    expect(withHistory.selected.map((j) => j.matchScore)).toEqual([90]);
  });
});

describe("planBulkApply readiness ordering", () => {
  const withQuestions = (id: string, score: number, keys: string[]) => ({
    id, title: id, company: `Co ${id}`, matchScore: score,
    raw_data: { ats: { remote_scope: "worldwide", countries: [], questions_known: true, required_question_keys: keys } },
  });
  it("puts ready jobs first, then unknown, then jobs that will ask", () => {
    const plan = planBulkApply(
      [
        withQuestions("needs", 95, ["email", "notice_period"]),
        { id: "unknown", title: "u", company: "Co u", matchScore: 90, raw_data: { ats: { remote_scope: "worldwide" } } },
        withQuestions("ready", 60, ["email"]),
      ],
      { country: "NG", recentByCompany: {}, answers: null },
    );
    expect(plan.selected.map((j) => [j.id, j.readiness])).toEqual([["ready", "ready"], ["unknown", "unknown"], ["needs", "needs"]]);
    expect(plan.selected[2].missing).toEqual(["Notice period / start date"]);
  });
});
