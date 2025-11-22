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
    <BaseCard onClick={onPick} onDoubleClick={onPick} className="group cursor-pointer overflow-hidden">
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt,.json" hidden onChange={onFile} />
      <div className="relative flex flex-col items-center justify-center gap-5 text-center h-full transition-all duration-500 group-hover:scale-[1.02]">
        {/* Animated icon container */}
        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl border-2 border-[#1dff00]/50 bg-gradient-to-br from-[#1dff00]/15 to-[#1dff00]/5 shadow-[0_0_25px_rgba(29,255,0,0.2)] transition-all duration-500 group-hover:border-[#1dff00] group-hover:bg-gradient-to-br group-hover:from-[#1dff00]/25 group-hover:to-[#1dff00]/10 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_40px_rgba(29,255,0,0.4)]">
          <DownloadSimple width={32} height={32} className="text-[#1dff00] drop-shadow-[0_0_10px_rgba(29,255,0,0.8)] transition-transform duration-500 group-hover:scale-110 group-hover:translate-y-1" />
          
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-[#1dff00]/30 animate-ping opacity-0 group-hover:opacity-100" />
        </div>
        
        <div className="space-y-2">
          <p className="text-lg font-bold text-white group-hover:text-[#1dff00] transition-colors duration-300 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] group-hover:drop-shadow-[0_0_20px_rgba(29,255,0,0.8)]">
            {t`Import Resume`}
          </p>
          <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors duration-300 leading-relaxed px-2">
            Upload PDF, DOC, DOCX, TXT, or JSON
          </p>
        </div>

        {/* Multi-layered glow effects */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1dff00]/0 via-[#1dff00]/10 to-[#1dff00]/0 opacity-0 transition-all duration-500 group-hover:opacity-100 blur-xl" />
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tl from-[#1dff00]/0 via-[#1dff00]/5 to-[#1dff00]/0 opacity-0 transition-all duration-700 group-hover:opacity-100" />
        
        {/* Corner accent glows */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#1dff00]/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#1dff00]/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        {/* Animated border glow */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 rounded-xl border border-[#1dff00]/50 blur-sm animate-pulse" />
        </div>
      </div>
    </BaseCard>
  );
};
