import { isAnswerable, type ProfileAnswers } from "../../backend/supabase/shared/application-profile";

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
  why_company: "Why this company (turn on AI answers)",
  country_residence: "Country you live in",
};

export type Readiness =
  | { state: "unknown" }
  | { state: "ready" }
  | { state: "needs"; missing: string[] };

// Compares a job's required application questions (stored by the ATS index
// discovery in raw_data.ats) with the user's application profile, resolved for
// this job's country and company by the same resolver apply-to-jobs uses.
export function getAutoApplyReadiness(
  job: { raw_data?: unknown; company?: string | null },
  answers: ProfileAnswers | null,
  residenceCountry: string | null = null,
): Readiness {
  const ats = (job.raw_data as {
    ats?: { questions_known?: boolean; required_question_keys?: unknown; countries?: unknown; remote_scope?: unknown };
  } | null)?.ats;
  if (!ats?.questions_known || !Array.isArray(ats.required_question_keys)) return { state: "unknown" };
  const facts = {
    company: job.company ?? null,
    countries: Array.isArray(ats.countries) ? (ats.countries as string[]) : [],
    remoteScope: typeof ats.remote_scope === "string" ? ats.remote_scope : null,
    residenceCountry,
  };
  const missing: string[] = [];
  for (const key of ats.required_question_keys) {
    if (typeof key !== "string" || isAnswerable(key, answers ?? {}, facts)) continue;
    missing.push(LABELS[key] ?? key.replace(/_/g, " "));
  }
  return missing.length ? { state: "needs", missing: [...new Set(missing)] } : { state: "ready" };
}
