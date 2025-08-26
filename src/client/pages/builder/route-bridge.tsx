import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BuilderPage, builderLoader } from "./page";

export const ClientBuilderRoute = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id) {
        navigate("/dashboard", { replace: true });
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
  }, [id, navigate]);

  if (!ready) return null;
  return <BuilderPage />;
};
