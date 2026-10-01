// Application profile: stored answers and how they resolve for a given job.
// Pure TypeScript (no Deno or browser APIs), shared by apply-to-jobs and the
// app so both agree on what is answered.
//
// Stored value shapes (application_profile_answers.value), by key:
//   work_authorization   { countries: string[] }       countries the user may work in (ISO-2)
//   sponsorship          { countries: string[] }       countries where the user would need sponsorship
//   country_residence    { country: string }           ISO-2
//   relocation           { willing: boolean }
//   onsite_hybrid        { willing: boolean }
//   security_clearance   { has: boolean }
//   current_salary       { text: string }              e.g. "60000 USD per year"
//   expected_salary      { text: string }
//   notice_period        { days: number, negotiable: boolean }
//   how_heard            { text: string }
//   years_experience     { years: number }
//   education            { text: string }
//   language             { text: string }              e.g. "English (fluent), French (basic)"
//   employer_current     { text: string }
//   title_current        { text: string }
//   past_employers       { items: string[] }           answers "worked for X before?"
//   non_compete          { bound: boolean, details?: string }
//   background_check     { consent: boolean }
//   age_18               { over18: boolean }
//   preferred_name       { text: string }
//   pronouns             { text: string }
//   accommodation        { text: string }
//   government_official  { is: boolean }
//   employee_relationship{ has: boolean }
//   permissions          { consent: boolean, ai_motivation: boolean, future_openings: boolean }
//   demographics         { gender?: string, race?: string, veteran?: string, disability?: string }
// Legacy (profiles columns, used until the user saves the new profile):
//   work_authorization / sponsorship / relocation / security_clearance as { legacy: boolean },
//   expected_salary as { text }.

export type ProfileAnswers = Record<string, any>;

export type JobFacts = {
  company: string | null;
  // ISO-2 countries the job is tied to (office or allowed remote countries).
  countries: string[];
  remoteScope: string | null;
  // Where the candidate lives; a worldwide remote job is done from here.
  residenceCountry: string | null;
};

export type ResolvedAnswer = { value: string | boolean | number; display: string };

// Answered from the resume / account rather than this profile.
export const ACCOUNT_KEYS = new Set([
  "first_name", "last_name", "email", "phone", "resume", "cover_letter", "linkedin", "github",
  "website_portfolio", "location_current",
]);

// Must be answered before any auto-apply (Phase 3 decision 2).
export const REQUIRED_PROFILE_KEYS = [
  "country_residence", "work_authorization", "sponsorship", "expected_salary", "current_salary", "notice_period",
];

const yesNo = (b: boolean): ResolvedAnswer => ({ value: b, display: b ? "Yes" : "No" });
const text = (v: unknown): ResolvedAnswer | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? { value: t, display: t } : null;
};
const bool = (v: unknown): ResolvedAnswer | null => (typeof v === "boolean" ? yesNo(v) : null);
const codes = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
const normCompany = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The country a job would be done from, for country-specific questions.
export function targetCountry(job: JobFacts): string | null {
  const residence = job.residenceCountry?.toUpperCase() ?? null;
  if (job.remoteScope === "worldwide") return residence;
  const countries = codes(job.countries);
  if (residence && countries.includes(residence)) return residence;
  // No location data (non-index jobs): assume the user works from home.
  return countries[0] ?? residence;
}

// Generic question wording for jobs whose own questions are not known, so the
// agent can use the profile answers if the form asks.
export const PROFILE_QUESTION_LABELS: Record<string, string> = {
  current_salary: "What is your current salary?",
  notice_period: "What is your notice period / earliest start date?",
  how_heard: "How did you hear about this job?",
  years_experience: "How many years of relevant experience do you have?",
  education: "What is your highest level of education?",
  language: "Which languages do you speak, and how well?",
  employer_current: "Who is your current or most recent employer?",
  title_current: "What is your current or most recent job title?",
  previously_employed: "Have you worked for this company before?",
  onsite_hybrid: "Are you willing to work on-site or hybrid if required?",
  non_compete: "Are you bound by a non-compete agreement?",
  background_check: "Do you consent to a background check?",
  age_18: "Are you at least 18 years old?",
  preferred_name: "What name would you like us to use?",
  pronouns: "What are your pronouns?",
  accommodation: "Do you need any accommodation during the hiring process?",
  government_official: "Are you a government or public official?",
  employee_relationship: "Do you have a close relationship with a current employee?",
  privacy_consent: "Do you accept the privacy notice and data processing?",
  truth_certification: "Do you certify that the information provided is true and complete?",
  future_openings_optin: "May we contact you about future openings?",
  why_company: "Why do you want to work at this company?",
};

// Answer category used by the application package readiness rules.
export function profileAnswerCategory(key: string): string {
  if (key === "work_authorization") return "work_authorization";
  if (key === "sponsorship") return "sponsorship";
  if (key === "current_salary" || key === "expected_salary") return "salary";
  if (key === "relocation") return "relocation";
  if (key === "security_clearance") return "security_clearance";
  if (key === "previously_employed") return "prior_employment";
  if (key === "years_experience") return "experience";
  if (["non_compete", "background_check", "privacy_consent", "truth_certification", "age_18", "government_official"].includes(key)) return "legal";
  return "general";
}

function residence(answers: ProfileAnswers, job: JobFacts): JobFacts {
  const stored = answers.country_residence?.country;
  return typeof stored === "string" && /^[A-Za-z]{2}$/.test(stored)
    ? { ...job, residenceCountry: stored.toUpperCase() }
    : job;
}

function authorizedFor(answers: ProfileAnswers, country: string | null): boolean | null {
  const wa = answers.work_authorization;
  if (wa && Array.isArray(wa.countries)) return country ? codes(wa.countries).includes(country) : null;
  if (typeof wa?.legacy === "boolean") return wa.legacy;
  return null;
}

// Resolves one canonical question key to a concrete answer for this job, or
// null when the profile cannot answer it (the run would have to ask).
export function resolveProfileAnswer(key: string, answers: ProfileAnswers, jobIn: JobFacts): ResolvedAnswer | null {
  const job = residence(answers, jobIn);
  const a = answers[key];
  switch (key) {
    case "work_authorization": {
      const ok = authorizedFor(answers, targetCountry(job));
      return ok === null ? null : yesNo(ok);
    }
    case "sponsorship": {
      const country = targetCountry(job);
      const sp = answers.sponsorship;
      if (sp && Array.isArray(sp.countries) && country) {
        if (codes(sp.countries).includes(country)) return yesNo(true);
        const ok = authorizedFor(answers, country);
        return ok === null ? yesNo(false) : yesNo(!ok);
      }
      if (typeof sp?.legacy === "boolean") return yesNo(sp.legacy);
      const ok = authorizedFor(answers, country);
      return ok === null ? null : yesNo(!ok);
    }
    case "country_residence":
    case "work_country": {
      const c = job.residenceCountry;
      return c ? { value: c, display: c } : null;
    }
    case "relocation":
    case "onsite_hybrid":
      return bool(a?.willing) ?? bool(a?.legacy);
    case "security_clearance":
      return bool(a?.has) ?? bool(a?.legacy);
    case "current_salary":
    case "expected_salary":
    case "how_heard":
    case "education":
    case "language":
    case "employer_current":
    case "title_current":
    case "preferred_name":
    case "pronouns":
    case "accommodation":
      return text(a?.text);
    case "notice_period": {
      if (typeof a?.days !== "number" || !Number.isFinite(a.days) || a.days < 0) return null;
      const d = Math.round(a.days);
      const display = `${d} days${a.negotiable ? " (negotiable)" : ""}`;
      return { value: display, display };
    }
    case "years_experience":
      return typeof a?.years === "number" && a.years >= 0 ? { value: a.years, display: String(a.years) } : null;
    case "previously_employed": {
      const past = answers.past_employers;
      if (!Array.isArray(past?.items)) return null;
      const company = normCompany(job.company);
      return yesNo(Boolean(company) && past.items.some((p: unknown) => normCompany(p) === company));
    }
    case "non_compete":
      return bool(a?.bound);
    case "background_check":
      return bool(a?.consent);
    case "age_18":
      return bool(a?.over18);
    case "government_official":
      return bool(a?.is);
    case "employee_relationship":
      return bool(a?.has);
    case "privacy_consent":
    case "truth_certification":
      return answers.permissions?.consent === true ? yesNo(true) : null;
    case "future_openings_optin":
      return typeof answers.permissions?.future_openings === "boolean" ? yesNo(answers.permissions.future_openings) : null;
    case "why_company":
      // Drafted by the agent from the resume and job, only with opt-in.
      return answers.permissions?.ai_motivation === true
        ? { value: "Draft a short, specific answer from the candidate's resume and this job.", display: "AI draft" }
        : null;
    default:
      return null;
  }
}

// Keys the profile can answer for this job (for readiness checks).
export function isAnswerable(key: string, answers: ProfileAnswers, job: JobFacts): boolean {
  return ACCOUNT_KEYS.has(key) || resolveProfileAnswer(key, answers, job) !== null;
}

// Merges the legacy profiles columns in as fallbacks for keys the user has not
// saved in the application profile yet.
export function withLegacyAnswers(
  answers: ProfileAnswers,
  legacy: {
    work_authorized?: boolean | null;
    requires_visa_sponsorship?: boolean | null;
    desired_salary?: string | null;
    has_security_clearance?: boolean | null;
    willing_to_relocate?: boolean | null;
  } | null,
): ProfileAnswers {
  if (!legacy) return answers;
  const out: ProfileAnswers = { ...answers };
  if (!out.work_authorization && typeof legacy.work_authorized === "boolean") out.work_authorization = { legacy: legacy.work_authorized };
  if (!out.sponsorship && typeof legacy.requires_visa_sponsorship === "boolean") out.sponsorship = { legacy: legacy.requires_visa_sponsorship };
  if (!out.expected_salary && legacy.desired_salary?.trim()) out.expected_salary = { text: legacy.desired_salary.trim() };
  if (!out.security_clearance && typeof legacy.has_security_clearance === "boolean") out.security_clearance = { legacy: legacy.has_security_clearance };
  if (!out.relocation && typeof legacy.willing_to_relocate === "boolean") out.relocation = { legacy: legacy.willing_to_relocate };
  return out;
}
