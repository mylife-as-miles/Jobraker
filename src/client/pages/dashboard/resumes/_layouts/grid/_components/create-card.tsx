import { t } from "@lingui/macro";
import { Plus } from "@phosphor-icons/react";
import { BaseCard } from "./base-card";

export const CreateResumeCard = () => {
  return (
    <BaseCard>
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
          <Plus size={18} />
        </div>
        <p className="text-sm opacity-80">{t`Create Resume`}</p>
      </div>
    </BaseCard>
  );
};
