import { t } from "@lingui/macro";
import { DownloadSimple } from "@phosphor-icons/react";
import { useRef } from "react";
import { useCreateResume } from "@/client/services/resume";
import slugify from "@sindresorhus/slugify";
import { useNavigate } from "react-router-dom";
import { toast } from "@/client/hooks/use-toast";
import { useResumes as useResumeOps } from "@/hooks/useResumes";

export const ImportResumeListItem = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { createResume } = useCreateResume();
  const navigate = useNavigate();
  const { importResume: importBinary } = useResumeOps();

  const onPick = () => inputRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const title = (data?.title as string) || file.name.replace(/\.[^.]+$/, "");
        const slug = slugify(title);
        const res = await createResume({ title, slug, visibility: "private" as const });
        navigate(`/builder/${res.id}`, { state: { resume: res } });
        toast({ variant: "success", title: t`Imported`, description: t`Your resume was created.` });
      } else {
        await importBinary(file);
        toast({ variant: "success", title: t`Imported`, description: t`Your file was uploaded.` });
      }
    } catch {
      toast({ variant: "error", title: t`Import failed`, description: t`Please select a valid resume file.` });
    } finally {
      e.target.value = "";
    }
  };
  return (
    <div className="flex items-center justify-start gap-3 rounded-md border p-3 cursor-pointer bg-gradient-to-r from-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-colors"
      onClick={onPick}>
  <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt,.json" hidden onChange={onFile} />
      <div className="flex size-8 items-center justify-center rounded bg-[#1dff00]/10">
        <DownloadSimple width={16} height={16} className="text-[#1dff00]" />
      </div>
      <span className="text-sm opacity-90">{t`Import Resume`}</span>
    </div>
  );
};
