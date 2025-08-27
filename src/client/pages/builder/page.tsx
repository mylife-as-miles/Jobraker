import type { ResumeDto } from "@reactive-resume/dto";
import { useCallback, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import type { LoaderFunction } from "react-router-dom";
import { redirect } from "react-router-dom";

import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { useBuilderStore } from "@/client/stores/builder";
import { useResumeStore } from "@/client/stores/resume";

export const BuilderPage = () => {
  const frameRef = useBuilderStore((state) => state.frame.ref);
  const setFrameRef = useBuilderStore((state) => state.frame.setRef);

  const resume = useResumeStore((state) => state.resume);
  const title = useResumeStore((state) => state.resume?.title || "Builder");
  const data = useResumeStore((state) => state.resume?.data);

  const syncResumeToArtboard = useCallback(() => {
    // Defer posting to next macrotask to ensure iframe is ready
    setTimeout(() => {
      if (!frameRef?.contentWindow || !data) return;
      const message = { type: "SET_RESUME", payload: data };
      frameRef.contentWindow.postMessage(message, "*");
    }, 0);
  }, [frameRef?.contentWindow, data]);

  // Send resume data to iframe on initial load
  useEffect(() => {
    if (!frameRef) return;

    frameRef.addEventListener("load", syncResumeToArtboard);

    return () => {
      frameRef.removeEventListener("load", syncResumeToArtboard);
    };
  }, [frameRef, syncResumeToArtboard]);

  // Persistently check if iframe has loaded using setInterval
  useEffect(() => {
    if (!frameRef || !data) return;
    const interval = setInterval(() => {
      try {
        if (frameRef?.contentWindow?.document.readyState === "complete") {
          syncResumeToArtboard();
          clearInterval(interval);
        }
      } catch {
        // ignore cross-origin or timing issues and retry until ready
      }
    }, 150);

    return () => clearInterval(interval);
  }, [frameRef, data, syncResumeToArtboard]);

  // Send resume data to iframe on change of resume data
  useEffect(syncResumeToArtboard, [data]);

  // Minimal guard to avoid blank page before store is hydrated
  if (!resume || !resume.id) {
    return (
      <div className="text-white flex items-center justify-center h-screen">
        Loading builder...
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {title} - JobRaker
        </title>
      </Helmet>

      <iframe
        ref={setFrameRef}
        title={resume.id}
        src="/artboard/builder"
        className="mt-16 w-screen"
        style={{ height: `calc(100vh - 64px)` }}
      />
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
