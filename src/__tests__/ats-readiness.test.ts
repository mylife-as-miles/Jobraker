import { describe, it, expect } from "vitest";
import { getAutoApplyReadiness } from "@/lib/atsReadiness";

const profile = {
  country_residence: { country: "NG" },
  work_authorization: { countries: ["NG"] },
  expected_salary: { text: "80000 USD per year" },
  current_salary: { text: "50000 USD per year" },
  notice_period: { days: 30, negotiable: true },
};

const job = (keys: string[], ats: Record<string, unknown> = {}, known = true) => ({
  company: "Canonical",
  raw_data: { ats: { questions_known: known, required_question_keys: keys, remote_scope: "worldwide", countries: [], ...ats } },
});

describe("getAutoApplyReadiness (application profile)", () => {
  it("is unknown when the job's questions are not known", () => {
    expect(getAutoApplyReadiness({ raw_data: {} }, profile)).toEqual({ state: "unknown" });
    expect(getAutoApplyReadiness(job(["email"], {}, false), profile)).toEqual({ state: "unknown" });
  });

  it("is ready when the profile answers every required question", () => {
    expect(getAutoApplyReadiness(job(["first_name", "email", "resume", "work_authorization", "sponsorship", "current_salary", "notice_period"]), profile))
      .toEqual({ state: "ready" });
  });

  it("lists what the profile cannot answer", () => {
    expect(getAutoApplyReadiness(job(["email", "current_salary", "how_heard"]), {}))
      .toEqual({ state: "needs", missing: ["Current salary", "How you heard about the job"] });
  });

  it("needs opt-in before answering why this company", () => {
    expect(getAutoApplyReadiness(job(["why_company"]), profile).state).toBe("needs");
    expect(getAutoApplyReadiness(job(["why_company"]), { ...profile, permissions: { ai_motivation: true } }).state).toBe("ready");
  });
});
