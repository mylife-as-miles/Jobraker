import { createClient } from "@/lib/supabaseClient";

export async function generateCoverLetterViaEdge(opts: {
  jobDescription: string;
  resumeText: string;
  instructions?: string;
}) {
  const supabase = createClient();
  const { data, error } = await (supabase as any).functions.invoke('generate-cover-letter', {
    body: opts,
  });
  if (error) throw new Error(error?.message || 'Failed to generate cover letter');
  return String(data?.cover_letter || '');
}
