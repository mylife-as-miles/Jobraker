import { createClient } from "@/lib/supabaseClient";

export async function tailorResumeViaEdge(opts: {
  jobDescription: string;
  resumeText: string;
  instructions?: string;
}) {
  const supabase = createClient();
  const { data, error } = await (supabase as any).functions.invoke('tailor-resume', {
    body: opts,
  });
  if (error) throw new Error(error?.message || 'Failed to tailor resume');
  return String(data?.tailored_resume || '');
}
