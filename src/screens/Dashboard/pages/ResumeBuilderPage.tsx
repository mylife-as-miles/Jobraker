import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  type ResumeData,
} from "@/store/artboard";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { polishContent } from "@/services/ai/polishContent";
import { useToast } from "@/components/ui/toast";
import { useResumeProfilePhoto } from "@/hooks/useResumeProfilePhoto";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { createClient } from "@/lib/supabaseClient";
import { useResumeRecord } from "@/hooks/useResumeRecord";
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
import { downloadResumePDF } from "@/utils/resume-download";
import {
  saveResumeDraft,
  loadResumeDraft,
  removeResumeDraft,
} from "@/lib/resumeDraftStorage";
import { loadParsedResumeProfileData } from "@/lib/parsedResume";
import { mapParsedDataToResume } from "@/lib/resume-mapper";

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

const DRAFT_AUTOSAVE_DELAY_MS = 2000;

function buildHydratedResumeState(
  remoteResume: any,
  data = initialResumeState.data,
) {
  return {
    id: remoteResume.id,
    is_public: remoteResume.public_share_enabled,
    views: remoteResume.views || 0,
    downloads: remoteResume.downloads || 0,
    data,
  };
}

function fallbackSection(sectionId: string, section?: Record<string, any>) {
  return {
    id: section?.id || sectionId,
    title:
      section?.title ||
      sectionId.charAt(0).toUpperCase() + sectionId.slice(1).replace(/-/g, " "),
    columns: 1,
    hidden: false,
    items: [],
    type: "basic" as const,
  };
}

function mergeResumeSection(
  baseSection: any,
  sectionId: string,
  section?: Record<string, any>,
) {
  const fallback = baseSection ?? fallbackSection(sectionId, section);

  return {
    ...fallback,
    ...section,
    id: section?.id || fallback.id,
    title: section?.title || fallback.title,
    columns: section?.columns ?? fallback.columns,
    hidden: section?.hidden ?? fallback.hidden,
    items: Array.isArray(section?.items) ? section.items : fallback.items,
    type: section?.type ?? fallback.type,
  };
}

function normalizeResumeDataForEditor(data: unknown, fallbackTitle?: string) {
  const base = structuredClone(initialResumeState.data);

  if (!data || typeof data !== "object") {
    return {
      ...base,
      title: fallbackTitle || base.title,
    };
  }

  const source = data as Record<string, any>;
  const mergedSections = { ...base.sections } as typeof base.sections;

  for (const [sectionId, section] of Object.entries(
    (source.sections as Record<string, Record<string, any>>) ?? {},
  )) {
    mergedSections[sectionId] = mergeResumeSection(
      mergedSections[sectionId],
      sectionId,
      section,
    );
  }

  return {
    ...base,
    ...source,
    title:
      typeof source.title === "string" && source.title.trim()
        ? source.title
        : fallbackTitle || base.title,
    basics: {
      ...base.basics,
      ...(source.basics as Record<string, any> | undefined),
      website: {
        ...base.basics.website,
        ...((source.basics as Record<string, any> | undefined)?.website ?? {}),
      },
      customFields: Array.isArray(
        (source.basics as Record<string, any> | undefined)?.customFields,
      )
        ? (source.basics as Record<string, any>).customFields
        : base.basics.customFields,
      profiles: Array.isArray(
        (source.basics as Record<string, any> | undefined)?.profiles,
      )
        ? (source.basics as Record<string, any>).profiles
        : base.basics.profiles,
      picture:
        (source.basics as Record<string, any> | undefined)?.picture ??
        base.basics.picture,
    },
    summary: {
      ...base.summary,
      ...(source.summary as Record<string, any> | undefined),
      items: Array.isArray(
        (source.summary as Record<string, any> | undefined)?.items,
      )
        ? (source.summary as Record<string, any>).items
        : base.summary.items,
    },
    sections: mergedSections,
    metadata: {
      ...base.metadata,
      ...(source.metadata as Record<string, any> | undefined),
      layout: {
        ...base.metadata.layout,
        ...((source.metadata as Record<string, any> | undefined)?.layout ?? {}),
        pages: Array.isArray(
          (source.metadata as Record<string, any> | undefined)?.layout?.pages,
        )
          ? (source.metadata as Record<string, any>).layout.pages
          : base.metadata.layout.pages,
      },
      page: {
        ...base.metadata.page,
        ...((source.metadata as Record<string, any> | undefined)?.page ?? {}),
        options: {
          ...base.metadata.page.options,
          ...((source.metadata as Record<string, any> | undefined)?.page
            ?.options ?? {}),
        },
      },
      typography: {
        ...base.metadata.typography,
        ...((source.metadata as Record<string, any> | undefined)?.typography ??
          {}),
        font: {
          ...base.metadata.typography.font,
          ...((source.metadata as Record<string, any> | undefined)?.typography
            ?.font ?? {}),
          paragraphSpacing:
            typeof (source.metadata as Record<string, any> | undefined)
              ?.typography?.font?.paragraphSpacing === "number"
              ? (source.metadata as Record<string, any>).typography.font
                  .paragraphSpacing
              : base.metadata.typography.font.paragraphSpacing,
        },
      },
      theme: {
        ...base.metadata.theme,
        ...((source.metadata as Record<string, any> | undefined)?.theme ?? {}),
      },
    },
  };
}

function normalizeHydrationValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isPlaceholderField(value: unknown, fallback: string) {
  const normalizedValue = normalizeHydrationValue(value);
  return (
    !normalizedValue || normalizedValue === normalizeHydrationValue(fallback)
  );
}

function matchesTemplateFields(
  item: Record<string, unknown> | undefined,
  template: Record<string, unknown> | undefined,
  fields: string[],
) {
  if (!item || !template) return false;

  return fields.every(
    (field) =>
      normalizeHydrationValue(item[field]) ===
      normalizeHydrationValue(template[field]),
  );
}

function looksLikePlaceholderResumeData(data: ResumeData | null | undefined) {
  if (!data || typeof data !== "object") {
    return true;
  }

  const basics = data.basics ?? {};
  const summary = data.summary ?? {};
  const experienceItems = Array.isArray(data.sections?.experience?.items)
    ? data.sections.experience.items
    : [];
  const educationItems = Array.isArray(data.sections?.education?.items)
    ? data.sections.education.items
    : [];
  const skillItems = Array.isArray(data.sections?.skills?.items)
    ? data.sections.skills.items
    : [];
  const defaultData = initialResumeState.data;
  const defaultExperienceItems = defaultData.sections.experience.items;
  const defaultEducationItems = defaultData.sections.education.items;
  const defaultSkillItems = defaultData.sections.skills.items;
  const placeholderBasicsCount = [
    isPlaceholderField(basics.name, defaultData.basics.name),
    isPlaceholderField(basics.headline, defaultData.basics.headline),
    isPlaceholderField(basics.email, defaultData.basics.email),
    isPlaceholderField(basics.phone, defaultData.basics.phone),
    isPlaceholderField(basics.location, defaultData.basics.location),
  ].filter(Boolean).length;

  const titleLooksPlaceholder = isPlaceholderField(
    data.title,
    defaultData.title,
  );
  const summaryLooksPlaceholder = isPlaceholderField(
    summary.content,
    defaultData.summary.content || "",
  );
  const experienceLooksPlaceholder = experienceItems.some(
    (item: any, index: number) => {
      const defaultItem = defaultExperienceItems[index];
      return matchesTemplateFields(item, defaultItem, ["company", "position"]);
    },
  );
  const educationLooksPlaceholder = educationItems.some(
    (item: any, index: number) => {
      const defaultItem = defaultEducationItems[index];
      return matchesTemplateFields(item, defaultItem, ["school", "degree"]);
    },
  );
  const skillsLookPlaceholder =
    skillItems.length > 0 &&
    skillItems.every((item: any, index: number) =>
      matchesTemplateFields(item, defaultSkillItems[index], ["name"]),
    );
  const websiteLooksPlaceholder =
    isPlaceholderField(basics.website?.url, defaultData.basics.website.url) &&
    isPlaceholderField(basics.website?.label, defaultData.basics.website.label);
  const structuralPlaceholderCount = [
    titleLooksPlaceholder,
    summaryLooksPlaceholder,
    experienceLooksPlaceholder,
    educationLooksPlaceholder,
    skillsLookPlaceholder,
    websiteLooksPlaceholder,
  ].filter(Boolean).length;

  return (
    (placeholderBasicsCount >= 4 && structuralPlaceholderCount >= 1) ||
    structuralPlaceholderCount >= 2
  );
}

interface ResumeBuilderPageProps {
  resumeId?: string | null;
}

const ResumeBuilderPage = ({ resumeId }: ResumeBuilderPageProps) => {
  const supabase = createClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError, info } = useToast();
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasResumeAiAccess = hasSubscriptionAccess(subscriptionTier, "Basics");
  const {
    data: remoteResume,
    error: remoteResumeError,
    isPending: isRemoteResumePending,
  } = useResumeRecord(resumeId);

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
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  const [isMobile, setIsMobile] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [previewScale, setPreviewScale] = useState(1);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null);
  const [hydrationReady, setHydrationReady] = useState(false);

  const previewPanelRef = useRef<HTMLDivElement>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const draftHydratedRef = useRef(false);
  const latestResumeStateRef = useRef(resumeStateData);
  const lastDraftSignatureRef = useRef<string>("");
  const serverUpdatedAtRef = useRef<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const draftStorageKey = `resume_draft_${resumeId || "new"}`;

  // Keep latest ref updated for autosave
  useEffect(() => {
    latestResumeStateRef.current = resumeStateData;
  }, [resumeStateData]);

  // Responsive Check
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Hydration and Initial Fetch
  useEffect(() => {
    let cancelled = false;
    const hydrateResume = async () => {
      draftHydratedRef.current = false;
      setHydrationReady(false);

      if (!resumeId) {
        setResume(initialResumeState);
        draftHydratedRef.current = true;
        setHydrationReady(true);
        return;
      }

      if (isRemoteResumePending) {
        return;
      }

      const localDraft = await loadResumeDraft(draftStorageKey);
      if (cancelled) return;

      const normalizedRemoteData = remoteResume
        ? normalizeResumeDataForEditor(
            remoteResume.data,
            remoteResume.name || initialResumeState.data.title,
          )
        : null;

      if (remoteResumeError || !remoteResume) {
        if (localDraft?.resume) {
          setResume(localDraft.resume);
          setResumeId(localDraft.resume.id);
          info("Draft restored", "We restored your local unsaved changes.");
        } else {
          toastError(
            "Resume not found",
            "We couldn't load this resume. You'll be using a fresh template.",
          );
        }
      } else if (
        remoteResume &&
        normalizedRemoteData &&
        !looksLikePlaceholderResumeData(normalizedRemoteData)
      ) {
        const remoteState = buildHydratedResumeState(
          remoteResume,
          normalizedRemoteData,
        );
        serverUpdatedAtRef.current = remoteResume.updated_at ?? null;
        lastDraftSignatureRef.current = JSON.stringify(remoteState);
        setResume(remoteState);
        setResumeId(remoteResume.id);
      } else if (remoteResume) {
        const canRestoreLocalDraft =
          Boolean(localDraft?.resume) &&
          !looksLikePlaceholderResumeData(localDraft?.resume?.data) &&
          (!remoteResume.updated_at ||
            !localDraft?.sourceUpdatedAt ||
            localDraft.sourceUpdatedAt === remoteResume.updated_at);
        const parsedProfile = await loadParsedResumeProfileData({
          supabase,
          resumeId: remoteResume.id,
          fallbackName: remoteResume.name,
        });

        if (cancelled) return;

        const hydratedData = parsedProfile
          ? mapParsedDataToResume(
              parsedProfile,
              structuredClone(normalizedRemoteData ?? initialResumeState.data),
            )
          : (normalizedRemoteData ?? {
              ...structuredClone(initialResumeState.data),
              title: remoteResume.name || initialResumeState.data.title,
            });
        const hydratedState = buildHydratedResumeState(
          remoteResume,
          hydratedData,
        );

        serverUpdatedAtRef.current = remoteResume.updated_at ?? null;
        lastDraftSignatureRef.current = JSON.stringify(hydratedState);
        setResume(hydratedState);
        setResumeId(remoteResume.id);

        if (parsedProfile) {
          if (
            normalizedRemoteData &&
            looksLikePlaceholderResumeData(normalizedRemoteData)
          ) {
            const repairTimestamp = new Date().toISOString();
            serverUpdatedAtRef.current = repairTimestamp;

            const { error: repairError } = await supabase
              .from("resumes")
              .update({
                data: hydratedData,
                name: hydratedData.title || remoteResume.name,
                updated_at: repairTimestamp,
              })
              .eq("id", remoteResume.id);

            if (repairError) {
              console.warn(
                "Failed to repair placeholder resume data",
                repairError,
              );
            } else {
              void queryClient.invalidateQueries({
                queryKey: ["resume", remoteResume.id],
              });
            }
          }

          info(
            "Resume imported",
            "We populated the resume editor with details parsed from your uploaded file.",
          );
          await removeResumeDraft(draftStorageKey);
          setLastDraftSavedAt(null);
        } else if (canRestoreLocalDraft && localDraft?.resume) {
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
      }
      draftHydratedRef.current = true;
      setHydrationReady(true);
    };

    void hydrateResume();

    return () => {
      cancelled = true;
    };
  }, [
    draftStorageKey,
    info,
    isRemoteResumePending,
    queryClient,
    remoteResume,
    remoteResumeError,
    resumeId,
    setResume,
    setResumeId,
    supabase,
    toastError,
  ]);

  const restoredDraftNoticeRef = useRef(false);

  // Profile Data for Auto-population
  const { profile, experiences } = useProfileSettings();
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

  useEffect(() => {
    if (!draftHydratedRef.current) return;

    const signature = JSON.stringify(resumeStateData);
    if (signature === lastDraftSignatureRef.current) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      const snapshot = JSON.parse(
        JSON.stringify(latestResumeStateRef.current),
      ) as typeof resumeStateData;
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
        .catch((draftError: Error) => {
          console.error("Resume draft autosave failed:", draftError);
        });
    }, DRAFT_AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [draftStorageKey, resumeStateData]);

  useEffect(() => {
    const flushDraft = () => {
      if (!draftHydratedRef.current) return;

      const snapshot = JSON.parse(
        JSON.stringify(latestResumeStateRef.current),
      ) as typeof resumeStateData;
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
        .catch((draftError: Error) => {
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [draftStorageKey, resumeStateData]);

  const defaultBasics = initialResumeState.data.basics;
  const normalizeFieldValue = (value?: string) =>
    value?.trim().toLowerCase() || "";
  const isPlaceholderBasicsValue = (
    value: string | undefined,
    fallback: string,
  ) => {
    const normalizedValue = normalizeFieldValue(value);
    if (!normalizedValue) return true;
    return normalizedValue === normalizeFieldValue(fallback);
  };

  useEffect(() => {
    if (!hydrationReady) return;

    const profileName =
      `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    const profileHeadline =
      profile?.job_title?.trim() ||
      experiences.data.find((item) => item.is_current)?.title?.trim() ||
      experiences.data[0]?.title?.trim() ||
      "";
    const nextBasicsPatch: Partial<typeof resumeData.basics> = {};

    if (
      profileName &&
      isPlaceholderBasicsValue(resumeData.basics.name, defaultBasics.name)
    ) {
      nextBasicsPatch.name = profileName;
    }

    if (
      profileHeadline &&
      isPlaceholderBasicsValue(
        resumeData.basics.headline,
        defaultBasics.headline,
      )
    ) {
      nextBasicsPatch.headline = profileHeadline;
    }

    if (
      userEmail &&
      isPlaceholderBasicsValue(resumeData.basics.email, defaultBasics.email)
    ) {
      nextBasicsPatch.email = userEmail;
    }

    if (
      profile?.phone &&
      isPlaceholderBasicsValue(resumeData.basics.phone, defaultBasics.phone)
    ) {
      nextBasicsPatch.phone = profile.phone;
    }

    if (
      profile?.location &&
      isPlaceholderBasicsValue(
        resumeData.basics.location,
        defaultBasics.location,
      )
    ) {
      nextBasicsPatch.location = profile.location;
    }

    if (Object.keys(nextBasicsPatch).length > 0) {
      updateBasics(nextBasicsPatch);
    }
  }, [
    defaultBasics.email,
    defaultBasics.headline,
    hydrationReady,
    defaultBasics.location,
    defaultBasics.name,
    defaultBasics.phone,
    experiences.data,
    profile,
    resumeData.basics.email,
    resumeData.basics.headline,
    resumeData.basics.location,
    resumeData.basics.name,
    resumeData.basics.phone,
    userEmail,
    updateBasics,
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

  const downloadPDF = () => {
    void downloadResumePDF(resumeData);
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
    : lastDraftSavedAt
      ? "Autosaved locally"
      : "Ready";

  const handleSave = async () => {
    if (!resumeId) return;
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
        .eq("id", resumeId);
      if (error) throw error;
      serverUpdatedAtRef.current = new Date().toISOString();
      lastDraftSignatureRef.current = JSON.stringify({
        ...latestResumeStateRef.current,
        id: resumeId,
        data: dataToSave,
      });
      await queryClient.invalidateQueries({ queryKey: ["resume", resumeId] });
      await removeResumeDraft(draftStorageKey);
      setLastDraftSavedAt(null);
      success("Resume saved", "Your latest resume changes have been saved.");
      setSaveAlertOpen(true);
    } catch (e: any) {
      toastError(
        "Save failed",
        e?.message || "Unable to save your resume right now.",
      );
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
            onClick={downloadPDF}
            className='product-outline-button flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 text-xs md:text-sm font-medium whitespace-nowrap'
          >
            <Download className='w-4 h-4 shrink-0' />
            <span className='hidden sm:inline'>PDF export</span>
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
