import { t } from "@lingui/macro";
import type { ResumeDto } from "@reactive-resume/dto";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

export const ResumeListItem = ({ resume }: { resume: ResumeDto }) => {
  const lastUpdated = dayjs().to(resume.updatedAt);
  const navigate = useNavigate();

  return (
  <div className="flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer bg-gradient-to-r from-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/40 hover:bg-[#1dff00]/5 transition-colors"
      onClick={() => navigate(`/builder/${resume.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/builder/${resume.id}`); } }}
      tabIndex={0}
      role="button"
      aria-label={`Open resume ${resume.title}`}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{resume.title}</p>
        <p className="truncate text-xs opacity-70">{t`Last updated ${lastUpdated}`}</p>
      </div>
      <img
        src={`/templates/jpg/${encodeURIComponent((resume?.data?.metadata?.template || 'pikachu').trim() || 'pikachu')}.jpg`}
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (!img.dataset.fallbackUsed) {
            img.dataset.fallbackUsed = 'true';
            img.src = "/templates/jpg/pikachu.jpg";
          } else {
            img.style.display = 'none';
          }
        }}
        alt={resume.data.metadata.template}
        className="h-10 w-8 rounded-xl object-cover opacity-90 contrast-110"
      />
    </div>
  );
};
