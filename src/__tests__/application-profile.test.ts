import { describe, it, expect } from "vitest";
import {
  isAnswerable,
  resolveProfileAnswer,
  targetCountry,
  withLegacyAnswers,
  type JobFacts,
} from "../../backend/supabase/shared/application-profile";

const lagos = { country_residence: { country: "NG" }, work_authorization: { countries: ["NG"] } };
const job = (over: Partial<JobFacts> = {}): JobFacts => ({
  company: "Canonical", countries: [], remoteScope: "worldwide", residenceCountry: null, ...over,
});

describe("targetCountry", () => {
  it("uses residence for worldwide remote and the job country otherwise", () => {
    expect(targetCountry(job({ residenceCountry: "NG" }))).toBe("NG");
    expect(targetCountry(job({ remoteScope: "onsite", countries: ["US"], residenceCountry: "NG" }))).toBe("US");
    expect(targetCountry(job({ remoteScope: "restricted", countries: ["GB", "NG"], residenceCountry: "NG" }))).toBe("NG");
  });
});

describe("work authorization and sponsorship per country", () => {
  it("answers yes for a worldwide job done from Nigeria", () => {
    expect(resolveProfileAnswer("work_authorization", lagos, job())?.display).toBe("Yes");
    expect(resolveProfileAnswer("sponsorship", lagos, job())?.display).toBe("No");
  });
  it("answers no for a US on-site job and says sponsorship is needed", () => {
    const us = job({ remoteScope: "onsite", countries: ["US"] });
    expect(resolveProfileAnswer("work_authorization", lagos, us)?.display).toBe("No");
    expect(resolveProfileAnswer("sponsorship", lagos, us)?.display).toBe("Yes");
  });
  it("respects explicit sponsorship countries", () => {
    const answers = { ...lagos, work_authorization: { countries: ["NG", "GB"] }, sponsorship: { countries: ["GB"] } };
    expect(resolveProfileAnswer("sponsorship", answers, job({ remoteScope: "onsite", countries: ["GB"] }))?.display).toBe("Yes");
  });
  it("falls back to legacy booleans", () => {
    const answers = withLegacyAnswers({}, { work_authorized: true, requires_visa_sponsorship: false });
    expect(resolveProfileAnswer("work_authorization", answers, job({ remoteScope: "onsite", countries: ["US"] }))?.display).toBe("Yes");
    expect(resolveProfileAnswer("sponsorship", answers, job())?.display).toBe("No");
  });
  it("is unknown without any authorization answer", () => {
    expect(resolveProfileAnswer("work_authorization", {}, job())).toBeNull();
  });
});

describe("other keys", () => {
  it("resolves notice period, salary and past employers", () => {
    const answers = {
      notice_period: { days: 30, negotiable: true },
      current_salary: { text: "50000 USD per year" },
      past_employers: { items: ["Canonical Ltd"] },
    };
    expect(resolveProfileAnswer("notice_period", answers, job())?.display).toBe("30 days (negotiable)");
    expect(resolveProfileAnswer("current_salary", answers, job())?.display).toBe("50000 USD per year");
    expect(resolveProfileAnswer("previously_employed", answers, job({ company: "Stripe" }))?.display).toBe("No");
  });
  it("only ticks consent and drafts motivation with opt-in", () => {
    expect(resolveProfileAnswer("privacy_consent", {}, job())).toBeNull();
    expect(resolveProfileAnswer("privacy_consent", { permissions: { consent: true } }, job())?.display).toBe("Yes");
    expect(resolveProfileAnswer("why_company", { permissions: { ai_motivation: false } }, job())).toBeNull();
    expect(resolveProfileAnswer("why_company", { permissions: { ai_motivation: true } }, job())?.display).toBe("AI draft");
  });
  it("treats account fields as answerable", () => {
    expect(isAnswerable("email", {}, job())).toBe(true);
    expect(isAnswerable("notice_period", {}, job())).toBe(false);
  });
});
