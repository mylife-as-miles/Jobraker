import { t } from "@lingui/macro";
import { DownloadSimple } from "@phosphor-icons/react";

export const ImportResumeListItem = () => {
  return (
    <div className="flex items-center justify-start gap-3 rounded-md border p-3 cursor-pointer">
      <div className="flex size-8 items-center justify-center rounded bg-primary/10">
        <DownloadSimple size={16} />
      </div>
      <span className="text-sm opacity-90">{t`Import Resume`}</span>
    </div>
  );
};
