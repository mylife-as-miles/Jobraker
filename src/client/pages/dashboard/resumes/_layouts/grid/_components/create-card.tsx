import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";
import { useNavigate } from "react-router-dom";
import slugify from "@sindresorhus/slugify";
import { generateRandomName } from "@reactive-resume/utils";
import { useCreateResume } from "@/client/services/resume";
import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/client/hooks/use-toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const CreateResumeCard = () => {
  const navigate = useNavigate();
  const { createResume, loading } = useCreateResume();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(() => generateRandomName());
  const [template, setTemplate] = useState("Modern");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const templates = ["Modern", "Classic", "Minimal", "Elegant", "Professional"];

  useEffect(()=> { if (editing) setTimeout(()=> inputRef.current?.focus(), 10); }, [editing]);

  const resetForm = () => {
    setTitle(generateRandomName());
    setTemplate("Modern");
  };

  const actuallyCreate = useCallback(async (finalTitle: string) => {
    performance.mark('resume:create:start');
    try {
      setCreating(true);
      const usedTitle = finalTitle.trim() || generateRandomName();
      const slug = slugify(usedTitle);
      const res = await createResume({ title: usedTitle, slug, visibility: "private" as const, /* template not in DTO maybe but kept local */ } as any);
      performance.mark('resume:create:end');
      try { performance.measure('resume:create:duration','resume:create:start','resume:create:end'); } catch {}
      toast({ variant: "success", title: t`Resume created`, description: usedTitle });
      navigate(`/builder/${res.id}`, { replace: false, state: { resume: res } });
    } catch (e: any) {
      toast({ variant: "error", title: t`Creation failed`, description: e?.message || t`Please try again.` });
    } finally {
      setCreating(false);
      setEditing(false);
      resetForm();
    }
  }, [createResume, navigate, toast]);

  const handleCreate = useCallback(() => {
    // Single click enters edit mode first for naming
    if (!editing) {
      setEditing(true);
      return;
    }
  }, [editing]);

  const confirm = async () => {
    if (creating || loading) return;
  await actuallyCreate(title);
  };

  const cancel = () => {
    if (creating) return; // don't cancel mid create
    setEditing(false); resetForm();
  };

  const quickCreate = async () => {
    if (creating || loading) return;
  await actuallyCreate(title);
  };

  return (
    <BaseCard
      onClick={handleCreate}
      onDoubleClick={quickCreate}
      className="group"
    >
      <div className="flex flex-col items-center justify-center gap-2 text-center relative w-full h-full">
        {!editing && (
          <>
            <div className={`flex size-10 items-center justify-center rounded-full bg-[#1dff00]/10 group-hover:bg-[#1dff00]/20 transition-colors ${creating ? 'animate-pulse' : ''}`}>
              <Plus width={18} height={18} className="text-[#1dff00]" />
            </div>
            <p className="text-sm text-white/90 select-none">
              {creating ? t`Creating…` : t`Create Resume`}
            </p>
            <p className="text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity select-none">{t`Click to name • Double-click to quick create`}</p>
          </>
        )}
        {editing && (
          <div className="absolute inset-0 flex flex-col items-stretch justify-center gap-2 p-3 animate-in fade-in rounded-md bg-black/70 backdrop-blur-md">
            <input
              ref={inputRef}
              value={title}
              disabled={creating}
              onChange={(e)=> setTitle(e.target.value)}
              onKeyDown={(e)=> { if (e.key==='Enter') { e.preventDefault(); confirm(); } if (e.key==='Escape') { e.preventDefault(); cancel(); } }}
              placeholder={t`Resume title`}
              className="w-full text-xs rounded-md bg-black/40 border border-[#1dff00]/40 focus:border-[#1dff00] outline-none px-2 py-1 text-white"
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
              <button
                onClick={confirm}
                disabled={creating}
                className="flex-1 text-[11px] px-2 py-1 rounded bg-[#1dff00]/20 hover:bg-[#1dff00]/30 border border-[#1dff00]/50 text-[#1dff00] disabled:opacity-50 disabled:cursor-not-allowed"
              >{creating ? t`Creating…` : t`Create`}</button>
              <button
                onClick={cancel}
                disabled={creating}
                className="text-[11px] px-2 py-1 rounded border border-white/20 hover:border-[#1dff00]/40 text-white/70 hover:text-white disabled:opacity-40"
              >{t`Cancel`}</button>
            </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
};
