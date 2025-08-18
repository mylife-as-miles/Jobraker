import { t } from "@lingui/macro";
import { DownloadSimple } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";

export const ImportResumeCard = () => {
  return (
    <BaseCard>
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <DownloadSimple size={18} />
        </div>
        <p className="text-sm opacity-80">{t`Import Resume`}</p>
      </div>
    </BaseCard>
  );
};
