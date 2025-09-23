import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import slugify from "@sindresorhus/slugify";
import { generateRandomName } from "@reactive-resume/utils";
import { useCreateResume } from "@/client/services/resume";
import { useResumeStore } from "@/client/stores/resume";
import { Helmet } from "react-helmet-async";

export default function NewResumeRedirect() {
  const navigate = useNavigate();
  const { createResume } = useCreateResume();
  const setResume = useResumeStore.setState;

  useEffect(() => {
    const go = async () => {
      const title = generateRandomName();
      const slug = slugify(title);
      try {
        const res = await createResume({ title, slug, visibility: "private" });
        navigate(`/builder/${res.id}`, { replace: true, state: { resume: res } });
      } catch {
        // Offline/unauthenticated fallback: create local draft
        const localId = `local:${crypto?.randomUUID?.() ?? Date.now()}`;
        const localResume: any = {
          id: localId,
          title,
          slug,
          visibility: "private",
          data: {
            sections: { basics: {}, summary: { content: "" }, experience: { items: [] }, skills: { items: [] }, custom: {} },
            metadata: {
              template: "classic",
              theme: { primary: "#4f46e5", background: "#ffffff", text: "#0f172a" },
              layout: [[["summary", "experience"], ["skills"]]],
              page: { options: { breakLine: true, pageNumbers: true } },
              ui: { kickstartDismissed: false },
            },
          },
        };
        setResume({ resume: localResume });
        navigate(`/builder/${localId}`, { replace: true, state: { resume: localResume } });
      }
    };

    void go();
  }, [createResume, navigate]);

  return (
    <>
      <Helmet>
        <title>New Resume - JobRaker</title>
      </Helmet>
    </>
  );
}
