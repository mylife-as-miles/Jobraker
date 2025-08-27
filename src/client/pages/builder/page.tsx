import type { ResumeDto } from "@reactive-resume/dto";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import type { LoaderFunction } from "react-router-dom";
import { redirect } from "react-router-dom";

import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { useResumeStore } from "@/client/stores/resume";
import { useArtboardStore } from "../../../store/artboard";
import { ArtboardPage } from "../../../pages/artboard";
import { BuilderLayout as ArtboardBuilder } from "../../../pages/builder";

export const BuilderPage = () => {
  const resume = useResumeStore((state) => state.resume);
  const title = useResumeStore((state) => state.resume?.title || "Builder");
  const data = useResumeStore((state) => state.resume?.data);
  const setArtboardResume = useArtboardStore((state) => state.setResume);

  // Sync resume data directly into the artboard store (no iframe)
  useEffect(() => {
    if (data) setArtboardResume(data);
  }, [data, setArtboardResume]);

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

      {/* Render artboard directly instead of iframe */}
      <div className="mt-16 w-screen" style={{ height: `calc(100vh - 64px)` }}>
        <ArtboardPage />
        <ArtboardBuilder />
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
