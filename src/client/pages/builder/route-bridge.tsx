import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BuilderPage, builderLoader } from "./page";
import { useResumeStore } from "@/client/stores/resume";

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
        await builderLoader({ params: { id } } as any);
        setReady(true);
      } catch {
        navigate("/dashboard", { replace: true });
      }
    };
    void run();
  }, [id, navigate, location.state]);

  if (!ready) return null;
  return <BuilderPage />;
};
