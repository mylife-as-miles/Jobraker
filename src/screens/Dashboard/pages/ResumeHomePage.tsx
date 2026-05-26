import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Upload,
  FileText,
  Grid,
  List,
  Calendar,
  Edit2,
  Trash2,
  Download,
  History,
  MessageSquare,
} from "lucide-react";
import { useArtboardStore } from "../../../store/artboard";
import { Button } from "../../../components/ui/button";
import { motion } from "framer-motion";
import { ResumeCreationModal } from "../components/ResumeCreationModal";
import { ResumePreviewCard } from "../components/ResumePreviewCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getResumeDisplayName } from "@/lib/resumeDisplay";
import { useResumes, type ResumeRecord } from "@/hooks/useResumes";
import { useToast } from "@/components/ui/toast";
import { downloadResumePDF } from "@/utils/resume-download";

export const ResumeHomePage = () => {
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<{
    record: ResumeRecord;
    displayName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resumes, loading, importResume, remove: removeResume } = useResumes();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const setResumeId = useArtboardStore((state) => state.setResumeId);
  const setResumeTitle = useArtboardStore((state) => state.setResumeTitle);

  const normalizedResumes = useMemo(
    () =>
      resumes.map((resume) => ({
        record: resume,
        displayName: getResumeDisplayName(resume),
      })),
    [resumes],
  );

  const handleCreateNew = () => {
    setIsCreateModalOpen(true);
  };

  const handleEdit = (resume: any, displayName?: string) => {
    const resolvedTitle = displayName || getResumeDisplayName(resume);
    setResumeId(resume.id);
    setResumeTitle(resolvedTitle);
    navigate(`/dashboard/resume/edit/${resume.id}`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteRequest = (
    resume: ResumeRecord,
    displayName: string,
    event?: React.MouseEvent,
  ) => {
    event?.stopPropagation();
    setResumeToDelete({ record: resume, displayName });
  };

  const handleDeleteConfirm = async () => {
    if (!resumeToDelete) return;

    await removeResume(resumeToDelete.record);
    setResumeToDelete(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const importedResume = await importResume(file);
      if (!importedResume) {
        throw new Error("Import did not return a resume record.");
      }

      const resolvedTitle = getResumeDisplayName(importedResume);
      setResumeId(importedResume.id);
      setResumeTitle(resolvedTitle);
      navigate(`/dashboard/resume/edit/${importedResume.id}`);
    } catch (error: any) {
      console.error("Import failed:", error);
      toastError("Import failed", error?.message || "Could not import resume.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`product-page-shell flex flex-col h-full bg-background text-foreground overflow-y-auto ${isMobile ? "p-4 pb-20" : "p-8"}`}>
      <input
        type='file'
        ref={fileInputRef}
        onChange={handleFileChange}
        accept='.pdf'
        className='hidden'
      />

      {/* Header */}
      <div className='flex items-center justify-between mb-8'>
        <div>
          <h1 className='product-page-title text-2xl font-bold'>Resumes</h1>
          <p className='product-page-subtitle text-sm mt-1'>
            Manage and create your professional resumes
          </p>
        </div>

        <div className='flex items-center gap-3'>
          {/* View Toggle */}
          <div className='product-control-surface'>
            <button
              onClick={() => setViewMode("grid")}
              className={
                viewMode === "grid"
                  ? "product-control-button-active"
                  : "product-control-button"
              }
            >
              <Grid className='w-4 h-4' />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={
                viewMode === "list"
                  ? "product-control-button-active"
                  : "product-control-button"
              }
            >
              <List className='w-4 h-4' />
            </button>
          </div>

          <Button
            onClick={handleCreateNew}
            className='bg-brand text-black hover:bg-brand/90 gap-2 font-semibold'
          >
            <Plus className='w-4 h-4' />
            Create New
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className='aspect-[3/4] rounded-xl border border-foreground/10 overflow-hidden flex flex-col'
            >
              {/* Preview skeleton */}
              <div className='flex-1 bg-foreground/5 relative overflow-hidden'>
                <div
                  className='absolute inset-0 bg-gradient-to-r from-transparent via-foreground/40 to-transparent animate-[shimmer_1.5s_infinite] -translate-x-full'
                  style={{ animation: `shimmer 1.5s infinite ${i * 0.15}s` }}
                />
                {/* Fake resume lines */}
                <div className='p-6 space-y-3 pt-8'>
                  <div className='h-3 bg-foreground/5 rounded-full w-2/3 mx-auto' />
                  <div className='h-2 bg-foreground/5 rounded-full w-1/2 mx-auto' />
                  <div className='h-px bg-foreground/5 w-full mt-4' />
                  <div className='space-y-2 mt-4'>
                    <div className='h-2 bg-foreground/5 rounded-full w-1/3' />
                    <div className='h-2 bg-foreground/5 rounded-full w-full' />
                    <div className='h-2 bg-foreground/5 rounded-full w-5/6' />
                    <div className='h-2 bg-foreground/5 rounded-full w-4/6' />
                  </div>
                  <div className='space-y-2 mt-4'>
                    <div className='h-2 bg-foreground/5 rounded-full w-1/4' />
                    <div className='h-2 bg-foreground/5 rounded-full w-full' />
                    <div className='h-2 bg-foreground/5 rounded-full w-3/4' />
                  </div>
                </div>
              </div>
              {/* Meta skeleton */}
              <div className='p-4 bg-background border-t border-foreground/5'>
                <div className='h-3 bg-foreground/5 rounded-full w-3/4 mb-2' />
                <div className='h-2 bg-foreground/5 rounded-full w-1/2' />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && viewMode === "grid" && (
        <div className='grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6'>
          {/* Create New Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreateNew}
            className='aspect-[3/4] border rounded-2xl border-foreground/20 cursor-pointer flex flex-col items-center justify-center gap-4 transition-all group'
          >
            <div className='w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center text-brand group-hover:scale-110 transition-transform'>
              <Plus className='w-8 h-8' />
            </div>
            <span className='font-medium text-foreground/60 group-hover:text-foreground transition-colors'>
              Create New Resume
            </span>
          </motion.div>

          {/* Import Existing Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleImportClick}
            className='border rounded-2xl border-foreground/20 aspect-[3/4] cursor-pointer flex flex-col items-center justify-center gap-4 transition-all group relative'
          >
            {isImporting ? (
              <div className='flex flex-col items-center gap-3'>
                <div className='w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin' />
                <span className='text-xs text-foreground/60 animate-pulse'>
                  Analyzing PDF...
                </span>
              </div>
            ) : (
              <>
                <div className='w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center text-brand  group-hover:scale-110 transition-transform'>
                  <Upload className='w-8 h-8' />
                </div>
                <span className='font-medium text-foreground/60 group-hover:text-foreground transition-colors'>
                  Import Existing
                </span>
              </>
            )}
          </motion.div>
          {/* Resume Cards */}
          {normalizedResumes.map(({ record: resume, displayName }) => (
            <motion.div
              key={resume.id}
              whileHover={{ y: -5 }}
              className='rounded-xl bg-foreground/5 border overflow-hidden group transition-all relative flex flex-col'
            >
              {/* Preview Area (Top 2/3) */}
              <div
                onClick={() => handleEdit(resume, displayName)}
                className='relative cursor-pointer overflow-hidden aspect-[794/1123]'
              >
                {/* Mini Resume Preview */}
                <ResumePreviewCard
                  data={resume.data}
                  templateId={resume.template}
                />

                {/* Overlay on hover */}
                <div className='absolute inset-0 bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'>
                  <Button size='sm' variant='secondary' className='gap-2'>
                    <Edit2 className='w-3 h-3' /> Edit
                  </Button>
                </div>
              </div>

              {/* Meta Info (Bottom) */}
              <div className='p-4 min-w-0'>
                <div className='flex items-start justify-between gap-3 min-w-0'>
                  <div className='min-w-0 flex-1'>
                    <h3 className='font-semibold text-foreground truncate pr-2'>
                      {displayName}
                    </h3>
                    <p className='text-xs text-foreground/60 mt-1 flex min-w-0 items-center gap-1'>
                      <Calendar className='w-3 h-3 shrink-0' />
                      Last edited{" "}
                      <span className='truncate'>
                        {new Date(resume.updated_at).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={(event) =>
                      handleDeleteRequest(resume, displayName, event)
                    }
                    className='shrink-0 rounded-lg p-2 text-foreground/45 transition-colors hover:bg-red-500/10 hover:text-red-500'
                    title='Delete resume'
                    aria-label={`Delete ${displayName}`}
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === "list" && (
        <div className='space-y-4'>
          <div className='grid grid-cols-12 gap-4 px-4 py-2 product-helper-text text-xs font-medium uppercase tracking-wider'>
            <div className='col-span-6'>Name</div>
            <div className='col-span-3'>Last Modified</div>
            <div className='col-span-3 text-right'>Actions</div>
          </div>
          {normalizedResumes.map(({ record: resume, displayName }) => (
            <div
              key={resume.id}
              className='product-section-card-muted grid grid-cols-12 gap-4 px-4 py-4 hover:border-brand/45 items-center transition-all group'
            >
              <div className='col-span-6 flex min-w-0 items-center gap-4'>
                <div className='product-muted-icon-chip w-10 h-10 shrink-0 rounded-lg flex items-center justify-center'>
                  <FileText className='w-5 h-5 text-foreground/60' />
                </div>
                <div className='min-w-0'>
                  <h3 className='truncate font-semibold text-foreground'>
                    {displayName}
                  </h3>
                  <p className='product-helper-text text-xs'>A4 - PDF</p>
                </div>
              </div>
              <div className='col-span-3 product-helper-text text-sm'>
                {new Date(resume.updated_at).toLocaleDateString()}
              </div>
              <div className='col-span-3 flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity'>
                <button
                  onClick={() => handleEdit(resume, displayName)}
                  className='p-2 product-helper-text hover:text-foreground hover:bg-brand/10 rounded-lg transition-colors'
                  title='Edit'
                >
                  <Edit2 className='w-4 h-4' />
                </button>
                <button
                  type='button'
                  onClick={() => void downloadResumePDF(resume.data)}
                  className='p-2 product-helper-text hover:text-foreground hover:bg-brand/10 rounded-lg transition-colors'
                  title='Download'
                >
                  <Download className='w-4 h-4' />
                </button>
                <button
                  type='button'
                  className='p-2 text-foreground/60 hover:text-brand hover:bg-brand/10 rounded-lg'
                  title='Delete'
                  onClick={() => handleDeleteRequest(resume, displayName)}
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>
            </div>
          ))}

          <div
            onClick={handleCreateNew}
            className='product-section-card-muted grid grid-cols-12 gap-4 px-4 py-4 border-dashed hover:border-brand/60 cursor-pointer items-center group transition-all'
          >
            <div className='col-span-6 flex items-center gap-3'>
              <div className='w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand'>
                <Plus className='w-5 h-5' />
              </div>
              <span className='product-page-subtitle font-medium group-hover:text-foreground transition-colors'>
                Create New Resume
              </span>
            </div>
          </div>

          <button
            type='button'
            onClick={handleImportClick}
            disabled={isImporting}
            className='product-section-card-muted grid w-full grid-cols-12 gap-4 px-4 py-4 border-dashed text-left hover:border-brand/60 cursor-pointer items-center group transition-all disabled:cursor-wait disabled:opacity-75'
          >
            <div className='col-span-6 flex items-center gap-3'>
              <div className='w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center text-brand'>
                {isImporting ? (
                  <div className='h-5 w-5 rounded-full border-2 border-brand border-t-transparent animate-spin' />
                ) : (
                  <Upload className='w-5 h-5' />
                )}
              </div>
              <span className='product-page-subtitle font-medium group-hover:text-foreground transition-colors'>
                {isImporting ? "Analyzing PDF..." : "Import Resume"}
              </span>
            </div>
          </button>
        </div>
      )}

      <ResumeCreationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
      <ConfirmDialog
        open={Boolean(resumeToDelete)}
        onCancel={() => setResumeToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title='Delete Resume'
        message={
          resumeToDelete
            ? `Delete "${resumeToDelete.displayName}"? This action cannot be undone.`
            : "This action cannot be undone."
        }
        confirmText='Delete'
        cancelText='Cancel'
      />

    </div>
  );
};
