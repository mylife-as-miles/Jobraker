import { createClient } from '../../lib/supabaseClient';

// Lightweight context assembler pulling recent applications & jobs
export interface ChatContextOptions {
  maxApplications?: number;
  maxJobs?: number;
}

export interface BuiltContext {
  applications: { id: string; company?: string; role?: string; status?: string; created_at?: string; updated_at?: string }[];
  jobs: { id: string; title?: string; company?: string; source?: string; created_at?: string }[];
  summary: string;
}

export async function buildContext(opts: ChatContextOptions = {}): Promise<BuiltContext> {
  const supabase = createClient();
  const maxApplications = opts.maxApplications ?? 10;
  const maxJobs = opts.maxJobs ?? 8;

  try {
    const [{ data: apps }, { data: jobs }] = await Promise.all([
      supabase.from('applications')
        .select('id,company,role,status,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(maxApplications),
      supabase.from('user_jobs')
        .select('id,title,company,source,created_at')
        .order('created_at', { ascending: false })
        .limit(maxJobs),
    ]);

    const applications = apps || [];
    const jobsList = jobs || [];

    const statusCounts: Record<string, number> = {};
    applications.forEach(a => { if (a.status) statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
    const statusSummary = Object.entries(statusCounts).map(([k,v])=>`${k}:${v}`).join(', ') || 'none';

    const summary = `Applications(${applications.length}) status mix: ${statusSummary}. Recent roles: ${applications.slice(0,5).map(a=>`${a.role || 'n/a'}@${a.company||'?'}` ).join('; ')}. Jobs tracked(${jobsList.length}).`;

    return { applications, jobs: jobsList, summary };
  } catch (e) {
    return { applications: [], jobs: [], summary: 'Context fetch failed.' };
  }
}
