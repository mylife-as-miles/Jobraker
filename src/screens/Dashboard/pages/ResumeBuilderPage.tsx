import { useState, useRef, useMemo, useEffect, useCallback, useReducer } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Plus,
  Share2,
  Sparkles,
  User,
  Wand2,
  X,
  LayoutTemplate,
  Edit2,
  Lock as LockIcon,
  ZoomIn,
  ZoomOut,
  PenLine,
} from "lucide-react";
import {
  useArtboardStore,
  initialResumeState,
} from "@/store/artboard";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { polishContent } from "@/services/ai/polishContent";
import { useToast } from "@/components/ui/toast";
import { useResumeProfilePhoto } from "@/hooks/useResumeProfilePhoto";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { createClient } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TemplateSelector } from "../components/TemplateSelector";
import { AddSectionDialog } from "../components/resume/AddSectionDialog";
import { ShareDialog } from "../components/resume/ShareDialog";
import { SectionEditor } from "../components/resume/SectionEditor";
import { ListEditor } from "../components/resume/ListEditor";
import { PersonalDetailsEditor } from "../components/resume/PersonalDetailsEditor";
import { ResumeTemplateRenderer } from "@/templates/render-resume-template";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { resolveResumePageLayout } from "@/lib/resumeLayout";
import {
  buildCandidateProfileSnapshot,
  fillResumeFromCandidateProfile,
} from "@/lib/candidateProfileSnapshot";
import {
  initialResumeEditorState,
  resumeEditorReducer,
} from "@/lib/resumeEditorState";
import { useResumePersistence } from "@/hooks/useResumePersistence";
import { useResumeExport } from "@/hooks/useResumeExport";
import { useResumeHydration } from "@/hooks/useResumeHydration";

const PREVIEW_BASE_WIDTH = 794;
const PREVIEW_BASE_HEIGHT = 1123;

const SECTION_ICONS: Record<string, any> = {
  education: FileText,
  experience: FileText,
  projects: FileText,
  skills: FileText,
  languages: FileText,
  certifications: FileText,
  interests: FileText,
  custom: FileText,
};

interface ResumeBuilderPageProps {
  resumeId?: string | null;
}

const ResumeBuilderPage = ({ resumeId }: ResumeBuilderPageProps) => {
  const supabase = useMemo(() => createClient(), []);
  const navigate = useNavigate();
  const { success, error: toastError, info } = useToast();
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasResumeAiAccess = hasSubscriptionAccess(subscriptionTier, "Basics");
  const { save: persistResume } = useResumePersistence(resumeId);
  const { downloadPdf, exporting } = useResumeExport((message) => {
    toastError("PDF export failed", message);
  });

  // Store actions/state
  const resumeState = useArtboardStore();
  const {
    resume: resumeStateData,
    setResume,
    setResumeId,
    setResumeData,
    setResumeTitle,
    updateBasics,
  } = resumeState;
  const resumeData = resumeStateData.data;

  // Local UI State
  const [editorState, dispatchEditor] = useReducer(
    resumeEditorReducer,
    initialResumeEditorState,
  );
  const saving = editorState.status === "saving";
  const [aiLoading, setAiLoading] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  const [isMobile, setIsMobile] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [previewScale, setPreviewScale] = useState(1);

  const previewPanelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorHydrationObservedRef = useRef(false);

  const {
    hydrationReady,
    lastDraftSavedAt,
    markDraftBaseline,
    clearResumeDraft,
    serverUpdatedAtRef,
  } = useResumeHydration({
    resumeId,
    resume: resumeStateData,
    supabase,
    setResume,
    setResumeId,
    dispatchEditor,
    info,
    error: toastError,
  });

  // Responsive Check
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Profile Data for Auto-population
  const { profile, experiences, education, skills } = useProfileSettings();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: any }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, [supabase]);

  useEffect(() => {
    const updatePreviewScale = () => {
      const container = previewPanelRef.current;
      if (!container) return;

      if (!isMobile) {
        setPreviewScale(zoom);
        return;
      }

      const availableWidth = Math.max(280, container.clientWidth - 24);
      const nextScale = Math.min(1, availableWidth / PREVIEW_BASE_WIDTH);
      setPreviewScale(Number(nextScale.toFixed(3)));
    };

    updatePreviewScale();

    if (typeof window === "undefined") return;

    window.addEventListener("resize", updatePreviewScale);
    const observer =
      typeof ResizeObserver !== "undefined" && previewPanelRef.current
        ? new ResizeObserver(updatePreviewScale)
        : null;

    if (observer && previewPanelRef.current) {
      observer.observe(previewPanelRef.current);
    }

    return () => {
      window.removeEventListener("resize", updatePreviewScale);
      observer?.disconnect();
    };
  }, [isMobile, zoom]);

  const candidateProfile = useMemo(
    () =>
      buildCandidateProfileSnapshot({
        profile,
        email: userEmail,
        experiences: experiences.data,
        education: education.data,
        skills: skills.data,
      }),
    [education.data, experiences.data, profile, skills.data, userEmail],
  );

  useEffect(() => {
    if (!hydrationReady) {
      editorHydrationObservedRef.current = false;
      return;
    }
    if (!editorHydrationObservedRef.current) {
      editorHydrationObservedRef.current = true;
      dispatchEditor({ type: "READY" });
      return;
    }
    dispatchEditor({ type: "CHANGE" });
  }, [hydrationReady, resumeStateData]);

  useEffect(() => {
    if (!hydrationReady) return;
    const mapped = fillResumeFromCandidateProfile(
      resumeData,
      initialResumeState.data,
      candidateProfile,
    );

    if (JSON.stringify(mapped) !== JSON.stringify(resumeData)) {
      setResumeData(mapped);
    }
  }, [
    candidateProfile,
    hydrationReady,
    resumeData,
    setResumeData,
  ]);

  // Actions
  const toggleSectionVisibility = useArtboardStore(
    (state) => state.toggleSectionVisibility,
  );
  const { profileAvatarUrl, syncingProfilePhoto, syncProfilePicture } =
    useResumeProfilePhoto({
      picture: resumeData.basics.picture,
      profileAvatarPath: profile?.avatar_url || null,
      supabase,
      updateBasics,
    });

  const useProfileImage = useCallback(
    async () => Boolean(await syncProfilePicture(true)),
    [syncProfilePicture],
  );
  const refreshProfileImage = useCallback(
    async () => Boolean(await syncProfilePicture(true)),
    [syncProfilePicture],
  );

  // Helper for summary
  const setSummary = (val: string) =>
    setResumeData({ summary: { ...resumeData.summary, content: val } });

  const { basics, sections, summary, metadata } = resumeData;
  const resolvedLayoutPage = useMemo(
    () => resolveResumePageLayout(resumeData, 0),
    [resumeData],
  );

  // Get active sections from layout order
  const orderedSectionIds = [
    ...resolvedLayoutPage.main,
    ...resolvedLayoutPage.sidebar,
  ];
  // Filter for unique IDs and ensure they exist in sections and are not hidden.
  // Exclude 'summary' because it is rendered explicitly above.
  const visibleSections = orderedSectionIds.filter(
    (id) => id !== "summary" && sections[id] && !sections[id].hidden,
  );

  const selectedTemplate = metadata?.template || "azurill";

  const [expandedSection, setExpandedSection] = useState<string | null>(
    "personal",
  );

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const aiPolishSummary = async (
    instruction = "Polish this resume summary for clarity, confidence, and measurable impact.",
  ) => {
    if (!hasResumeAiAccess) {
      toastError(
        "Upgrade required",
        "Resume AI tools are available on Basics and above.",
      );
      return;
    }
    setAiLoading(true);
    try {
      const source = (
        summary.content ||
        basics.headline ||
        basics.name ||
        ""
      ).trim();
      if (!source) throw new Error("Add a summary or headline first.");
      const suggestions = await polishContent(source, instruction);
      const nextSummary =
        suggestions.find((item) => item.isRecommended)?.content ||
        suggestions[0]?.content ||
        "";
      if (!nextSummary) throw new Error("No AI suggestion was returned.");
      setSummary(nextSummary);
      success(
        instruction.includes("fresh")
          ? "Summary generated"
          : "Summary polished",
        instruction.includes("fresh")
          ? "A new AI summary has been added to your resume."
          : "AI suggestions have been applied to your resume summary.",
      );
    } catch (e: any) {
      toastError(
        instruction.includes("fresh")
          ? "AI generation failed"
          : "AI rewrite failed",
        e?.message || "AI is temporarily unavailable.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  const aiGenerateResume = async () =>
    aiPolishSummary(
      "Write a fresh professional resume summary in 3-4 concise sentences.",
    );
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);
  const effectivePreviewScale = isMobile ? previewScale : zoom;
  const previewFrameWidth = PREVIEW_BASE_WIDTH * effectivePreviewScale;
  const previewFrameHeight = PREVIEW_BASE_HEIGHT * effectivePreviewScale;
  const editorStatusLabel = saving
    ? "Saving..."
    : editorState.status === "error"
      ? "Save failed"
      : editorState.status === "saved"
        ? "Saved"
        : editorState.status === "dirty"
          ? "Unsaved changes"
    : lastDraftSavedAt
      ? "Autosaved locally"
      : "Ready";

  const handleSave = async () => {
    if (!resumeId) return;
    dispatchEditor({ type: "SAVE" });
    try {
      const pictureSnapshot = await syncProfilePicture(false);
      const dataToSave = pictureSnapshot
        ? {
            ...resumeData,
            basics: { ...resumeData.basics, picture: pictureSnapshot },
          }
        : resumeData;
      const saved = await persistResume(dataToSave);
      serverUpdatedAtRef.current = saved.updated_at;
      markDraftBaseline({
        ...resumeStateData,
        id: resumeId,
        data: dataToSave,
      });
      await clearResumeDraft();
      success("Resume saved", "Your latest resume changes have been saved.");
      dispatchEditor({ type: "SAVED" });
      setSaveAlertOpen(true);
    } catch (e: any) {
      const message = e?.message || "Unable to save your resume right now.";
      dispatchEditor({ type: "FAIL", error: message });
      toastError(
        "Save failed",
        message,
      );
    }
  };

  if (!hydrationReady) {
    return (
      <div className="product-page-shell flex h-full flex-col animate-pulse">
        <div className="h-16 border-b border-border/40 bg-background/80" />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border/40 bg-foreground/5" />
          <div className="hidden rounded-2xl border border-border/40 bg-foreground/5 lg:block" />
        </div>
        <span className="sr-only">Loading resume editor</span>
      </div>
    );
  }

  return (
    <div className='product-page-shell flex flex-col h-full relative overflow-hidden'>
      {/* Save Alert Modal */}
      <Modal
        open={saveAlertOpen}
        onClose={() => setSaveAlertOpen(false)}
        title='Resume Saved'
        size='sm'
        footer={
          <div className='flex justify-end'>
            <Button onClick={() => setSaveAlertOpen(false)}>Close</Button>
          </div>
        }
      >
        <div className='text-foreground/80 py-4'>
          Your resume has been saved successfully.
        </div>
      </Modal>

      {/* Header toolbar */}
      <header className='shrink-0 border-b border-border/40 bg-background/95 px-3 py-3 md:h-16 md:px-6 md:py-0 backdrop-blur supports-[backdrop-filter]:bg-background/85 flex flex-col gap-3 md:flex-row md:items-center md:justify-between z-10'>
        <div className='flex min-w-0 items-center gap-3 md:gap-4'>
          <button
            onClick={() => navigate("/dashboard/resume")}
            className='product-helper-text flex items-center gap-2 text-sm transition-colors hover:text-foreground'
          >
            <ArrowLeft className='w-4 h-4' />
            <span>Back</span>
          </button>
          <div className='h-6 w-px shrink-0 bg-border/60' />
          <div className='group relative flex min-w-0 flex-1 items-center gap-2'>
            <input
              ref={titleInputRef}
              value={resumeData.title || ""}
              onChange={(e) => setResumeTitle(e.target.value)}
              placeholder='Untitled Resume'
              className='product-page-title w-full min-w-0 rounded-md bg-transparent px-2 py-1 text-base font-semibold outline-none transition-all hover:bg-muted/30 focus:bg-muted/50 focus:ring-1 focus:ring-brand/50 md:text-lg'
            />
            <button
              onClick={() => titleInputRef.current?.focus()}
              className='product-helper-text p-1 hover:text-brand transition-all opacity-60 hover:opacity-100 transition-opacity focus:opacity-100'
            >
              <Edit2 className='w-3.5 h-3.5' />
            </button>
          </div>
        </div>

        <div className='flex items-center gap-2 overflow-x-auto pb-1 md:gap-3 md:pb-0 no-scrollbar'>
          <button
            onClick={() => setIsTemplateSelectorOpen(true)}
            className='product-outline-button flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm font-medium whitespace-nowrap'
          >
            <LayoutTemplate className='w-4 h-4 shrink-0' />
            <span className='hidden sm:inline'>Templates</span>
            <ChevronDown className='w-3 h-3 opacity-50 hidden sm:block' />
          </button>

          <button
            onClick={() => setIsShareOpen(true)}
            className='product-outline-button flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 text-xs md:text-sm font-medium whitespace-nowrap'
          >
            <Share2 className='w-4 h-4 shrink-0' />
            <span className='hidden sm:inline'>Share</span>
          </button>

          <button
            onClick={() => aiPolishSummary()}
            disabled={aiLoading || loadingTier}
            className='flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 rounded-lg bg-brand hover:bg-brand text-black text-xs md:text-sm font-bold transition-all shadow-[0_0_15px_rgba(29,255,0,0.3)] whitespace-nowrap disabled:opacity-60'
          >
            <Sparkles className='w-4 h-4 shrink-0' />
            <span className='hidden sm:inline'>
              {aiLoading ? "Polishing..." : "AI Polish"}
            </span>
            {!hasResumeAiAccess && <LockIcon className='w-3 h-3 opacity-60' />}
          </button>

          <button
            onClick={aiGenerateResume}
            disabled={aiLoading || loadingTier}
            className='product-outline-button hidden md:flex items-center gap-2 px-4 py-2 text-sm font-bold hover:border-brand/60 hover:bg-brand/15 dark:hover:bg-white/10 dark:hover:border-white/20'
          >
            <Wand2 className={`w-4 h-4 ${aiLoading ? "animate-spin" : ""}`} />
            <span className='hidden sm:inline'>
              {aiLoading ? "Generating..." : "AI Generate"}
            </span>
            {!hasResumeAiAccess && <LockIcon className='w-3 h-3 opacity-60' />}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !resumeId}
            className='product-outline-button flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 text-xs md:text-sm font-bold whitespace-nowrap disabled:opacity-50'
          >
            <FileText
              className={`w-4 h-4 shrink-0 ${saving ? "animate-pulse" : ""}`}
            />
            <span className='hidden sm:inline'>
              {saving ? "Saving..." : "Save"}
            </span>
          </button>

          <button
            onClick={() => void downloadPdf(resumeData)}
            disabled={exporting}
            className='product-outline-button flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 text-xs md:text-sm font-medium whitespace-nowrap'
          >
            <Download
              className={`w-4 h-4 shrink-0 ${exporting ? "animate-pulse" : ""}`}
            />
            <span className='hidden sm:inline'>
              {exporting ? "Exporting..." : "PDF export"}
            </span>
          </button>
        </div>
      </header>

      {isMobile && (
        <div className='px-4 pb-3 pt-3 flex justify-center border-b border-border/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85'>
          <div className='relative flex p-1 bg-foreground/5 rounded-full border border-foreground/10 backdrop-blur-md w-full max-w-[340px]'>
            <button
              onClick={() => setMobileView("editor")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
                mobileView === "editor"
                  ? "text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mobileView === "editor" && (
                <motion.div
                  layoutId="activeResumeBuilderTab"
                  className="absolute inset-0 bg-brand rounded-full -z-10 shadow-[0_2px_10px_rgba(29,255,0,0.25)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <PenLine size={13} />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setMobileView("preview")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
                mobileView === "preview"
                  ? "text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mobileView === "preview" && (
                <motion.div
                  layoutId="activeResumeBuilderTab"
                  className="absolute inset-0 bg-brand rounded-full -z-10 shadow-[0_2px_10px_rgba(29,255,0,0.25)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>
        </div>
      )}

      {!loadingTier && !hasResumeAiAccess && (
        <div className='px-4 pt-4 md:px-6 md:pt-6'>
          <UpgradePrompt
            compact
            requiredTier='Basics'
            showPricing={false}
            title='Resume AI Optimization'
            description='Unlock AI polish and AI-generated summaries while keeping manual editing and exports on Free.'
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col md:flex-row overflow-hidden'>
        {/* Editor Panel (Left) */}
        <div
          className={`${isMobile && mobileView !== "editor" ? "hidden" : "flex"} product-section-card-muted w-full flex-col overflow-y-auto custom-scrollbar rounded-none border-y-0 border-l-0 ${isMobile ? "pb-6" : "pb-20"} flex-1 md:w-[40%] md:min-w-[350px] md:max-w-[500px] md:flex-initial`}
        >
          <div className='p-4 md:p-6 space-y-4'>
            {/* Content Header */}
            <div className='flex items-center justify-between mb-2'>
              <h3 className='product-helper-text text-xs font-bold uppercase tracking-wider'>
                Content
              </h3>
              <div className='text-[10px] text-brand flex items-center gap-1 font-medium'>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${saving ? "bg-brand/100 animate-pulse" : "bg-brand"}`}
                />
                {editorStatusLabel}
              </div>
            </div>

            {/* Personal Info Section */}
            <div
              className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === "personal" ? "ring-1 ring-brand/50" : "hover:border-brand/30"}`}
            >
              <div
                className='p-5 flex items-center justify-between cursor-pointer'
                onClick={() => toggleSection("personal")}
              >
                <div className='flex items-center gap-3'>
                  <User className='w-5 h-5 text-brand' />
                  <h4 className='font-semibold product-page-title'>
                    Personal Info
                  </h4>
                </div>
                {expandedSection === "personal" ? (
                  <ChevronUp className='w-4 h-4 product-helper-text' />
                ) : (
                  <ChevronDown className='w-4 h-4 product-helper-text' />
                )}
              </div>
              {expandedSection === "personal" && (
                <PersonalDetailsEditor
                  hasProfileAvatar={Boolean(profile?.avatar_url)}
                  profileAvatarUrl={profileAvatarUrl}
                  syncingProfilePhoto={syncingProfilePhoto}
                  onUseProfileImage={useProfileImage}
                  onRefreshProfileImage={refreshProfileImage}
                />
              )}
            </div>

            {/* Summary Section */}
            {!summary.hidden && (
              <div
                className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === "summary" ? "ring-1 ring-brand/50" : "hover:border-brand/30"}`}
              >
                <div
                  className='p-5 flex items-center justify-between cursor-pointer'
                  onClick={() => toggleSection("summary")}
                >
                  <div className='flex items-center gap-3'>
                    <FileText className='w-5 h-5 text-brand' />
                    <h4 className='font-semibold product-page-title'>
                      Summary
                    </h4>
                  </div>
                  {expandedSection === "summary" ? (
                    <ChevronUp className='w-4 h-4 product-helper-text' />
                  ) : (
                    <ChevronDown className='w-4 h-4 product-helper-text' />
                  )}
                </div>

                {expandedSection === "summary" && (
                  <div className='p-5 pt-0 animate-in slide-in-from-top-2 duration-200'>
                    <textarea
                      value={summary.content || ""}
                      onChange={(e) => setSummary(e.target.value)}
                      rows={4}
                      className='product-input-surface w-full rounded-lg px-3 py-2 text-sm outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand'
                      placeholder='Brief professional summary...'
                    />
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Sections */}
            {visibleSections.map((sectionId) => {
              const section = sections[sectionId];
              if (!section || section.hidden) return null;

              const Icon = SECTION_ICONS[sectionId] || SECTION_ICONS.custom;

              return (
                <div
                  key={sectionId}
                  className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === sectionId ? "ring-1 ring-brand/50" : "hover:border-brand/30"}`}
                >
                  <div
                    className='p-5 flex items-center justify-between cursor-pointer'
                    onClick={() => toggleSection(sectionId)}
                  >
                    <div className='flex items-center gap-3'>
                      <Icon className='w-5 h-5 text-brand' />
                      <h4 className='font-semibold product-page-title'>
                        {section.title}
                      </h4>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        className='p-1 hover:bg-muted rounded product-helper-text hover:text-brand transition-colors'
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionVisibility(sectionId);
                        }}
                        title='Hide Section'
                      >
                        <X className='w-4 h-4' />
                      </button>
                      {expandedSection === sectionId ? (
                        <ChevronUp className='w-4 h-4 product-helper-text' />
                      ) : (
                        <ChevronDown className='w-4 h-4 product-helper-text' />
                      )}
                    </div>
                  </div>

                  {expandedSection === sectionId && (
                    <div className='p-5 pt-0'>
                      {section.type === "list" ? (
                        <ListEditor sectionId={sectionId} />
                      ) : (
                        <SectionEditor sectionId={sectionId} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Section Button */}
            <div>
              <Button
                variant='outline'
                className='w-full py-6 border-dashed border-gray-300 dark:border-foreground/20 hover:border-brand hover:text-brand hover:bg-brand/5'
                onClick={() => setIsAddSectionOpen(true)}
              >
                <Plus className='w-5 h-5 mr-2' />
                Add Section
              </Button>
            </div>
          </div>
        </div>

        {/* Preview Panel (Right) */}
        <div
          ref={previewPanelRef}
          className={`${isMobile && mobileView !== "preview" ? "hidden" : "flex"} flex-1 overflow-auto justify-center p-3 md:p-8 relative custom-scrollbar bg-[hsl(var(--product-surface-muted))] dark:bg-background ${isMobile ? "pb-6 pt-4" : ""}`}
        >
          {!isMobile && (
            <div className='absolute right-4 top-4 z-10 flex flex-col gap-2 md:right-8 md:top-8'>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.1, 1.5))}
                className='product-section-card flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full shadow-xl product-helper-text transition-colors hover:text-brand'
              >
                <ZoomIn className='w-4 h-4 md:w-5 md:h-5' />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
                className='product-section-card flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full shadow-xl product-helper-text transition-colors hover:text-brand'
              >
                <ZoomOut className='w-4 h-4 md:w-5 md:h-5' />
              </button>
            </div>
          )}

          <div
            className='shrink-0 transition-[width,min-height] duration-200 bg-white shadow-2xl relative'
            style={{
              width: `${previewFrameWidth}px`,
              minHeight: `${previewFrameHeight}px`,
            }}
          >
            <div
              id='resume-preview-container'
              className='origin-top-left transition-transform duration-200'
              style={{
                width: `${PREVIEW_BASE_WIDTH}px`,
                minHeight: `${PREVIEW_BASE_HEIGHT}px`,
                transform: `scale(${effectivePreviewScale})`,
              }}
            >
              <ResumeTemplateRenderer
                templateId={selectedTemplate}
                pageLayout={resolvedLayoutPage}
              />
            </div>
          </div>
        </div>
      </div>

      <TemplateSelector
        isOpen={isTemplateSelectorOpen}
        onClose={() => setIsTemplateSelectorOpen(false)}
      />
      <AddSectionDialog
        open={isAddSectionOpen}
        onOpenChange={setIsAddSectionOpen}
      />
      <ShareDialog open={isShareOpen} onOpenChange={setIsShareOpen} />
    </div>
  );
};

export { ResumeBuilderPage };
export default ResumeBuilderPage;
