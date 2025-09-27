import { BuilderPage } from "@/client/pages/builder/page";
import { ResumesPage } from "@/client/pages/dashboard/resumes/page";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { useResumeStore } from "@/client/stores/resume";

export const ResumePage = (): JSX.Element => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) return; // no id -> list view handled below
      try {
        setLoading(true);
        const resume = await queryClient.fetchQuery({
          queryKey: ["resume", { id }],
          queryFn: () => findResumeById({ id }),
        });
        if (!active) return;
        useResumeStore.setState({ resume });
      } catch (e) {
        console.error("Failed to load resume", e);
        if (active) navigate("/dashboard/resumes", { replace: true });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id, navigate]);

  // If no id param present, show the resume list page instead of a blank builder
  if (!id) {
    return <ResumesPage />;
  }

  return (
      <div className="h-full w-full flex flex-col">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#1dff00]/20 bg-[#0a0a0a]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/60">
          <h1 className="text-lg sm:text-xl font-semibold text-white">Resume Builder</h1>
        </div>
        <div className="flex-1 min-h-[60vh]">
          {loading && (
            <div className="p-4 text-sm text-[#a3a3a3]">Loading…</div>
          )}
          <BuilderPage />
        </div>
      </div>
  );
};