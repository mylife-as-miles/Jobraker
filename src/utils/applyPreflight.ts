import { createClient } from '../lib/supabaseClient';

// Simple in-memory session cache (per page load)
let checked = false;
let hasProfile = false;
let hasResume = false;

export async function ensureApplyReadiness(): Promise<{ ok: boolean; profile: boolean; resume: boolean; }> {
  // Hooks can't be used here (not a React component). We'll create a minimal ad-hoc toaster by dispatching a custom event.
  const notify = (title: string, description: string) => {
    try {
      const ev = new CustomEvent('toast', { detail: { title, description } });
      window.dispatchEvent(ev);
    } catch {}
  };
  if (checked) {
    if (!hasProfile || !hasResume) {
      if (!hasProfile) notify('Profile incomplete', 'Add your profile details for better applications.');
      if (!hasResume) notify('No resume uploaded', 'Upload a resume to auto-attach it.');
    }
    return { ok: hasProfile && hasResume, profile: hasProfile, resume: hasResume };
  }
  const supabase = createClient();
  try {
    const { data: { user } } = await (supabase as any).auth.getUser();
    if (!user) return { ok: false, profile: false, resume: false };
    const uid = user.id;
    const { data: prof } = await (supabase as any)
      .from('profiles')
      .select('id,first_name,last_name,job_title,experience_years,location')
      .eq('id', uid)
      .maybeSingle();
    hasProfile = !!prof && !!(prof.first_name || prof.last_name || prof.job_title);
    const { data: resumes } = await (supabase as any)
      .from('resumes')
      .select('id,file_path')
      .eq('user_id', uid)
      .not('file_path', 'is', null)
      .limit(1);
    hasResume = Array.isArray(resumes) && resumes.length > 0;
  } catch (_) {
    // ignore
  } finally {
    checked = true;
  }
  if (!hasProfile) notify('Profile incomplete', 'Add your profile details for better applications.');
  if (!hasResume) notify('No resume uploaded', 'Upload a resume to auto-attach it.');
  return { ok: hasProfile && hasResume, profile: hasProfile, resume: hasResume };
}
