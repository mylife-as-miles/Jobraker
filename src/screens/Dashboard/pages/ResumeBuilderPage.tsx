import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Edit2,
  LayoutTemplate,
  Sparkles,
  Wand2,
  Download,
  User,
  ChevronUp,
  ChevronDown,
  Briefcase,
  Plus,
  GraduationCap,
  BrainCircuit,
  X,
  Eye,
  PenLine,
  ZoomIn,
  ZoomOut,
  FileText,
  FolderGit2,
  Languages,
  Heart,
  Trophy,
  Scroll,
  BookOpen,
  HandHeart,
  Users,
  Lock,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useArtboardStore } from "../../../store/artboard";
import { useResumeProfilePhoto } from "../../../hooks/useResumeProfilePhoto";
import { createClient } from "../../../lib/supabaseClient";
import { ResumeTemplateRenderer } from "../../../templates/render-resume-template";
import { TemplateSelector } from "../components/TemplateSelector";
import { AddSectionDialog } from "../components/resume/AddSectionDialog";
import { SectionEditor } from "../components/resume/SectionEditor";
import { ListEditor } from "../components/resume/ListEditor";
import { PersonalDetailsEditor } from "../components/resume/PersonalDetailsEditor";
import { ShareDialog } from "../components/resume/ShareDialog";
import { Share2 } from "lucide-react";

import { useProfileSettings } from "../../../hooks/useProfileSettings";
import { Button } from "../../../components/ui/button";
import Modal from "../../../components/ui/modal";
import { downloadResumePDF } from "../../../utils/resume-download";
import { useToast } from "../../../components/ui/toast";
import { polishContent } from "../../../services/ai/polishContent";
import { UpgradePrompt } from "../../../components/UpgradePrompt";
import {
  getResumeDraftStorageKey,
  loadResumeDraft,
  removeResumeDraft,
  saveResumeDraft,
} from "@/lib/resumeDraftStorage";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";

const SECTION_ICONS: Record<string, any> = {
  experience: Briefcase,
  education: GraduationCap,
  skills: BrainCircuit,
  projects: FolderGit2,
  languages: Languages,
  interests: Heart,
  awards: Trophy,
  certifications: Scroll,
  publications: BookOpen,
  volunteer: HandHeart,
  references: Users,
  custom: LayoutTemplate,
};

const PREVIEW_BASE_WIDTH = 794;
const PREVIEW_BASE_HEIGHT = 1123;
const DRAFT_AUTOSAVE_DELAY_MS = 450;

export const ResumeBuilderPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const urlId = location.pathname.split("/")[4] || null;
  const [zoom, setZoom] = useState(0.8);
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  const [isMobile, setIsMobile] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null);
  const [previewScale, setPreviewScale] = useState(0.8);
  const { success, error: toastError, info } = useToast();
  const supabase = createClient();
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasResumeAiAccess = hasSubscriptionAccess(subscriptionTier, "Basics");
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const latestResumeStateRef = useRef(useArtboardStore.getState().resume);
  const lastDraftSignatureRef = useRef("");
  const draftHydratedRef = useRef(false);
  const restoredDraftNoticeRef = useRef(false);
  const serverUpdatedAtRef = useRef<string | null>(null);
  const draftStorageKey = React.useMemo(
    () => getResumeDraftStorageKey(urlId),
    [urlId],
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Store State & Actions
  const resumeState = useArtboardStore((state) => state.resume);
  const resumeId = useArtboardStore((state) => state.resume.id);
  const resumeData = useArtboardStore((state) => state.resume.data);
  const setResume = useArtboardStore((state) => state.setResume);
  const setResumeId = useArtboardStore((state) => state.setResumeId);
  const setResumeData = useArtboardStore((state) => state.setResumeData);
  const setResumeTitle = useArtboardStore((state) => state.setResumeTitle);

  React.useEffect(() => {
    latestResumeStateRef.current = resumeState;
  }, [resumeState]);

  // Fetch Resume and restore any newer local draft for this builder
  React.useEffect(() => {
    let cancelled = false;
    restoredDraftNoticeRef.current = false;
    draftHydratedRef.current = false;

    const hydrateResume = async () => {
      let remoteResume: any = null;

      if (urlId) {
        try {
          const { data, error } = await supabase
            .from("resumes")
            .select("*")
            .eq("id", urlId)
            .single();

          if (error) throw error;
          remoteResume = data;
        } catch (error) {
          console.error("Error loading resume:", error);
        }
      }

      let localDraft = null;
      try {
        localDraft = await loadResumeDraft(draftStorageKey);
      } catch (draftError) {
        console.error("Error loading local resume draft:", draftError);
      }

      if (cancelled) return;

      const remoteUpdatedAtMs = remoteResume?.updated_at
        ? Date.parse(remoteResume.updated_at)
        : 0;
      const shouldRestoreDraft = Boolean(
        localDraft?.resume &&
          (!remoteUpdatedAtMs || localDraft.updatedAt >= remoteUpdatedAtMs),
      );

      if (shouldRestoreDraft && localDraft?.resume) {
        serverUpdatedAtRef.current =
          localDraft.sourceUpdatedAt ?? remoteResume?.updated_at ?? null;
        lastDraftSignatureRef.current = JSON.stringify(localDraft.resume);
        setResume({
          ...localDraft.resume,
          id: urlId || localDraft.resume.id,
        });
        setResumeId(urlId || localDraft.resume.id);
        if (!restoredDraftNoticeRef.current) {
          restoredDraftNoticeRef.current = true;
          info(
            "Draft restored",
            "We restored your unsaved resume draft from this device.",
          );
        }
      } else if (remoteResume?.data) {
        const remoteState = {
          id: remoteResume.id,
          is_public: remoteResume.public_share_enabled,
          views: remoteResume.views || 0,
          downloads: remoteResume.downloads || 0,
          data: remoteResume.data,
        };

        serverUpdatedAtRef.current = remoteResume.updated_at ?? null;
        lastDraftSignatureRef.current = JSON.stringify(remoteState);
        setResume(remoteState);
      } else if (localDraft?.resume) {
        serverUpdatedAtRef.current = localDraft.sourceUpdatedAt ?? null;
        lastDraftSignatureRef.current = JSON.stringify(localDraft.resume);
        setResume(localDraft.resume);
        setResumeId(localDraft.resume.id);
        if (!restoredDraftNoticeRef.current) {
          restoredDraftNoticeRef.current = true;
          info(
            "Draft restored",
            "We restored your unsaved resume draft from this device.",
          );
        }
      }
      draftHydratedRef.current = true;
    };

    void hydrateResume();

    return () => {
      cancelled = true;
    };
  }, [draftStorageKey, info, setResume, setResumeId, supabase, urlId]);

  // Profile Data for Auto-population
  const {
    profile,
    experiences,
    education: profileEducation,
    skills: profileSkills,
  } = useProfileSettings();
  const [userEmail, setUserEmail] = useState("");

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, [supabase]);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (!draftHydratedRef.current) return;

    const signature = JSON.stringify(resumeState);
    if (signature === lastDraftSignatureRef.current) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      const snapshot = JSON.parse(
        JSON.stringify(latestResumeStateRef.current),
      ) as typeof resumeState;
      const snapshotSignature = JSON.stringify(snapshot);

      void saveResumeDraft({
        key: draftStorageKey,
        resume: snapshot,
        updatedAt: Date.now(),
        sourceUpdatedAt: serverUpdatedAtRef.current,
      })
        .then(() => {
          lastDraftSignatureRef.current = snapshotSignature;
          setLastDraftSavedAt(Date.now());
        })
        .catch((draftError) => {
          console.error("Resume draft autosave failed:", draftError);
        });
    }, DRAFT_AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [draftStorageKey]);

  React.useEffect(() => {
    const flushDraft = () => {
      if (!draftHydratedRef.current) return;

      const snapshot = JSON.parse(
        JSON.stringify(latestResumeStateRef.current),
      ) as typeof resumeState;
      const snapshotSignature = JSON.stringify(snapshot);

      if (snapshotSignature === lastDraftSignatureRef.current) return;

      void saveResumeDraft({
        key: draftStorageKey,
        resume: snapshot,
        updatedAt: Date.now(),
        sourceUpdatedAt: serverUpdatedAtRef.current,
      })
        .then(() => {
          lastDraftSignatureRef.current = snapshotSignature;
        })
        .catch((draftError) => {
          console.error("Resume draft flush failed:", draftError);
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [draftStorageKey, resumeState]);

  // Auto-populate logic (simplified for brevity, keeping existing logic)
  React.useEffect(() => {
    if (!resumeId && resumeData.basics.name === "John Doe" && profile) {
      const updatedBasics = {
        ...resumeData.basics,
        name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
        headline: profile.job_title || resumeData.basics.headline,
        location: profile.location || resumeData.basics.location,
        email: userEmail || resumeData.basics.email,
        phone: profile.phone || resumeData.basics.phone,
      };
      updateBasics(updatedBasics);
    }
  }, [
    profile,
    experiences.data,
    profileEducation.data,
    profileSkills.data,
    resumeId,
    resumeData.basics.name,
    userEmail,
  ]);

  // Actions
  const updateBasics = useArtboardStore((state) => state.updateBasics);
  const toggleSectionVisibility = useArtboardStore(
    (state) => state.toggleSectionVisibility,
  );
  const {
    profileAvatarUrl,
    syncingProfilePhoto,
    syncProfilePicture,
  } = useResumeProfilePhoto({
    picture: resumeData.basics.picture,
    profileAvatarPath: profile?.avatar_url || null,
    supabase,
    updateBasics,
  });

  const useProfileImage = React.useCallback(
    async () => Boolean(await syncProfilePicture(true)),
    [syncProfilePicture],
  );
  const refreshProfileImage = React.useCallback(
    async () => Boolean(await syncProfilePicture(true)),
    [syncProfilePicture],
  );

  // Helper for summary
  const setSummary = (val: string) =>
    setResumeData({ summary: { ...resumeData.summary, content: val } });

  const { basics, sections, summary, metadata } = resumeData;

  // Get active sections from layout order
  const layoutPage = metadata.layout.pages[0];
  const orderedSectionIds = [...layoutPage.main, ...layoutPage.sidebar];
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

  const downloadPDF = () => {
    downloadResumePDF(resumeData);
  };

  const aiPolishSummary = async (instruction = "Polish this resume summary for clarity, confidence, and measurable impact.") => {
    if (!hasResumeAiAccess) {
      toastError("Upgrade required", "Resume AI tools are available on Basics and above.");
      return;
    }
    setAiLoading(true);
    try {
      const source = (summary.content || basics.headline || basics.name || "").trim();
      if (!source) throw new Error("Add a summary or headline first.");
      const suggestions = await polishContent(source, instruction);
      const nextSummary = suggestions.find((item) => item.isRecommended)?.content || suggestions[0]?.content || "";
      if (!nextSummary) throw new Error("No AI suggestion was returned.");
      setSummary(nextSummary); success(instruction.includes("fresh") ? "Summary generated" : "Summary polished", instruction.includes("fresh") ? "A new AI summary has been added to your resume." : "AI suggestions have been applied to your resume summary.");
    } catch (e: any) { toastError(instruction.includes("fresh") ? "AI generation failed" : "AI rewrite failed", e?.message || "AI is temporarily unavailable."); } finally { setAiLoading(false); }
  };
  const aiGenerateResume = async () => aiPolishSummary("Write a fresh professional resume summary in 3-4 concise sentences.");
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);
  const effectivePreviewScale = isMobile ? previewScale : zoom;
  const previewFrameWidth = PREVIEW_BASE_WIDTH * effectivePreviewScale;
  const previewFrameHeight = PREVIEW_BASE_HEIGHT * effectivePreviewScale;
  const editorStatusLabel = saving
    ? "Saving..."
    : lastDraftSavedAt
      ? "Autosaved locally"
      : "Ready";

  const handleSave = async () => {
    if (!urlId) return;
    setSaving(true);
    try {
      const pictureSnapshot = await syncProfilePicture(false);
      const dataToSave = pictureSnapshot
        ? {
            ...resumeData,
            basics: { ...resumeData.basics, picture: pictureSnapshot },
          }
        : resumeData;
      const { error } = await supabase
        .from("resumes")
        .update({
          data: dataToSave,
          name: dataToSave.title,
          slug: dataToSave.slug,
          tags: dataToSave.tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", urlId);
      if (error) throw error;
      serverUpdatedAtRef.current = new Date().toISOString();
      lastDraftSignatureRef.current = JSON.stringify({
        ...latestResumeStateRef.current,
        id: urlId,
        data: dataToSave,
      });
      await removeResumeDraft(draftStorageKey);
      setLastDraftSavedAt(null);
      success("Resume saved", "Your latest resume changes have been saved.");
      setSaveAlertOpen(true);
    } catch (e: any) {
      toastError("Save failed", e?.message || "Unable to save your resume right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='product-page-shell flex flex-col h-full relative overflow-hidden'>
      {/* Save Alert Modal */}
      <Modal
        open={saveAlertOpen}
        onClose={() => setSaveAlertOpen(false)}
        title="Resume Saved"
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setSaveAlertOpen(false)}>Close</Button>
          </div>
        }
      >
        <div className="text-foreground/80 py-4">
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
          <div className='group flex min-w-0 flex-1 items-center gap-2'>
            <input
              value={resumeData.title || "Untitled Resume"}
              onChange={(e) => setResumeTitle(e.target.value)}
              className='product-page-title w-full min-w-0 rounded bg-transparent px-1 text-base font-semibold outline-none focus:ring-1 focus:ring-[#ffd700] md:text-lg'
            />
            <Edit2 className='product-helper-text w-3.5 h-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
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
            className='flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 rounded-lg bg-[#1dff00] hover:bg-[#15bd00] text-black text-xs md:text-sm font-bold transition-all shadow-[0_0_15px_rgba(29,255,0,0.3)] whitespace-nowrap disabled:opacity-60'
          >
            <Sparkles className='w-4 h-4 shrink-0' />
            <span className='hidden sm:inline'>
              {aiLoading ? "Polishing..." : "AI Polish"}
            </span>
            {!hasResumeAiAccess && <Lock className='w-3 h-3 opacity-60' />}
          </button>
          <button
            onClick={aiGenerateResume}
            disabled={aiLoading || loadingTier}
            className='product-outline-button hidden md:flex items-center gap-2 px-4 py-2 text-sm font-bold hover:border-[#ffd700]/60 hover:bg-[#fff2b3]'
          >
            <Wand2 className={`w-4 h-4 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Generating..." : "AI Generate"}
            {!hasResumeAiAccess && <Lock className='w-3 h-3 opacity-60' />}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !urlId}
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
            onClick={downloadPDF}
            className='product-outline-button flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 text-xs md:text-sm font-medium whitespace-nowrap'
          >
            <Download className='w-4 h-4 shrink-0' />
            <span className='hidden sm:inline'>PDF</span>
          </button>
        </div>
      </header>

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
          className={`${isMobile && mobileView !== "editor" ? "hidden" : "flex"} product-section-card-muted w-full flex-col overflow-y-auto custom-scrollbar rounded-none border-y-0 border-l-0 ${isMobile ? "pb-24" : "pb-20"} flex-1 md:w-[40%] md:min-w-[350px] md:max-w-[500px] md:flex-initial`}
        >
          <div className='p-4 md:p-6 space-y-4'>
            {/* Content Header */}
            <div className='flex items-center justify-between mb-2'>
              <h3 className='product-helper-text text-xs font-bold uppercase tracking-wider'>
                Content
              </h3>
              <div className='text-[10px] text-[#1dff00] flex items-center gap-1 font-medium'>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${saving ? "bg-yellow-500 animate-pulse" : "bg-[#1dff00]"}`}
                />
                {editorStatusLabel}
              </div>
            </div>

            {/* Personal Info Section */}
            <div
              className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === "personal" ? "ring-1 ring-[#1dff00]/50" : "hover:border-[#1dff00]/30"}`}
            >
              <div
                className='p-5 flex items-center justify-between cursor-pointer'
                onClick={() => toggleSection("personal")}
              >
                <div className='flex items-center gap-3'>
                  <User className='w-5 h-5 text-[#1dff00]' />
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
                className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === "summary" ? "ring-1 ring-[#1dff00]/50" : "hover:border-[#1dff00]/30"}`}
              >
                <div
                  className='p-5 flex items-center justify-between cursor-pointer'
                  onClick={() => toggleSection("summary")}
                >
                  <div className='flex items-center gap-3'>
                    <FileText className='w-5 h-5 text-[#1dff00]' />
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
                      className='product-input-surface w-full rounded-lg px-3 py-2 text-sm outline-none transition-all focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700]'
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
                  className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === sectionId ? "ring-1 ring-[#1dff00]/50" : "hover:border-[#1dff00]/30"}`}
                >
                  <div
                    className='p-5 flex items-center justify-between cursor-pointer'
                    onClick={() => toggleSection(sectionId)}
                  >
                    <div className='flex items-center gap-3'>
                      <Icon className='w-5 h-5 text-[#1dff00]' />
                      <h4 className='font-semibold product-page-title'>
                        {section.title}
                      </h4>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        className='p-1 hover:bg-muted rounded product-helper-text hover:text-red-500 transition-colors'
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
            <div className='pt-4 pb-20'>
              <Button
                variant='outline'
                className='w-full py-6 border-dashed border-gray-300 dark:border-foreground/20 hover:border-[#1dff00] hover:text-[#1dff00] hover:bg-[#1dff00]/5'
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
          className={`${isMobile && mobileView !== "preview" ? "hidden" : "flex"} flex-1 overflow-auto justify-center p-3 md:p-8 relative custom-scrollbar bg-[hsl(var(--product-surface-muted))] dark:bg-background ${isMobile ? "pb-24 pt-4" : ""}`}
        >
          {!isMobile && (
          <div className='absolute right-4 top-4 z-10 flex flex-col gap-2 md:right-8 md:top-8'>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.1, 1.5))}
              className='product-section-card flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full shadow-xl product-helper-text transition-colors hover:text-[#ffd700]'
            >
              <ZoomIn className='w-4 h-4 md:w-5 md:h-5' />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
              className='product-section-card flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full shadow-xl product-helper-text transition-colors hover:text-[#ffd700]'
            >
              <ZoomOut className='w-4 h-4 md:w-5 md:h-5' />
            </button>
          </div>
          )}

          <div
            className='shrink-0 transition-[width,min-height] duration-200'
            style={{
              width: `${previewFrameWidth}px`,
              minHeight: `${previewFrameHeight}px`,
            }}
          >
            <div
              className='origin-top-left bg-white shadow-2xl transition-transform duration-200'
              style={{
                width: `${PREVIEW_BASE_WIDTH}px`,
                minHeight: `${PREVIEW_BASE_HEIGHT}px`,
                transform: `scale(${effectivePreviewScale})`,
              }}
            >
              <ResumeTemplateRenderer templateId={selectedTemplate} />
            </div>
          </div>
        </div>
      </div>

      {isMobile && (
        <div className='fixed bottom-0 left-0 right-0 z-50 bg-background/95 border-t border-border/40 backdrop-blur supports-[backdrop-filter]:bg-background/85 flex h-16 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]'>
          <button
            onClick={() => setMobileView("editor")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              mobileView === "editor"
                ? "text-[#1dff00] bg-[#1dff00]/5"
                : "text-muted-foreground"
            }`}
          >
            <PenLine className='w-5 h-5' />
            <span className='text-[11px] font-medium'>Editor</span>
          </button>
          <div className='w-px bg-border/40 my-3' />
          <button
            onClick={() => setMobileView("preview")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              mobileView === "preview"
                ? "text-[#1dff00] bg-[#1dff00]/5"
                : "text-muted-foreground"
            }`}
          >
            <Eye className='w-5 h-5' />
            <span className='text-[11px] font-medium'>Preview</span>
          </button>
        </div>
      )}

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

export default ResumeBuilderPage;
