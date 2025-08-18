import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";

export const CreateResumeListItem = () => {
  return (
    <div className="flex items-center justify-start gap-3 rounded-md border p-3 cursor-pointer">
      <div className="flex size-8 items-center justify-center rounded bg-primary/10">
        <Plus size={16} />
      </div>
      <span className="text-sm opacity-90">{t`Create Resume`}</span>
    </div>
  );
};
