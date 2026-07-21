import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeState } from "@/store/artboard";
import {
  removeResumeDraft,
  saveResumeDraft,
} from "@/lib/resumeDraftStorage";

interface UseResumeDraftPersistenceOptions {
  key: string;
  resume: ResumeState;
  enabled: boolean;
  sourceUpdatedAt: string | null;
  delayMs?: number;
}

const serializeResume = (resume: ResumeState) => JSON.stringify(resume);

export function useResumeDraftPersistence({
  key,
  resume,
  enabled,
  sourceUpdatedAt,
  delayMs = 2_000,
}: UseResumeDraftPersistenceOptions) {
  const latestResumeRef = useRef(resume);
  const lastSavedSignatureRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    latestResumeRef.current = resume;
  }, [resume]);

  const markBaseline = useCallback((snapshot: ResumeState) => {
    latestResumeRef.current = snapshot;
    lastSavedSignatureRef.current = serializeResume(snapshot);
  }, []);

  const clear = useCallback(async () => {
    await removeResumeDraft(key);
    setLastSavedAt(null);
  }, [key]);

  const persistLatest = useCallback(async () => {
    if (!enabled) return;
    const snapshot = structuredClone(latestResumeRef.current);
    const signature = serializeResume(snapshot);
    if (signature === lastSavedSignatureRef.current) return;

    await saveResumeDraft({
      key,
      resume: snapshot,
      updatedAt: Date.now(),
      sourceUpdatedAt,
    });
    lastSavedSignatureRef.current = signature;
    setLastSavedAt(Date.now());
  }, [enabled, key, sourceUpdatedAt]);

  useEffect(() => {
    if (!enabled) return;
    const signature = serializeResume(resume);
    if (signature === lastSavedSignatureRef.current) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void persistLatest().catch((error: Error) => {
        console.error("Resume draft autosave failed:", error);
      });
    }, delayMs);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [delayMs, enabled, persistLatest, resume]);

  useEffect(() => {
    const flush = () => {
      void persistLatest().catch((error: Error) => {
        console.error("Resume draft flush failed:", error);
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [persistLatest]);

  return {
    lastSavedAt,
    markBaseline,
    clear,
  } as const;
}
