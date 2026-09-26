import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EMPTY_WORK_ELIGIBILITY,
  isWorkEligibilityComplete,
  type WorkEligibility,
} from "@/services/profile/workEligibility";

const answered: WorkEligibility = {
  work_authorized: true,
  requires_visa_sponsorship: false,
  desired_salary: "90000 USD per year",
  has_security_clearance: false,
  willing_to_relocate: false,
};

describe("isWorkEligibilityComplete", () => {
  it("is false when nothing is answered", () => {
    expect(isWorkEligibilityComplete(EMPTY_WORK_ELIGIBILITY)).toBe(false);
  });

  it("is true when every answer is present, including 'No' answers", () => {
    expect(isWorkEligibilityComplete(answered)).toBe(true);
  });

  it("is false when any single answer is missing", () => {
    for (const key of Object.keys(answered) as Array<keyof WorkEligibility>) {
      expect(isWorkEligibilityComplete({ ...answered, [key]: null })).toBe(false);
    }
  });

  it("treats a blank salary as missing", () => {
    expect(isWorkEligibilityComplete({ ...answered, desired_salary: "   " })).toBe(false);
  });
});

describe("apply-to-jobs eligibility contract", () => {
  const source = readFileSync(
    resolve(process.cwd(), "backend/supabase/functions/apply-to-jobs/index.ts"),
    "utf8",
  );

  it("reads the saved answers from the profile in a separate query", () => {
    expect(source).toMatch(
      /\.select\("work_authorized,requires_visa_sponsorship,desired_salary,has_security_clearance,willing_to_relocate"\)/,
    );
  });

  it("falls back to the profile when the request has no answer", () => {
    expect(source).toMatch(/requestWorkAuthVal \?\? profileWorkAuthorized/);
    expect(source).toMatch(/requestSponsorshipVal \?\? profileRequiresSponsorship/);
    expect(source).toMatch(/security_clearance \?\? profileHasClearance/);
    expect(source).toMatch(/willing_to_relocate \?\? profileWillingToRelocate/);
  });
});
