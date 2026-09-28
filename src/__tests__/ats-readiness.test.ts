import { describe, it, expect } from "vitest";
import { getAutoApplyReadiness } from "@/lib/atsReadiness";

const answered = {
  work_authorized: true,
  requires_visa_sponsorship: false,
  desired_salary: "80000 USD per year",
  has_security_clearance: false,
  willing_to_relocate: false,
};

const raw = (keys: string[], known = true) => ({ ats: { questions_known: known, required_question_keys: keys } });

describe("getAutoApplyReadiness", () => {
  it("is unknown when the job's questions are not known", () => {
    expect(getAutoApplyReadiness({}, answered)).toEqual({ state: "unknown" });
    expect(getAutoApplyReadiness(raw(["email"], false), answered)).toEqual({ state: "unknown" });
  });

  it("is ready when every required question is covered", () => {
    expect(getAutoApplyReadiness(raw(["first_name", "email", "resume", "work_authorization", "sponsorship", "why_company"]), answered))
      .toEqual({ state: "ready" });
  });

  it("lists eligibility answers the user has not saved", () => {
    const r = getAutoApplyReadiness(raw(["email", "work_authorization", "sponsorship"]), null);
    expect(r).toEqual({ state: "needs", missing: ["Work authorization", "Visa sponsorship"] });
  });

  it("lists questions the profile cannot answer yet", () => {
    const r = getAutoApplyReadiness(raw(["email", "current_salary", "notice_period", "unmapped_custom"]), answered);
    expect(r).toEqual({ state: "needs", missing: ["Current salary", "Notice period / start date", "unmapped custom"] });
  });
});
