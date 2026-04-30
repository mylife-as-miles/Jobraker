import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export async function tailorResumeViaEdge(opts: {
  jobDescription: string;
  resumeText: string;
  instructions?: string;
  includeCandidateMemory?: boolean;
}) {
  const data = await invokeProtectedFunction<{ tailored_resume?: string }>(
    "tailor-resume",
    {
      body: opts,
    },
  );

  return String(data?.tailored_resume || "");
}
