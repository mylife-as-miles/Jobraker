import { createClient } from "../../lib/supabaseClient";

// Answers auto-apply treats as critical. apply-to-jobs reads them from the
// profile; without them every Autopilot run is saved as a draft for review.
export type WorkEligibility = {
  work_authorized: boolean | null;
  requires_visa_sponsorship: boolean | null;
  desired_salary: string | null;
  has_security_clearance: boolean | null;
  willing_to_relocate: boolean | null;
};

export const EMPTY_WORK_ELIGIBILITY: WorkEligibility = {
  work_authorized: null,
  requires_visa_sponsorship: null,
  desired_salary: null,
  has_security_clearance: null,
  willing_to_relocate: null,
};

const COLUMNS =
  "work_authorized,requires_visa_sponsorship,desired_salary,has_security_clearance,willing_to_relocate";

export const DESIRED_SALARY_MAX_LENGTH = 120;

export function isWorkEligibilityComplete(value: WorkEligibility): boolean {
  return (
    typeof value.work_authorized === "boolean" &&
    typeof value.requires_visa_sponsorship === "boolean" &&
    typeof value.has_security_clearance === "boolean" &&
    typeof value.willing_to_relocate === "boolean" &&
    typeof value.desired_salary === "string" &&
    value.desired_salary.trim().length > 0
  );
}

const asBool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

// Returns null when the answers cannot be read (signed out, or the columns
// do not exist yet). Callers must treat null as "unknown" and not block.
export async function fetchWorkEligibility(): Promise<WorkEligibility | null> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select(COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    work_authorized: asBool(data.work_authorized),
    requires_visa_sponsorship: asBool(data.requires_visa_sponsorship),
    desired_salary:
      typeof data.desired_salary === "string" && data.desired_salary.trim()
        ? data.desired_salary.trim()
        : null,
    has_security_clearance: asBool(data.has_security_clearance),
    willing_to_relocate: asBool(data.willing_to_relocate),
  };
}

export async function saveWorkEligibility(value: WorkEligibility): Promise<void> {
  const supabase = createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("You need to be signed in to save these answers.");

  const desiredSalary = value.desired_salary?.trim().slice(0, DESIRED_SALARY_MAX_LENGTH) || null;
  const { error } = await (supabase as any)
    .from("profiles")
    .update({
      work_authorized: value.work_authorized,
      requires_visa_sponsorship: value.requires_visa_sponsorship,
      desired_salary: desiredSalary,
      has_security_clearance: value.has_security_clearance,
      willing_to_relocate: value.willing_to_relocate,
      work_eligibility_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(error.message || "Could not save your answers.");
}
