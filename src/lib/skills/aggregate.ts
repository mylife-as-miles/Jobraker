import { createClient } from '@/lib/supabaseClient';

export interface SkillFrequency { skill: string; count: number }

export async function aggregateSkillFrequencies(userId: string): Promise<SkillFrequency[]> {
  const supabase = createClient();
  const { data, error } = await (supabase as any)
    .from('parsed_resumes')
    .select('skills, user_id')
    .eq('user_id', userId);
  if (error) { console.warn('aggregateSkillFrequencies failed', error); return []; }
  const counts: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    (row.skills || []).forEach((s: string) => {
      counts[s] = (counts[s] || 0) + 1;
    });
  });
  return Object.entries(counts).map(([skill, count]) => ({ skill, count })).sort((a,b) => b.count - a.count);
}