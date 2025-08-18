import { t } from "@lingui/macro";
import type { ResumeDto } from "@reactive-resume/dto";
import dayjs from "dayjs";

export const ResumeListItem = ({ resume }: { resume: ResumeDto }) => {
  const lastUpdated = dayjs().to(resume.updatedAt);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{resume.title}</p>
        <p className="truncate text-xs opacity-70">{t`Last updated ${lastUpdated}`}</p>
      </div>
      <img
        src={`/templates/jpg/${resume.data.metadata.template}.jpg`}
        alt={resume.data.metadata.template}
        className="h-10 w-8 rounded-sm object-cover opacity-90 contrast-110"
      />
    </div>
  );
};
