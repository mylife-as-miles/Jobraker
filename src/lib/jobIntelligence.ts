import { supabase } from "@/lib/supabaseClient";
import { captureClientEvent } from "@/lib/analytics";

export const JOB_FEEDBACK_LABELS = [
  "relevant",
  "not_relevant",
  "low_quality",
  "duplicate",
  "already_applied",
  "good_fit",
] as const;

export type JobFeedbackLabel = (typeof JOB_FEEDBACK_LABELS)[number];

export const JOB_FEEDBACK_COPY: Record<JobFeedbackLabel, string> = {
  relevant: "Relevant",
  not_relevant: "Not relevant",
  low_quality: "Low quality",
  duplicate: "Duplicate",
  already_applied: "Already applied",
  good_fit: "Good fit",
};

export async function submitJobFeedback(
  jobId: string,
  label: JobFeedbackLabel,
  notes?: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to rate jobs.");
  }

  const { error } = await supabase.from("job_feedback").upsert(
    {
      user_id: user.id,
      job_id: jobId,
      label,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,job_id,label" },
  );

  if (error) {
    throw new Error(error.message || "Failed to save job feedback.");
  }

  captureClientEvent("job_feedback_added", {
    job_id: jobId,
    label,
  });
}

const firstNonEmpty = (...values: Array<string | null | undefined>) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0)
    ?.trim() ?? null;

export async function saveApplicationPackage(input: {
  jobId: string;
  applicationId?: string | null;
  tailoredResume?: string | null;
  coverLetter?: string | null;
  fitBullets?: string[];
  metadata?: Record<string, unknown>;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to save an application package.");
  }

  const { data: latestPackage, error: latestError } = await supabase
    .from("application_packages")
    .select("version")
    .eq("user_id", user.id)
    .eq("job_id", input.jobId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw new Error(latestError.message || "Failed to load package version.");
  }

  const version =
    typeof latestPackage?.version === "number" ? latestPackage.version + 1 : 1;

  const { error } = await supabase.from("application_packages").insert({
    user_id: user.id,
    job_id: input.jobId,
    application_id: input.applicationId ?? null,
    status: "draft",
    tailored_resume: firstNonEmpty(input.tailoredResume),
    cover_letter: firstNonEmpty(input.coverLetter),
    fit_bullets: input.fitBullets ?? [],
    version,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message || "Failed to save application package.");
  }

  captureClientEvent("application_package_created", {
    job_id: input.jobId,
    application_id: input.applicationId ?? undefined,
    version,
    has_resume: Boolean(input.tailoredResume),
    has_cover_letter: Boolean(input.coverLetter),
  });
}
