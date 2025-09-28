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
// (loading spinner replaced by ResumeSkeleton component)
import { ResumeSkeleton } from "@/client/components/system/ResumeSkeleton";

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
  if (!resume || !resume.id) return <ResumeSkeleton />;

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
