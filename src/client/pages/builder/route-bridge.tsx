import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BuilderPage } from "./page";
import { useResumeStore } from "@/client/stores/resume";
import { findResumeById } from "@/client/services/resume";

export const ClientBuilderRoute = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const location = useLocation() as { state?: any };
  const setResume = useResumeStore.setState;

  useEffect(() => {
    const run = async () => {
      if (!id) {
        navigate("/dashboard", { replace: true });
        return;
      }
      // If resume is passed via navigation state, use it and skip loader (offline/local import)
      const passed = location.state?.resume;
      if (passed && passed.id === id) {
        setResume({ resume: passed });
        setReady(true);
        return;
      }
      try {
        const res = await findResumeById({ id });
        setResume({ resume: res });
        setReady(true);
      } catch {
        // Create a local draft and continue
        const localId = id.startsWith("local:") ? id : `local:${id}`;
        const localResume: any = {
          id: localId,
          title: "Untitled",
          slug: id,
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
        setReady(true);
      }
    };
    void run();
  }, [id, navigate, location.state]);

  if (!ready) return null;
  return <BuilderPage />;
};
