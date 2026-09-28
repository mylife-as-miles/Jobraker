import type { WorkEligibility } from "@/services/profile/workEligibility";

// Countries offered in the Jobs page "Can work from" picker. Codes match the
// ATS index country detection (backend/supabase/shared/ats/location.ts).
export const WORKABLE_FROM_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "", label: "From my profile location" },
  { code: "ANY", label: "Anywhere (no country filter)" },
  { code: "NG", label: "Nigeria" },
  { code: "KE", label: "Kenya" },
  { code: "ZA", label: "South Africa" },
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "ES", label: "Spain" },
  { code: "PT", label: "Portugal" },
  { code: "PL", label: "Poland" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "MX", label: "Mexico" },
  { code: "BR", label: "Brazil" },
  { code: "AR", label: "Argentina" },
  { code: "IN", label: "India" },
  { code: "SG", label: "Singapore" },
  { code: "JP", label: "Japan" },
  { code: "AU", label: "Australia" },
];

// Question keys auto-apply can always fill: from the profile/resume, or
// drafted for the user (cover letter, "why us").
const ALWAYS_COVERED = new Set([
  "first_name", "last_name", "preferred_name", "email", "phone", "resume", "cover_letter",
  "linkedin", "github", "website_portfolio", "location_current", "country_residence", "why_company",
]);

// Keys answered by the Work eligibility answers when they are saved.
const ELIGIBILITY_KEYS: Record<string, keyof WorkEligibility> = {
  work_authorization: "work_authorized",
  sponsorship: "requires_visa_sponsorship",
  expected_salary: "desired_salary",
  security_clearance: "has_security_clearance",
  relocation: "willing_to_relocate",
};

const LABELS: Record<string, string> = {
  work_authorization: "Work authorization",
  sponsorship: "Visa sponsorship",
  expected_salary: "Expected salary",
  current_salary: "Current salary",
  security_clearance: "Security clearance",
  relocation: "Relocation",
  notice_period: "Notice period / start date",
  how_heard: "How you heard about the job",
  previously_employed: "Worked here before",
  employee_relationship: "Relationships with employees",
  language: "Languages",
  years_experience: "Years of experience",
  education: "Education",
  employer_current: "Current employer",
  title_current: "Current title",
  non_compete: "Non-compete",
  background_check: "Background check consent",
  privacy_consent: "Privacy consent",
  truth_certification: "Certify application is true",
  onsite_hybrid: "On-site / hybrid willingness",
  work_country: "Country you will work from",
  referred_by: "Referral",
  pronouns: "Pronouns",
  age_18: "Over 18",
  accommodation: "Accommodation needs",
  government_official: "Government official",
  future_openings_optin: "Future openings opt-in",
};

export type Readiness =
  | { state: "unknown" }
  | { state: "ready" }
  | { state: "needs"; missing: string[] };

// Compares a job's required application questions (stored by the ATS index
// discovery in raw_data.ats) with what the user has already answered.
export function getAutoApplyReadiness(
  rawData: unknown,
  eligibility: WorkEligibility | null,
): Readiness {
  const ats = (rawData as { ats?: { questions_known?: boolean; required_question_keys?: unknown } } | null)?.ats;
  if (!ats?.questions_known || !Array.isArray(ats.required_question_keys)) return { state: "unknown" };
  const missing: string[] = [];
  for (const key of ats.required_question_keys) {
    if (typeof key !== "string" || ALWAYS_COVERED.has(key)) continue;
    const field = ELIGIBILITY_KEYS[key];
    if (field) {
      const value = eligibility?.[field];
      const answered = typeof value === "boolean" || (typeof value === "string" && value.trim().length > 0);
      if (answered) continue;
    }
    missing.push(LABELS[key] ?? key.replace(/_/g, " "));
  }
  return missing.length ? { state: "needs", missing: [...new Set(missing)] } : { state: "ready" };
}
