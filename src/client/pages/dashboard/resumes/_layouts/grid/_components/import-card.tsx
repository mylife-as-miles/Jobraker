import { t } from "@lingui/macro";
import { DownloadSimple } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { useCreateResume } from "@/client/services/resume";
import slugify from "@sindresorhus/slugify";

export const ImportResumeCard = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { createResume } = useCreateResume();

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const title = (data?.title as string) || file.name.replace(/\.[^.]+$/, "");
      const slug = slugify(title);
      const res = await createResume({ title, slug, visibility: "private" as const });
      // Attach imported data if present
      // Optional: could call an update here if needed to store full data
      navigate(`/builder/${res.id}`);
    } catch {
      // Silent fail; you could toast an error if desired
    } finally {
      e.target.value = "";
    }
  };

  return (
    <BaseCard onClick={onPick} onDoubleClick={onPick} className="group">
      <input ref={inputRef} type="file" accept=".json" hidden onChange={onFile} />
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#1dff00]/10 group-hover:bg-[#1dff00]/20 transition-colors">
          <DownloadSimple width={18} height={18} className="text-[#1dff00]" />
        </div>
        <p className="text-sm text-white/90">{t`Import Resume`}</p>
      </div>
    </BaseCard>
  );
};
