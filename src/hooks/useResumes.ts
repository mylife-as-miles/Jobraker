import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePdfFile } from '@/utils/parsePdf';
import { analyzeResumeText } from '@/utils/analyzeResume';
import { hashEmbedding } from '@/utils/hashEmbedding';
import { createClient } from "../lib/supabaseClient";
import { useToast } from "../components/ui/toast";

export type ResumeStatus = "Active" | "Draft" | "Archived";

export interface ResumeRecord {
  id: string;
  user_id: string | null;
  name: string;
  template: string | null;
  status: ResumeStatus;
  applications: number;
  thumbnail: string | null;
  is_favorite: boolean;
  file_path: string | null;
  file_ext: string | null;
  size: number | null;
  updated_at: string;
}

type UploadInput = File | { file: File; template?: string };

export function useResumes() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError, info } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track per-file import statuses (ephemeral, not persisted)
  type ImportState = 'pending' | 'uploading' | 'done' | 'error';
  interface ImportStatus { id: string; name: string; size: number; state: ImportState; error?: string; progress: number; duplicate?: boolean; completedAt?: number }
  const [importStatuses, setImportStatuses] = useState<ImportStatus[]>([]);
  const MAX_IMPORT_STATUS = 50;
  const progressTimers = useRef<Map<string, number>>(new Map());
  // Restore from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('resume-import-statuses');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setImportStatuses(parsed.slice(0, MAX_IMPORT_STATUS));
      }
    } catch {}
  }, []);
  // Persist
  useEffect(() => {
    try {
      if (importStatuses.length) sessionStorage.setItem('resume-import-statuses', JSON.stringify(importStatuses));
      else sessionStorage.removeItem('resume-import-statuses');
    } catch {}
  }, [importStatuses]);
  const objectUrlMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = (data as any)?.user?.id ?? "local-demo";
        if (mounted) setUserId(uid);
      } catch {
        if (mounted) setUserId("local-demo");
      }
    })();
    return () => {
      mounted = false;
      // Revoke any object URLs created
      objectUrlMap.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlMap.current.clear();
    };
  }, [supabase]);

  const list = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("resumes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setResumes(data || []);
    } catch (e: any) {
      const msg = e.message || "Failed to load resumes";
      setError(msg);
      toastError("Failed to load resumes", msg);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, toastError]);

  useEffect(() => {
    if (userId) list();
  }, [userId, list]);

  const getSignedUrl = useCallback(
    async (filePath: string): Promise<string | null> => {
      if (!filePath) return null;
      try {
        const { data, error } = await (supabase as any)
          .storage
          .from("resumes")
          .createSignedUrl(filePath, 60 * 5); // 5 min
        if (error) throw error;
        return data?.signedUrl ?? null;
      } catch {
        return null;
      }
    },
    [supabase]
  );

  const upload = useCallback(
    async (input: UploadInput | UploadInput[]) => {
      if (!userId) return;
      const inputs = Array.isArray(input) ? input : [input];
      const results: ResumeRecord[] = [];
      setError(null);
      for (const it of inputs) {
        const file = (it as any).file ? (it as any).file as File : (it as File);
        const template = (it as any).template ?? null;
        const ext = file.name.split(".").pop()?.toLowerCase() || null;
        const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext ?? "bin"}`;
        try {
          const { error: upErr } = await (supabase as any)
            .storage
            .from("resumes")
            .upload(path, file, { upsert: false, contentType: file.type || undefined });
          if (upErr) throw upErr;

          const insertPayload = {
            user_id: userId,
            name: file.name.replace(/\.[^.]+$/, ""),
            template,
            status: "Draft" as ResumeStatus,
            applications: 0,
            thumbnail: null,
            is_favorite: false,
            file_path: path,
            file_ext: ext,
            size: file.size,
          };
          const { data, error: insErr } = await (supabase as any)
            .from("resumes")
            .insert(insertPayload)
            .select("*")
            .single();
          if (insErr) throw insErr;
          const rec = data as ResumeRecord;
          results.push(rec);

          // Local object URL cache for preview if needed
          const url = URL.createObjectURL(file);
          objectUrlMap.current.set(rec.id, url);
          setResumes((prev) => [rec, ...prev]);
          success("Resume uploaded", `${rec.name}.${rec.file_ext ?? ""}`);
        } catch (e: any) {
          const msg = e.message || "Upload failed";
          setError(msg);
          toastError("Upload failed", msg);
        }
      }
      return results;
    },
    [supabase, userId, success, toastError]
  );

  // Import an existing resume file (PDF/Doc or JSON) and register in resumes table.
  // For now we just upload the binary and create a Draft record; parsing/structuring can be added later.
  const importResume = useCallback(async (file: File) => {
    if (!userId) return null;
    const tempId = `single:${Date.now()}:${file.name}`;
    setImportStatuses((prev) => {
  const existingNameLower = resumes.map(r => r.name.toLowerCase());
  const baseName = file.name.replace(/\.[^.]+$/, '').toLowerCase();
  const uploading: ImportStatus = { id: tempId, name: file.name, size: file.size, state: 'uploading', progress: 0, duplicate: existingNameLower.includes(baseName) };
      const next: ImportStatus[] = [uploading, ...prev];
      return next.slice(0, MAX_IMPORT_STATUS);
    });
    // Simulated progress ticker
    const interval = window.setInterval(() => {
      setImportStatuses((s) => s.map((st) => st.id === tempId && st.state === 'uploading'
        ? { ...st, progress: Math.min(95, st.progress + Math.random() * 15) }
        : st));
    }, 350);
    progressTimers.current.set(tempId, interval);
    try {
      const MAX_MB = 8;
      if (file.size > MAX_MB * 1024 * 1024) throw new Error(`File exceeds ${MAX_MB}MB limit`);
      const rawExt = file.name.split('.').pop()?.toLowerCase() || '';
      const ext = rawExt || 'bin';
      // Optional: if JSON with embedded name/template metadata
      let inferredName = file.name.replace(/\.[^.]+$/, '');
      let template: string | null = null;
      if (ext === 'json') {
        try {
          const txt = await file.text();
            const parsed = JSON.parse(txt);
            if (parsed?.title && typeof parsed.title === 'string') inferredName = String(parsed.title).slice(0,120);
            if (parsed?.template && typeof parsed.template === 'string') template = String(parsed.template).slice(0,60);
        } catch {}
      }
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await (supabase as any).storage.from('resumes').upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const isFirst = resumes.length === 0;
      const insertPayload = {
        user_id: userId,
        name: inferredName,
        template,
        status: 'Draft' as ResumeStatus,
        applications: 0,
        thumbnail: null,
        is_favorite: isFirst,
        file_path: path,
        file_ext: ext,
        size: file.size,
      };
      const { data, error: insErr } = await (supabase as any).from('resumes').insert(insertPayload).select('*').single();
      if (insErr) throw insErr;
      const rec = data as ResumeRecord;
      setResumes((prev) => [rec, ...prev]);
      success('Resume imported', `${rec.name}.${rec.file_ext ?? ''}`);
      if (progressTimers.current.has(tempId)) {
        clearInterval(progressTimers.current.get(tempId)!);
        progressTimers.current.delete(tempId);
      }
      setImportStatuses((s) => s.map((st) => st.id === tempId ? { ...st, state: 'done', progress: 100, completedAt: Date.now() } : st));
      // Fire-and-forget PDF parsing
  if (ext === 'pdf') {
        (async () => {
          try {
            const parsed = await parsePdfFile(file);
            const analyzed = analyzeResumeText(parsed.text);
            const embedding = hashEmbedding(parsed.text);
            await (supabase as any).from('parsed_resumes').insert({
              resume_id: rec.id,
              user_id: userId,
      raw_text: parsed.text,
              json: { lines: parsed.lines, entities: analyzed.entities },
              structured: analyzed.structured,
              skills: analyzed.skills,
              embedding
            });
          } catch {}
        })();
      }
      return rec;
    } catch (e: any) {
      const msg = e.message || 'Import failed';
      setError(msg);
      toastError('Import failed', msg);
      if (progressTimers.current.has(tempId)) {
        clearInterval(progressTimers.current.get(tempId)!);
        progressTimers.current.delete(tempId);
      }
  setImportStatuses((s) => s.map((st) => st.id === tempId ? { ...st, state: 'error', error: msg, progress: st.progress || 0, completedAt: Date.now() } : st));
      return null;
    }
  }, [supabase, userId, resumes, success, toastError]);

  // Internal helper to allow passing a temp status id (defined before importMultiple to avoid temporal dead zone)
  const importResumeWithId = useCallback(async (file: File, tempId: string) => {
    if (!userId) return null;
    try {
      const MAX_MB = 8;
      if (file.size > MAX_MB * 1024 * 1024) throw new Error(`File exceeds ${MAX_MB}MB limit`);
      const rawExt = file.name.split('.').pop()?.toLowerCase() || '';
      const ext = rawExt || 'bin';
      let inferredName = file.name.replace(/\.[^.]+$/, '');
      let template: string | null = null;
      if (ext === 'json') {
        try {
          const txt = await file.text();
          const parsed = JSON.parse(txt);
          if (parsed?.title && typeof parsed.title === 'string') inferredName = String(parsed.title).slice(0,120);
          if (parsed?.template && typeof parsed.template === 'string') template = String(parsed.template).slice(0,60);
        } catch {}
      }
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await (supabase as any).storage.from('resumes').upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const isFirst = resumes.length === 0;
      const insertPayload = {
        user_id: userId,
        name: inferredName,
        template,
        status: 'Draft' as ResumeStatus,
        applications: 0,
        thumbnail: null,
        is_favorite: isFirst,
        file_path: path,
        file_ext: ext,
        size: file.size,
      };
      const { data, error: insErr } = await (supabase as any).from('resumes').insert(insertPayload).select('*').single();
      if (insErr) throw insErr;
      const rec = data as ResumeRecord;
      setResumes((prev) => [rec, ...prev]);
      success('Resume imported', `${rec.name}.${rec.file_ext ?? ''}`);
      setImportStatuses((s) => s.map((st) => st.id === tempId ? { ...st, state: 'done', completedAt: Date.now(), progress: 100 } : st));
  if (ext === 'pdf') {
        (async () => {
          try {
            const parsed = await parsePdfFile(file);
            const analyzed = analyzeResumeText(parsed.text);
            const embedding = hashEmbedding(parsed.text);
            await (supabase as any).from('parsed_resumes').insert({
              resume_id: rec.id,
              user_id: userId,
      raw_text: parsed.text,
              json: { lines: parsed.lines, entities: analyzed.entities },
              structured: analyzed.structured,
              skills: analyzed.skills,
              embedding
            });
          } catch {}
        })();
      }
      return rec;
    } catch (e: any) {
      const msg = e.message || 'Import failed';
      setError(msg);
      toastError('Import failed', msg);
  setImportStatuses((s) => s.map((st) => st.id === tempId ? { ...st, state: 'error', error: msg } : st));
      return null;
    }
  }, [supabase, userId, resumes, success, toastError]);

  const importMultiple = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const batchId = Date.now().toString(36);
    // seed statuses
    setImportStatuses((prev) => {
      const existingNameLower = resumes.map(r => r.name.toLowerCase());
      const seeded: ImportStatus[] = list.map((f, i): ImportStatus => {
        const base = f.name.replace(/\.[^.]+$/, '').toLowerCase();
        return {
          id: `${batchId}:${i}:${f.name}`,
          name: f.name,
          size: f.size,
          state: 'pending',
          progress: 0,
          duplicate: existingNameLower.includes(base),
        };
      });
      const next: ImportStatus[] = [...seeded, ...prev];
      return next.slice(0, MAX_IMPORT_STATUS);
    });
    const results: ResumeRecord[] = [];
    for (const [index, f] of list.entries()) {
      const tempId = `${batchId}:${index}:${f.name}`;
  setImportStatuses((s) => s.map((st) => st.id === tempId ? { ...st, state: 'uploading', progress: 0 } : st));
      const interval = window.setInterval(() => {
        setImportStatuses((s) => s.map((st) => st.id === tempId && st.state === 'uploading'
          ? { ...st, progress: Math.min(95, st.progress + Math.random() * 20) }
          : st));
      }, 300 + Math.random()*200);
      progressTimers.current.set(tempId, interval);
      const rec = await importResumeWithId(f, tempId);
      if (rec) results.push(rec);
    }
    if (results.length > 1) success('Imported resumes', `${results.length} files processed`);
    return results;
  }, [success, importResumeWithId]);

  // Auto prune completed (done) statuses older than 20s (retain errors)
  useEffect(() => {
    if (!importStatuses.length) return;
    const now = Date.now();
    const stale = importStatuses.some(s => s.state === 'done' && s.completedAt && (now - s.completedAt) > 20000);
    if (!stale) return;
    setImportStatuses((current) => current.filter(s => {
      if (s.state === 'error') return true;
      if (s.state !== 'done') return true;
      if (!s.completedAt) return true;
      return (Date.now() - s.completedAt) <= 20000;
    }));
  }, [importStatuses]);

  const retryImport = useCallback(async (statusId: string) => {
    const st = importStatuses.find(s => s.id === statusId);
    if (!st) return;
    // We can't actually re-use the original File object (wasn't stored); notify user.
    info('Retry not available', 'Original file reference not retained');
  }, [importStatuses, info]);

  const clearImportStatuses = useCallback(() => {
    // clear timers
    progressTimers.current.forEach((id) => clearInterval(id));
    progressTimers.current.clear();
    setImportStatuses([]);
  }, []);

  const removeImportStatus = useCallback((statusId: string) => {
    if (progressTimers.current.has(statusId)) {
      clearInterval(progressTimers.current.get(statusId)!);
      progressTimers.current.delete(statusId);
    }
    setImportStatuses((s) => s.filter((st) => st.id !== statusId));
  }, []);

  const reparseResume = useCallback(async (resume: ResumeRecord) => {
    if (!resume.file_path || !(resume.file_ext === 'pdf')) {
      info('Re-parse skipped', 'Only PDF resumes supported');
      return false;
    }
    try {
      const { data, error: urlErr } = await (supabase as any).storage.from('resumes').createSignedUrl(resume.file_path, 60);
      if (urlErr || !data?.signedUrl) throw urlErr || new Error('Signed URL failed');
      const resp = await fetch(data.signedUrl);
      const blob = await resp.blob();
      const file = new File([blob], `${resume.name}.${resume.file_ext}`, { type: 'application/pdf' });
      const parsed = await parsePdfFile(file);
      const analyzed = analyzeResumeText(parsed.text);
      const embedding = hashEmbedding(parsed.text);
      await (supabase as any).from('parsed_resumes').insert({
        resume_id: resume.id,
        user_id: resume.user_id,
        raw_text: parsed.text,
        json: { lines: parsed.lines, entities: analyzed.entities },
        structured: analyzed.structured,
        skills: analyzed.skills,
        embedding
      });
      success('Re-parsed', resume.name);
      return true;
    } catch (e: any) {
      toastError('Re-parse failed', e.message || 'Unknown error');
      return false;
    }
  }, [supabase, success, toastError, info]);

  const createEmpty = useCallback(
    async ({ name = "Untitled Resume", template = "Modern" }: { name?: string; template?: string } = {}) => {
      if (!userId) return null;
      try {
        const { data, error } = await (supabase as any)
          .from("resumes")
          .insert({
            user_id: userId,
            name,
            template,
            status: "Draft",
            applications: 0,
            thumbnail: null,
            is_favorite: false,
            file_path: null,
            file_ext: null,
            size: null,
          })
          .select("*")
          .single();
        if (error) throw error;
        setResumes((p) => [data, ...p]);
        success("Resume created", name);
        return data as ResumeRecord;
      } catch (e: any) {
        const msg = e.message || "Failed to create resume";
        setError(msg);
        toastError("Failed to create resume", msg);
        return null;
      }
    },
    [supabase, userId, success, toastError]
  );

  const toggleFavorite = useCallback(async (id: string, value: boolean) => {
    try {
      setResumes((p) => p.map((r) => (r.id === id ? { ...r, is_favorite: value } : r)));
      const { error } = await (supabase as any)
        .from("resumes")
        .update({ is_favorite: value })
        .eq("id", id);
      if (error) throw error;
      info(value ? "Marked as favorite" : "Removed favorite");
    } catch (e: any) {
      const msg = e.message || "Failed to update favorite";
      setError(msg);
      toastError("Favorite update failed", msg);
      // revert
      setResumes((p) => p.map((r) => (r.id === id ? { ...r, is_favorite: !value } : r)));
    }
  }, [supabase, info, toastError]);

  const rename = useCallback(async (id: string, name: string) => {
    try {
      setResumes((p) => p.map((r) => (r.id === id ? { ...r, name } : r)));
      const { error } = await (supabase as any)
        .from("resumes")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
      success("Renamed", name);
    } catch (e: any) {
      const msg = e.message || "Failed to rename";
      setError(msg);
      toastError("Rename failed", msg);
      await list();
    }
  }, [supabase, list, success, toastError]);

  const remove = useCallback(async (rec: ResumeRecord) => {
    try {
      setResumes((p) => p.filter((r) => r.id !== rec.id));
      if (rec.file_path) {
        await (supabase as any).storage.from("resumes").remove([rec.file_path]);
      }
      const { error } = await (supabase as any)
        .from("resumes")
        .delete()
        .eq("id", rec.id);
      if (error) throw error;
      const cached = objectUrlMap.current.get(rec.id);
      if (cached) URL.revokeObjectURL(cached);
      objectUrlMap.current.delete(rec.id);
      success("Deleted", rec.name);
    } catch (e: any) {
      const msg = e.message || "Failed to delete";
      setError(msg);
      toastError("Delete failed", msg);
      await list();
    }
  }, [supabase, list, success, toastError]);

  const duplicate = useCallback(async (rec: ResumeRecord) => {
    try {
      let newPath: string | null = null;
      if (rec.file_path) {
        const ext = rec.file_ext ?? rec.file_path.split(".").pop() ?? "bin";
        newPath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        // Try to copy in storage if available
        await (supabase as any).storage.from("resumes").copy(rec.file_path, newPath);
      }
      const { data, error } = await (supabase as any)
        .from("resumes")
        .insert({
          user_id: userId,
          name: rec.name + " (Copy)",
          template: rec.template,
          status: "Draft",
          applications: 0,
          thumbnail: rec.thumbnail,
          is_favorite: false,
          file_path: newPath,
          file_ext: rec.file_ext,
          size: rec.size,
        })
        .select("*")
        .single();
      if (error) throw error;
      setResumes((p) => [data as ResumeRecord, ...p]);
      success("Duplicated", rec.name);
    } catch (e: any) {
      const msg = e.message || "Failed to duplicate";
      setError(msg);
      toastError("Duplicate failed", msg);
    }
  }, [supabase, userId, success, toastError]);

  const view = useCallback(async (rec: ResumeRecord) => {
    const local = objectUrlMap.current.get(rec.id);
    const url = local || (rec.file_path ? await getSignedUrl(rec.file_path) : null);
    if (url) window.open(url, "_blank");
  }, [getSignedUrl]);

  const download = useCallback(async (rec: ResumeRecord) => {
    const local = objectUrlMap.current.get(rec.id);
    const url = local || (rec.file_path ? await getSignedUrl(rec.file_path) : null);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rec.name || "resume"}.${rec.file_ext || "pdf"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    info("Download started", `${rec.name}.${rec.file_ext ?? ""}`);
  }, [getSignedUrl, info]);

  useEffect(() => {
    if (!userId) return;
    // Subscribe to realtime changes for this user's resumes
    const channel = (supabase as any)
      .channel(`resumes:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resumes', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          setResumes((prev) => {
            switch (eventType) {
              case 'INSERT':
                // Avoid duplicates
                if (prev.find((r) => r.id === newRow.id)) return prev;
                return [newRow as ResumeRecord, ...prev];
              case 'UPDATE': {
                const updated = prev.map((r) => (r.id === newRow.id ? { ...r, ...newRow } : r));
                // Move updated item to top to reflect latest activity
                const idx = updated.findIndex((r) => r.id === newRow.id);
                if (idx > 0) {
                  const rec = updated[idx];
                  updated.splice(idx, 1);
                  return [rec, ...updated];
                }
                return updated;
              }
              case 'DELETE':
                return prev.filter((r) => r.id !== (oldRow?.id ?? newRow?.id));
              default:
                return prev;
            }
          });
        }
      )
  .subscribe();

    return () => {
      try { (supabase as any).removeChannel(channel); } catch {}
    };
  }, [supabase, userId]);

  return {
    resumes,
    loading,
    error,
  importStatuses,
  retryImport,
  clearImportStatuses,
  removeImportStatus,
  reparseResume,
    refresh: list,
    upload,
  importResume,
  importMultiple,
    createEmpty,
    toggleFavorite,
    rename,
    remove,
    duplicate,
    view,
    download,
    update: async (id: string, patch: Partial<ResumeRecord>) => {
      try {
        setResumes((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
        const { error } = await (supabase as any).from("resumes").update(patch).eq("id", id);
        if (error) throw error;
        success("Saved changes");
      } catch (e: any) {
        const msg = e.message || "Failed to update resume";
        setError(msg);
        toastError("Update failed", msg);
        await list();
      }
    },
    replaceFile: async (id: string, file: File) => {
      try {
        const rec = resumes.find((r) => r.id === id);
        if (!rec || !userId) return;
        const ext = file.name.split(".").pop()?.toLowerCase() || null;
        const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext ?? "bin"}`;
        if (rec.file_path) {
          await (supabase as any).storage.from("resumes").remove([rec.file_path]);
        }
        const { error: upErr } = await (supabase as any).storage.from("resumes").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        await (supabase as any).from("resumes").update({ file_path: path, file_ext: ext, size: file.size }).eq("id", id);
        setResumes((p) => p.map((r) => (r.id === id ? { ...r, file_path: path, file_ext: ext, size: file.size } : r)));
        success("File replaced", `${rec.name}.${ext ?? ""}`);
      } catch (e: any) {
        const msg = e.message || "Failed to replace file";
        setError(msg);
        toastError("Replace failed", msg);
      }
    },
  } as const;
}
