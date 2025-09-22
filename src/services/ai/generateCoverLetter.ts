import { createClient } from "@/lib/supabaseClient";

export async function generateCoverLetterViaEdge(opts: {
  role?: string;
  company?: string;
  recipient?: string;
  job_description?: string;
  tone?: 'professional' | 'friendly' | 'enthusiastic';
  length?: 'short' | 'medium' | 'long';
}) {
  const supabase = createClient();
  const { data, error } = await (supabase as any).functions.invoke('generate-cover-letter', {
    body: opts,
  });
  if (error) throw new Error(error?.message || 'Failed to generate cover letter');
  return String(data?.text || '');
}
