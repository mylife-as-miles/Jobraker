import { createClient } from './supabaseClient';
import { hashEmbedding } from '@/utils/hashEmbedding';
import { events } from '@/lib/analytics';

export interface ResumeVersionRecord {
  id: string;
  resume_id: string;
  user_id: string;
  parent_id: string | null;
  storage_path: string;
  sha256: string;
  parsed_snapshot: any | null;
  diff_meta: { approx_added?: number; approx_removed?: number } | null;
  created_at: string;
}

// Naive text diff approximation: line counts difference
function approximateDiff(prevText: string | null, nextText: string) {
  if (!prevText) return { approx_added: nextText.split(/\n/).length, approx_removed: 0 };
  const prevLines = prevText.split(/\n/);
  const nextLines = nextText.split(/\n/);
  return {
    approx_added: Math.max(0, nextLines.length - prevLines.length),
    approx_removed: Math.max(0, prevLines.length - nextLines.length),
  };
}

export async function createResumeVersion(opts: {
  resumeId: string;
  userId: string;
  parentId?: string | null;
  storagePath: string;
  rawText?: string; // optional to compute hash if not yet stored binary hash
  parsedSnapshot?: any;
  previousRawText?: string | null;
}): Promise<ResumeVersionRecord | null> {
  const supabase = createClient();
  try {
    let sha = ''.padEnd(64, '0');
    if (opts.rawText) {
      // Reuse embedding vector -> compact deterministic hash (non-crypto): take first 32 dims scaled & hex encoded
      const vec = hashEmbedding(opts.rawText, 64); // 64 dims for direct mapping
      const hex = vec
        .slice(0, 32)
        .map(v => {
          const n = Math.min(255, Math.max(0, Math.round(v * 255)));
          return n.toString(16).padStart(2, '0');
        })
        .join('');
      sha = (hex + '0'.repeat(64)).slice(0,64);
    }
    const diff = approximateDiff(opts.previousRawText || null, opts.rawText || '');
    const { data, error } = await (supabase as any)
      .from('resume_versions')
      .insert({
        resume_id: opts.resumeId,
        user_id: opts.userId,
        parent_id: opts.parentId || null,
        storage_path: opts.storagePath,
        sha256: sha,
        parsed_snapshot: opts.parsedSnapshot || null,
        diff_meta: diff,
      })
      .select('*')
      .single();
    if (error) throw error;
    events.resumeVersionCreated(opts.resumeId, !!opts.parentId, diff.approx_added, diff.approx_removed);
    return data as ResumeVersionRecord;
  } catch (e) {
    console.warn('createResumeVersion failed', e);
    try { events.resumeVersionCreateFailed(opts?.resumeId, (e as any)?.name || (e as any)?.message || 'error'); } catch {}
    return null;
  }
}

export async function listResumeVersions(resumeId: string): Promise<ResumeVersionRecord[]> {
  const supabase = createClient();
  const { data, error } = await (supabase as any)
    .from('resume_versions')
    .select('*')
    .eq('resume_id', resumeId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('listResumeVersions failed', error);
    return [];
  }
  return (data || []) as ResumeVersionRecord[];
}

export async function latestResumeVersion(resumeId: string): Promise<ResumeVersionRecord | null> {
  const list = await listResumeVersions(resumeId);
  return list[0] || null;
}
