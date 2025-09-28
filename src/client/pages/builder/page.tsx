import type { ResumeDto } from "@reactive-resume/dto";
import { useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import type { LoaderFunction } from "react-router-dom";
import { redirect } from "react-router-dom";
import slugify from "@sindresorhus/slugify";
import { generateRandomName } from "@reactive-resume/utils";
import { createResume as createResumeRequest } from "@/client/services/resume/create";
import { buildDefaultResumeData, normalizeResume } from "@/client/utils/normalize-resume";

import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { useResumeStore } from "@/client/stores/resume";
import { useArtboardStore } from "../../../store/artboard";
import { Loader2 } from "lucide-react";

export const BuilderPage = () => {
  const resume = useResumeStore((state) => state.resume);
  const title = useResumeStore((state) => state.resume?.title || "Builder");
  const data = useResumeStore((state) => state.resume?.data);
  const setArtboardResume = useArtboardStore((state) => state.setResume);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

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

      {/* Render artboard via iframe and pass resume via postMessage */}
      <div className="mt-16 w-screen" style={{ height: `calc(100vh - 64px)` }}>
        <iframe
          ref={iframeRef}
          title="Artboard Builder"
          src="/artboard/builder"
          className="w-full h-full border-0 bg-black"
          onLoad={() => {
            if (data && iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage({ type: 'SET_RESUME', payload: { resume: data } }, '*');
            }
          }}
        />
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
  const { resume: normalized } = normalizeResume(resume);
  useResumeStore.setState({ resume: normalized });
  return normalized;
  } catch {
    return redirect("/dashboard");
  }
};

// Loader used for /builder/new – creates a resume then redirects to /builder/:id
export const builderNewLoader: LoaderFunction = async () => {
  try {
    const title = generateRandomName();
    const slug = slugify(title);
  const seed = buildDefaultResumeData();
  const resume = await createResumeRequest({ title, slug, visibility: "private", data: seed } as any);
  const { resume: normalized } = normalizeResume(resume);
    // Prime caches & store so redirected page renders instantly
    queryClient.setQueryData<ResumeDto>(["resume", { id: normalized.id }], normalized);
    queryClient.setQueryData<ResumeDto[]>(["resumes"], (cache) => {
      if (!cache) return [normalized];
      return [...cache, normalized];
    });
    useResumeStore.setState({ resume: normalized });
    return redirect(`/builder/${normalized.id}`);
  } catch {
    return redirect("/dashboard/resumes");
  }
};

// --- helpers ---------------------------------------------------------------
// local helpers removed in favor of shared utility
