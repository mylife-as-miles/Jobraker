import { t } from "@lingui/macro";
import { CopySimple, Lock, PencilSimple, TrashSimple } from "@phosphor-icons/react";
import type { ResumeDto } from "@reactive-resume/dto";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { useDialog } from "@/client/stores/dialog";

import { BaseCard } from "./base-card";

type Props = {
  resume: ResumeDto;
};

export const ResumeCard = ({ resume }: Props) => {
  const navigate = useNavigate();
  const { open } = useDialog<ResumeDto>("resume");
  const { open: lockOpen } = useDialog<ResumeDto>("lock");

  const template = resume.data.metadata.template;
  const lastUpdated = dayjs().to(resume.updatedAt ?? resume.createdAt ?? new Date());

  const onOpen = () => {
    void navigate(`/builder/${resume.id}`);
  };

  const onUpdate = () => {
    open("update", { id: "resume", item: resume });
  };

  const onDuplicate = () => {
    open("duplicate", { id: "resume", item: resume });
  };

  const onLockChange = () => {
    lockOpen(resume.locked ? "update" : "create", { id: "lock", item: resume });
  };

  const onDelete = () => {
    open("delete", { id: "resume", item: resume });
  };

  const onReparse = () => {
    // Placeholder – actual hook consumption for reparseResume can be wired when unified data shape available
    // e.g., reparseResume(resume)
    console.log('Reparse requested for', resume.id);
  };

  return (
    <DropdownMenu>
    <DropdownMenuTrigger className="text-left">
  <BaseCard className="cursor-context-menu space-y-0" onDoubleClick={onOpen}>
          <AnimatePresence>
            {resume.locked && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              >
                <Lock width={42} height={42} />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end space-y-0.5 p-4 pt-12",
              "bg-gradient-to-t from-black/80 to-transparent",
            )}
          >
            <h4 className="line-clamp-2 font-medium">{resume.title}</h4>
            <p className="line-clamp-1 text-xs opacity-75">{t`Last updated ${lastUpdated}`}</p>
            {/* Parsed metadata badges (placeholder – backend linkage needed) */}
            <div className="flex flex-wrap gap-1 pt-1">
              {/* Example badges could be injected once parsed data joined */}
              {/* <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px] font-medium">5 skills</span> */}
            </div>
          </div>

          <img
            src={`/templates/jpg/${template}.jpg`}
            alt={template}
            className="rounded-sm opacity-90 contrast-110"
          />
        </BaseCard>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem onClick={onOpen}>{t`Open`}</DropdownMenuItem>
        <DropdownMenuItem onClick={onUpdate}>
          <PencilSimple width={14} height={14} className="mr-2" />
          {t`Rename`}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onReparse}>
          <CopySimple width={14} height={14} className="mr-2" />
          {t`Re-parse`}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <CopySimple width={14} height={14} className="mr-2" />
          {t`Duplicate`}
        </DropdownMenuItem>
    {resume.locked ? (
          <DropdownMenuItem onClick={onLockChange}>
      <Lock width={14} height={14} className="mr-2" />
            {t`Unlock`}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onLockChange}>
      <Lock width={14} height={14} className="mr-2" />
            {t`Lock`}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-error" onClick={onDelete}>
          <TrashSimple width={14} height={14} className="mr-2" />
          {t`Delete`}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
