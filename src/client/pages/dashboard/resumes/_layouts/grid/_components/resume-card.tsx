import React from "react";
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
import { useResumes, type ResumeRecord } from "@/hooks/useResumes";
import { useToast } from "@/components/ui/toast";
import { DeleteResumeDialog } from "@/client/components/DeleteResumeDialog";
import { UndoToast } from "@/client/components/UndoToast";

import { BaseCard } from "./base-card";

type Props = {
  resume: ResumeDto;
};

export const ResumeCard = ({ resume }: Props) => {
  const navigate = useNavigate();
  const { open } = useDialog<ResumeDto>("resume");
  const { open: lockOpen } = useDialog<ResumeDto>("lock");
  const { remove, duplicate: duplicateResume, rename, undoRemove } = useResumes();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showUndoToast, setShowUndoToast] = React.useState(false);
  const [deletedResumeId, setDeletedResumeId] = React.useState<string | null>(null);
  const [deletedResumeName, setDeletedResumeName] = React.useState<string>("");

  const template = resume.data?.metadata?.template || "pikachu";
  const lastUpdated = dayjs().to(resume.updatedAt ?? resume.createdAt ?? new Date());

  const onOpen = () => {
    void navigate(`/builder/${resume.id}`);
  };

  const onUpdate = () => {
    open("update", { id: "resume", item: resume });
  };

  const onDuplicate = async () => {
    // Convert ResumeDto to ResumeRecord format for duplication
    const resumeRecord: ResumeRecord = {
      id: resume.id,
      user_id: null, // Will be set by the hook
      name: resume.name,
      template: resume.data?.metadata?.template || "pikachu",
      status: resume.locked ? "Archived" : "Active",
      applications: 0,
      thumbnail: null,
      is_favorite: false,
      file_path: null,
      file_ext: null,
      size: null,
      updated_at: resume.updatedAt || resume.createdAt || new Date().toISOString(),
    };
    await duplicateResume(resumeRecord);
  };

  const onLockChange = () => {
    lockOpen(resume.locked ? "update" : "create", { id: "lock", item: resume });
  };

  const onDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    
    try {
      // Fetch the full resume record from database to get file_path and other fields
      const { createClient } = await import("@/lib/supabaseClient");
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const uid = (auth as any)?.user?.id;
      
      if (!uid) {
        toast({ title: 'Error', description: 'Not authenticated' });
        setIsDeleting(false);
        setDeleteDialogOpen(false);
        return;
      }
      
      const { data: resumeRecord, error: fetchError } = await (supabase as any)
        .from("resumes")
        .select("*")
        .eq("id", resume.id)
        .eq("user_id", uid)
        .single();
      
      if (fetchError || !resumeRecord) {
        toast({ title: 'Error', description: 'Failed to fetch resume details' });
        setIsDeleting(false);
        setDeleteDialogOpen(false);
        return;
      }
      
      const id = resume.id;
      const name = resume.name;
      await remove(resumeRecord as ResumeRecord);
      
      // Show undo toast
      setDeletedResumeId(id);
      setDeletedResumeName(name);
      setShowUndoToast(true);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete resume' });
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUndo = () => {
    if (deletedResumeId) {
      undoRemove(deletedResumeId);
      setShowUndoToast(false);
      setDeletedResumeId(null);
      setDeletedResumeName("");
    }
  };

  const onReparse = () => {
    // Placeholder – actual hook consumption for reparseResume can be wired when unified data shape available
    // e.g., reparseResume(resume)
    console.log('Reparse requested for', resume.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="text-left">
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
            src={`/templates/jpg/${encodeURIComponent((template || 'pikachu').trim() || 'pikachu')}.jpg`}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.fallbackUsed) {
                img.dataset.fallbackUsed = 'true';
                img.src = "/templates/jpg/pikachu.jpg";
              } else {
                img.style.display = 'none';
              }
            }}
            alt={template}
            className="rounded-xl opacity-90 contrast-110"
          />
        </BaseCard>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="rounded-xl overflow-hidden">
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
    <>
      <DeleteResumeDialog
        open={deleteDialogOpen}
        resumeName={resume.name}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        isLoading={isDeleting}
      />
      {showUndoToast && deletedResumeId && (
        <UndoToast
          id={deletedResumeId}
          title="Resume deleted"
          description={deletedResumeName}
          onUndo={handleUndo}
          onDismiss={() => {
            setShowUndoToast(false);
            setDeletedResumeId(null);
            setDeletedResumeName("");
          }}
        />
      )}
    </>
  );
};
