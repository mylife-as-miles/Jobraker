import { t } from "@lingui/macro";
import { DownloadSimple } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { useCreateResume } from "@/client/services/resume";
import slugify from "@sindresorhus/slugify";
import { toast } from "@/client/hooks/use-toast";
import { useResumes as useResumeOps } from "@/hooks/useResumes";

export const ImportResumeCard = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { createResume } = useCreateResume();
  const { importResume: importBinary } = useResumeOps();

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".json")) {
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
    } catch (error) {
      console.error("Import failed:", error);
      toast({ variant: "error", title: t`Import failed`, description: t`Please select a valid resume file.` });
    } finally {
      e.target.value = "";
    }
  };

  return (
    <BaseCard onClick={onPick} onDoubleClick={onPick} className="group">
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt,.json" hidden onChange={onFile} />
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#1dff00]/10 group-hover:bg-[#1dff00]/20 transition-colors">
          <DownloadSimple width={18} height={18} className="text-[#1dff00]" />
        </div>
        <p className="text-sm text-white/90">{t`Import Resume`}</p>
      </div>
    </BaseCard>
  );
};
