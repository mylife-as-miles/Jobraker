import type { ResumeDto } from "@reactive-resume/dto";
import { useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import type { LoaderFunction } from "react-router-dom";
import { redirect } from "react-router-dom";

import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { useResumeStore } from "@/client/stores/resume";
import { pageSizeMap } from "@reactive-resume/utils";
import { Loader2 } from "lucide-react";

export const BuilderPage = () => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const resume = useResumeStore((state) => state.resume);
  const title = useResumeStore((state) => state.resume?.title || "Builder");
  const data = useResumeStore((state) => state.resume?.data);
  const format = useResumeStore((state) => state.resume?.data?.metadata?.page?.format as keyof typeof pageSizeMap);

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

  // Post the resume into the iframe when loaded or when data changes
  useEffect(() => {
    if (!frameRef.current?.contentWindow || !data) return;
    const message = { type: "SET_RESUME", payload: data };
    const send = () => frameRef.current?.contentWindow?.postMessage(message, "*");
    // Try a couple of times in case artboard isn't initialized yet
    send();
    const id = setTimeout(send, 100);
    return () => clearTimeout(id);
  }, [data]);

  return (
    <div className="w-screen h-[calc(100vh-64px)] mt-16 grid place-items-start">
      <Helmet>
        <title>{title} - JobRaker</title>
      </Helmet>
      <iframe
        ref={frameRef}
        title={title}
        src="/artboard/builder"
        style={{
          width: format ? `${pageSizeMap[format].width}mm` : '100vw',
          height: '100%',
          border: 'none',
          overflow: 'hidden',
        }}
      />
    </div>
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
