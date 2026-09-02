import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useResumeRecord } from "@/hooks/useResumeRecord";
import { useResumeDraftPersistence } from "@/hooks/useResumeDraftPersistence";
import { loadResumeDraft } from "@/lib/resumeDraftStorage";
import { loadParsedResumeProfileData } from "@/lib/parsedResume";
import { mapParsedDataToResume } from "@/lib/resume-mapper";
import {
  buildHydratedResumeState,
  needsResumeRepair,
  normalizeResumeDataForEditor,
} from "@/lib/resumeHydration";
import {
  initialResumeState,
  type ResumeData,
  type ResumeState,
} from "@/store/artboard";
import { getResumeSourceType } from "@/lib/resumeDocumentSchema";
import type { ResumeEditorEvent } from "@/lib/resumeEditorState";

type Notify = (title: string, message: string) => void;

interface UseResumeHydrationOptions {
  resumeId?: string | null;
  resume: ResumeState;
  supabase: SupabaseClient;
  setResume: (resume: ResumeState) => void;
  setResumeId: (id: string) => void;
  dispatchEditor: Dispatch<ResumeEditorEvent>;
  info: Notify;
  error: Notify;
}

export function useResumeHydration({
  resumeId,
  resume,
  supabase,
  setResume,
  setResumeId,
  dispatchEditor,
  info,
  error,
}: UseResumeHydrationOptions) {
  const queryClient = useQueryClient();
  const {
    data: remoteResume,
    error: remoteResumeError,
    isPending: isRemoteResumePending,
  } = useResumeRecord(resumeId);
  const [hydrationReady, setHydrationReady] = useState(false);
  const serverUpdatedAtRef = useRef<string | null>(null);
  const restoredDraftNoticeRef = useRef(false);
  const draftStorageKey = `resume_draft_${resumeId || "new"}`;
  const {
    lastSavedAt,
    markBaseline,
    clear,
  } = useResumeDraftPersistence({
    key: draftStorageKey,
    resume,
    enabled: hydrationReady,
    sourceUpdatedAt: serverUpdatedAtRef.current,
  });

  useEffect(() => {
    let cancelled = false;

    const hydrateResume = async () => {
      setHydrationReady(false);
      dispatchEditor({ type: "LOAD" });
      restoredDraftNoticeRef.current = false;
      serverUpdatedAtRef.current = null;

      if (!resumeId) {
        const initialState = structuredClone(initialResumeState);
        setResume(initialState);
        markBaseline(initialState);
        setHydrationReady(true);
        return;
      }

      if (isRemoteResumePending) return;

      const localDraft = await loadResumeDraft(draftStorageKey);
      if (cancelled) return;

      const normalizedRemoteData = remoteResume
        ? normalizeResumeDataForEditor(
            remoteResume.data,
            remoteResume.name || initialResumeState.data.title,
          )
        : null;

      const isImportedResume =
        Boolean(remoteResume?.file_path) ||
        Boolean(normalizedRemoteData && getResumeSourceType(normalizedRemoteData) === "imported");
      const missingImportedSections =
        Boolean(isImportedResume &&
        normalizedRemoteData &&
        ((normalizedRemoteData.sections?.education?.items?.length ?? 0) === 0 ||
          (normalizedRemoteData.basics?.profiles?.length ?? 0) === 0));

      if (remoteResumeError || !remoteResume) {
        if (localDraft?.resume) {
          setResume(localDraft.resume);
          setResumeId(localDraft.resume.id);
          info("Draft restored", "We restored your local unsaved changes.");
        } else {
          const freshState = structuredClone(initialResumeState);
          setResume(freshState);
          setResumeId("");
          markBaseline(freshState);
          error(
            "Resume not found",
            "We couldn't load this resume. You'll be using a fresh template.",
          );
        }
      } else if (normalizedRemoteData && !needsResumeRepair(normalizedRemoteData) && !missingImportedSections) {
        const remoteState = buildHydratedResumeState(
          remoteResume,
          normalizedRemoteData,
        );
        serverUpdatedAtRef.current = remoteResume.updated_at ?? null;
        markBaseline(remoteState);
        setResume(remoteState);
        setResumeId(remoteResume.id);
      } else {
          const canRestoreLocalDraft =
            Boolean(localDraft?.resume) &&
            !needsResumeRepair(localDraft?.resume?.data) &&
            (!remoteResume.updated_at ||
              !localDraft?.sourceUpdatedAt ||
              localDraft.sourceUpdatedAt === remoteResume.updated_at);
          const parsedProfile = await loadParsedResumeProfileData({
            supabase,
            resumeId: remoteResume.id,
            fallbackName: remoteResume.name,
          });

          if (cancelled) return;

          let hydratedData: ResumeData;
          if (parsedProfile) {
            if (normalizedRemoteData && !needsResumeRepair(normalizedRemoteData)) {
              // Keep existing non-placeholder content, enrich missing education and social profiles from parsed resume
              hydratedData = structuredClone(normalizedRemoteData);
              const mappedFromParsed = mapParsedDataToResume(
                parsedProfile,
                structuredClone(initialResumeState.data),
              );

              if (
                (hydratedData.sections?.education?.items?.length ?? 0) === 0 &&
                (mappedFromParsed.sections?.education?.items?.length ?? 0) > 0
              ) {
                hydratedData.sections.education = mappedFromParsed.sections.education;
              }

              if (
                (hydratedData.basics?.profiles?.length ?? 0) === 0 &&
                (mappedFromParsed.basics?.profiles?.length ?? 0) > 0
              ) {
                hydratedData.basics.profiles = mappedFromParsed.basics.profiles;
                if (!hydratedData.basics.website?.url && mappedFromParsed.basics.website?.url) {
                  hydratedData.basics.website = mappedFromParsed.basics.website;
                }
              }
            } else {
              hydratedData = mapParsedDataToResume(
                parsedProfile,
                structuredClone(normalizedRemoteData ?? initialResumeState.data),
              );
            }
          } else {
            hydratedData = normalizedRemoteData ?? {
              ...structuredClone(initialResumeState.data),
              title: remoteResume.name || initialResumeState.data.title,
            };
          }

          const hydratedState = buildHydratedResumeState(
            remoteResume,
            hydratedData,
          );

          serverUpdatedAtRef.current = remoteResume.updated_at ?? null;
          markBaseline(hydratedState);
          setResume(hydratedState);
          setResumeId(remoteResume.id);

          if (parsedProfile) {
            const shouldPersist =
              Boolean(normalizedRemoteData && needsResumeRepair(normalizedRemoteData)) ||
              missingImportedSections;

            if (shouldPersist) {
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
                console.warn("Failed to persist enriched resume data", repairError);
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
            await clear();
          } else if (canRestoreLocalDraft && localDraft?.resume) {
          serverUpdatedAtRef.current = localDraft.sourceUpdatedAt ?? null;
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

      if (!cancelled) setHydrationReady(true);
    };

    void hydrateResume();
    return () => {
      cancelled = true;
    };
  }, [
    clear,
    dispatchEditor,
    draftStorageKey,
    error,
    info,
    isRemoteResumePending,
    markBaseline,
    queryClient,
    remoteResume,
    remoteResumeError,
    resumeId,
    setResume,
    setResumeId,
    supabase,
  ]);

  return {
    hydrationReady,
    lastDraftSavedAt: lastSavedAt,
    markDraftBaseline: markBaseline,
    clearResumeDraft: clear,
    serverUpdatedAtRef,
  } as const;
}
