import { createClient } from "../../lib/supabaseClient";
import { countryFromText } from "../../lib/bulkApplyPlan";
import {
  REQUIRED_PROFILE_KEYS,
  resolveProfileAnswer,
  withLegacyAnswers,
  type ProfileAnswers,
} from "../../../backend/supabase/shared/application-profile";
import { fetchWorkEligibility, saveWorkEligibility } from "./workEligibility";

export type { ProfileAnswers };

async function currentUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data?.session?.user?.id ?? null;
}

// Stored answers, keyed by canonical question key.
export async function loadApplicationProfile(): Promise<ProfileAnswers> {
  const userId = await currentUserId();
  if (!userId) return {};
  const { data, error } = await (createClient() as any)
    .from("application_profile_answers")
    .select("key, value")
    .eq("user_id", userId);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((row: { key: string; value: unknown }) => [row.key, row.value]));
}

// Suggested answers for keys the user has not saved yet, from the legacy
// eligibility answers, profile location and work history. Shown for review.
export async function loadProfilePrefill(): Promise<ProfileAnswers> {
  const supabase = createClient() as any;
  const userId = await currentUserId();
  if (!userId) return {};
  const [legacy, profileRes, expRes, eduRes] = await Promise.all([
    fetchWorkEligibility().catch(() => null),
    supabase.from("profiles").select("location").eq("id", userId).maybeSingle(),
    supabase.from("profile_experiences").select("title, company, start_date, end_date, is_current").eq("user_id", userId).order("start_date", { ascending: false }),
    supabase.from("profile_education").select("degree, school").eq("user_id", userId).order("start_date", { ascending: false }).limit(1),
  ]);
  const out: ProfileAnswers = {};
  const residence = countryFromText(profileRes?.data?.location ?? null);
  if (residence) out.country_residence = { country: residence };
  if (legacy) {
    if (legacy.work_authorized === true && residence) out.work_authorization = { countries: [residence] };
    if (typeof legacy.willing_to_relocate === "boolean") out.relocation = { willing: legacy.willing_to_relocate };
    if (typeof legacy.has_security_clearance === "boolean") out.security_clearance = { has: legacy.has_security_clearance };
    if (legacy.desired_salary) out.expected_salary = { text: legacy.desired_salary };
  }
  const experiences: any[] = expRes?.data ?? [];
  const latest = experiences.find((e) => e.is_current) ?? experiences[0];
  if (latest?.company) out.employer_current = { text: String(latest.company) };
  if (latest?.title) out.title_current = { text: String(latest.title) };
  const companies = [...new Set(experiences.map((e) => String(e.company ?? "").trim()).filter(Boolean))];
  if (companies.length) out.past_employers = { items: companies };
  const starts = experiences.map((e) => Date.parse(e.start_date)).filter((t) => Number.isFinite(t));
  if (starts.length) {
    const years = Math.max(0, Math.floor((Date.now() - Math.min(...starts)) / (365.25 * 24 * 3600 * 1000)));
    out.years_experience = { years };
  }
  const edu = eduRes?.data?.[0];
  if (edu?.degree || edu?.school) out.education = { text: [edu.degree, edu.school].filter(Boolean).join(", ") };
  return out;
}

// Saves answers and keeps the legacy eligibility columns in step, so existing
// checks (Autopilot gate, fallbacks) agree with the new profile.
export async function saveApplicationProfile(answers: ProfileAnswers): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error("You need to be signed in to save your profile.");
  const now = new Date().toISOString();
  const rows = Object.entries(answers)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ({ user_id: userId, key, value, source: "user", updated_at: now }));
  if (rows.length) {
    const { error } = await (createClient() as any)
      .from("application_profile_answers")
      .upsert(rows, { onConflict: "user_id,key" });
    if (error) throw new Error(error.message || "Could not save your profile.");
  }

  const home = { company: null, countries: [], remoteScope: "worldwide", residenceCountry: answers.country_residence?.country ?? null };
  const asBool = (key: string) => {
    const r = resolveProfileAnswer(key, answers, home);
    return r && typeof r.value === "boolean" ? r.value : null;
  };
  await saveWorkEligibility({
    work_authorized: asBool("work_authorization"),
    requires_visa_sponsorship: asBool("sponsorship"),
    desired_salary: answers.expected_salary?.text ?? null,
    has_security_clearance: typeof answers.security_clearance?.has === "boolean" ? answers.security_clearance.has : null,
    willing_to_relocate: typeof answers.relocation?.willing === "boolean" ? answers.relocation.willing : null,
  }).catch(() => undefined);
}

// Required answers still missing, for the progress meter and auto-apply gate.
export function missingRequiredKeys(answers: ProfileAnswers): string[] {
  const home = { company: null, countries: [], remoteScope: "worldwide", residenceCountry: answers.country_residence?.country ?? null };
  const merged = withLegacyAnswers(answers, null);
  return REQUIRED_PROFILE_KEYS.filter((key) => resolveProfileAnswer(key, merged, home) === null);
}
