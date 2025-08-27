import { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Outlet } from "react-router";
import { useLocation } from "react-router-dom";

import { helmetContext } from "../constants/helmet";
import { useArtboardStore } from "../store/artboard";

export const Providers = () => {
  const resume = useArtboardStore((state) => state.resume);
  const setResume = useArtboardStore((state) => state.setResume);
  const location = useLocation();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "SET_RESUME") setResume(event.data.payload);
    };

    window.addEventListener("message", handleMessage, false);

    return () => {
      window.removeEventListener("message", handleMessage, false);
    };
  }, []);

  useEffect(() => {
    const resumeData = window.localStorage.getItem("resume");

    if (resumeData) setResume(JSON.parse(resumeData));
  }, []);

  // Only gate rendering on artboard routes where resume is required immediately
  const isArtboard = location.pathname.startsWith("/artboard");
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (isArtboard && !resume) return null;

  return (
    <HelmetProvider context={helmetContext}>
      <Outlet />
    </HelmetProvider>
  );
};
