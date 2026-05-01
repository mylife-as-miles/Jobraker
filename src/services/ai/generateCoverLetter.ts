import { invokeProtectedFunction } from "../supabase/invokeProtectedFunction";

export async function generateCoverLetterViaEdge(opts: {
  jobDescription: string;
  resumeText: string;
  instructions?: string;
  includeCandidateMemory?: boolean;
}) {
  const data = await invokeProtectedFunction<{ cover_letter?: string }>(
    "generate-cover-letter",
    {
      body: opts,
    },
  );

  return String(data?.cover_letter || "");
}
