import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import slugify from "@sindresorhus/slugify";
import { generateRandomName } from "@reactive-resume/utils";
import { useCreateResume } from "@/client/services/resume";
import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/client/hooks/use-toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const CreateResumeListItem = () => {
  const navigate = useNavigate();
  const { createResume, loading } = useCreateResume();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(() => generateRandomName());
  const STORAGE_KEY = 'resume:last-template';
  const [template, setTemplate] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'Modern'; } catch { return 'Modern'; }
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const templates = ["Modern", "Classic", "Minimal", "Elegant", "Professional"];

  useEffect(()=> { if (editing) setTimeout(()=> inputRef.current?.focus(), 10); }, [editing]);

  const resetForm = () => {
    setTitle(generateRandomName());
    try { const saved = localStorage.getItem(STORAGE_KEY); setTemplate(saved || 'Modern'); } catch { setTemplate('Modern'); }
  };

  useEffect(()=> { try { localStorage.setItem(STORAGE_KEY, template); } catch {} }, [template]);
  useEffect(()=> { if (editing) { import('@/client/pages/builder/page').catch(()=>{}); } }, [editing]);

  const createNow = useCallback(async (val: string) => {
    try {
      setCreating(true);
      const used = val.trim() || generateRandomName();
      const slug = slugify(used);
      window.dispatchEvent(new CustomEvent('analytics', { detail: { type: 'resume_create_start', title: used, template } }));
      const res = await createResume({ title: used, slug, visibility: "private" as const } as any);
      toast({ variant: "success", title: t`Resume created`, description: used });
      window.dispatchEvent(new CustomEvent('analytics', { detail: { type: 'resume_create_success', id: res.id, title: used, template } }));
      navigate(`/builder/${res.id}`, { state: { resume: res } });
    } catch (e: any) {
      toast({ variant: "error", title: t`Creation failed`, description: e?.message || t`Please try again.` });
      window.dispatchEvent(new CustomEvent('analytics', { detail: { type: 'resume_create_error', message: e?.message } }));
    } finally {
      setCreating(false); setEditing(false); resetForm();
    }
  }, [createResume, navigate, toast]);

  const handleCreate = useCallback(() => { if (!editing) { setEditing(true); return; } }, [editing]);
  const confirm = async () => { if (creating || loading) return; await createNow(title); };
  const cancel = () => { if (creating) return; setEditing(false); resetForm(); };
  const quick = async () => { if (creating || loading) return; await createNow(title); };

  return (
    <div
      className="relative flex items-center justify-start gap-3 rounded-xl border p-3 cursor-pointer bg-gradient-to-r from-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-colors"
      onClick={handleCreate}
      onDoubleClick={quick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCreate(); } if ((e.metaKey||e.ctrlKey) && e.key==='Enter') { e.preventDefault(); quick(); } }}
      aria-label={creating ? 'Creating resume' : 'Create resume'}
    >
      {!editing && (
        <>
          <div className={`flex size-8 items-center justify-center rounded bg-[#1dff00]/10 ${creating ? 'animate-pulse' : ''}`}>
            <Plus width={16} height={16} className="text-[#1dff00]" />
          </div>
          <span className="text-sm opacity-90">{creating ? t`Creating…` : t`Create Resume`}</span>
          <span className="ml-auto text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity select-none">{t`Click to name • Double-click to quick create`}</span>
        </>
      )}
      {editing && (
        <div className="absolute inset-0 rounded-xl p-3 flex flex-col gap-2 bg-black/70 backdrop-blur-md">
          <input
            ref={inputRef}
            value={title}
            disabled={creating}
            onChange={(e)=> setTitle(e.target.value)}
            onKeyDown={(e)=> { if (e.key==='Enter') { e.preventDefault(); confirm(); } if (e.key==='Escape'){ e.preventDefault(); cancel(); } }}
            className="w-full text-xs rounded-md bg-black/40 border border-[#1dff00]/40 focus:border-[#1dff00] outline-none px-2 py-1 text-white"
            placeholder={t`Resume title`}
          />
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger className="h-7 px-2 py-1 text-xs bg-black/40 border border-[#1dff00]/40 focus:border-[#1dff00]">
              <SelectValue placeholder={t`Template`} />
            </SelectTrigger>
            <SelectContent className="text-xs bg-[#0a0a0a] border-[#1dff00]/30">
              {templates.map(tmp => (
                <SelectItem key={tmp} value={tmp} className="text-xs cursor-pointer focus:bg-[#1dff00]/10">{tmp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={confirm} disabled={creating} className="flex-1 text-[11px] px-2 py-1 rounded bg-[#1dff00]/20 hover:bg-[#1dff00]/30 border border-[#1dff00]/50 text-[#1dff00] disabled:opacity-50 disabled:cursor-not-allowed">{creating ? t`Creating…` : t`Create`}</button>
            <button onClick={cancel} disabled={creating} className="text-[11px] px-2 py-1 rounded border border-white/20 hover:border-[#1dff00]/40 text-white/70 hover:text-white disabled:opacity-40">{t`Cancel`}</button>
          </div>
        </div>
      )}
    </div>
  );
};
