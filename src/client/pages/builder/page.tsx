import type { ResumeDto } from "@reactive-resume/dto";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import type { LoaderFunction } from "react-router-dom";
import { redirect } from "react-router-dom";

import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { useResumeStore } from "@/client/stores/resume";
import { useArtboardStore } from "../../../store/artboard";
import { Loader2 } from "lucide-react";
import { KickstartPanel } from "./_components/kickstart";
import { ArtboardCanvas } from "./_components/artboard-canvas";
import { DebugOverlay } from "./_components/debug-overlay";

export const BuilderPage = () => {
  const resume = useResumeStore((state) => state.resume);
  const title = useResumeStore((state) => state.resume?.title || "Builder");
  const data = useResumeStore((state) => state.resume?.data);
  const setArtboardResume = useArtboardStore((state) => state.setResume);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [kickstartOpen, setKickstartOpen] = useState<boolean>(false);

  const printArtboard = useCallback(() => {
    window.dispatchEvent(new CustomEvent("ARTBOARD_CMD", { detail: { type: "PRINT" } }));
  }, []);

  const kickstartDismissed = useResumeStore(
    (s) => s.resume?.data?.metadata?.ui?.kickstartDismissed ?? false,
  );

  const isNewish = useMemo(() => {
    const d = data as any;
    if (!d) return false;
    const hasSummary = !!d.sections?.summary?.content;
    const hasExp = Array.isArray(d.sections?.experience?.items) && d.sections.experience.items.length > 0;
    const hasSkills = Array.isArray(d.sections?.skills?.items) && d.sections.skills.items.length > 0;
    return !(hasSummary || hasExp || hasSkills);
  }, [data]);

  useEffect(() => {
    if (isNewish && !kickstartDismissed) {
      setKickstartOpen(true);
    }
  }, [isNewish, kickstartDismissed]);

  // If artboard is embedded as a route in the same app, we still keep local store in sync
  useEffect(() => {
    if (data) setArtboardResume(data);
  }, [data, setArtboardResume]);

  // Post resume to iframe-based artboard once loaded and whenever data changes
  useEffect(() => {
    const post = () => {
      if (!iframeRef.current?.contentWindow || !data) return;
      iframeRef.current.contentWindow.postMessage({ type: 'SET_RESUME', payload: { resume: data } }, '*');
    };
    post();
    const id = window.setTimeout(post, 200); // retry shortly in case load is late
    return () => window.clearTimeout(id);
  }, [data]);

  // Minimal guard to avoid blank page before store is hydrated
  if (!resume || !resume.id) {
    return (
      <>
        <Helmet>
          <style>{`
            @keyframes neonPulse {
              0%, 100% { box-shadow: 0 0 0 rgba(29,255,0,0); }
              50% { box-shadow: 0 0 24px rgba(29,255,0,0.25), 0 0 48px rgba(29,255,0,0.15); }
            }
          `}</style>
        </Helmet>
        <div className="h-screen w-screen bg-black grid place-items-center">
          <div
            className="rounded-2xl border border-[#1dff00]/30 ring-1 ring-[#1dff00]/20 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] p-6 shadow-xl shadow-[#1dff00]/10"
            style={{ animation: "neonPulse 2s ease-in-out infinite" }}
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 text-[#1dff00] animate-spin" />
              <div>
                <p className="text-white font-medium">Loading Resume Builder…</p>
                <p className="text-xs text-[#888]">Preparing your artboard</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {title} - JobRaker
        </title>
      </Helmet>

      {/* Render artboard inline to avoid blank iframe on deployments */}
      <div className="relative mt-16 w-screen" style={{ height: `calc(100vh - 64px)` }}>
        <div className="pointer-events-auto absolute right-4 top-2 z-20">
          <button onClick={printArtboard} className="rounded border border-black/10 bg-white/80 px-3 py-1 text-xs shadow hover:bg-white">
            Print / PDF
          </button>
        </div>
        {/* Kickstart Onboarding, show once for new/empty resumes unless dismissed */}
        {isNewish && !kickstartDismissed && kickstartOpen && (
          <KickstartPanel onClose={() => setKickstartOpen(false)} />
        )}
        <ArtboardCanvas />
        <DebugOverlay />
      </div>
    </>
  );
};

export const builderLoader: LoaderFunction<ResumeDto> = async ({ params }) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const id = params.id!;

    const resume = await queryClient.fetchQuery({
      queryKey: ["resume", { id }],
      queryFn: () => findResumeById({ id }),
    });

  useResumeStore.setState({ resume });

    return resume;
  } catch {
    return redirect("/dashboard");
  }
};
