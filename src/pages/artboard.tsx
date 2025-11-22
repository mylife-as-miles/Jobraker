import { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Outlet } from "react-router-dom";
import webfontloader from "webfontloader";

import { useArtboardStore } from "../store/artboard";

export const ArtboardPage = () => {
  const name = useArtboardStore((state) => state.resume?.basics?.name);
  const metadata = useArtboardStore((state) => state.resume?.metadata);
  const setResume = useArtboardStore((state) => state.setResume);

  const fontString = useMemo(() => {
    if (!metadata?.typography?.font) return "Inter:regular:latin";
    const family = metadata.typography.font.family || "Inter";
    const variants = metadata.typography.font.variants?.join(",") || "regular";
    const subset = metadata.typography.font.subset || "latin";

    return `${family}:${variants}:${subset}`;
  }, [metadata?.typography?.font]);

  useEffect(() => {
    webfontloader.load({
      google: { families: [fontString] },
      active: () => {
        const width = window.document.body.offsetWidth;
        const height = window.document.body.offsetHeight;
        const message = { type: "PAGE_LOADED", payload: { width, height } };
        window.postMessage(message, "*");
      },
    });
  }, [fontString]);

  // Font Size & Line Height
  useEffect(() => {
    if (!metadata) return;
    
    const fontSize = metadata.typography?.font?.size || 16;
    const lineHeight = metadata.typography?.lineHeight || 1.5;
    const margin = metadata.page?.margin || 20;
    const textColor = metadata.theme?.text || "#000000";
    const primaryColor = metadata.theme?.primary || "#000000";
    const bgColor = metadata.theme?.background || "#ffffff";

    document.documentElement.style.setProperty("font-size", `${fontSize}px`);
    document.documentElement.style.setProperty("line-height", `${lineHeight}`);

    document.documentElement.style.setProperty("--margin", `${margin}px`);
    document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
    document.documentElement.style.setProperty("--line-height", `${lineHeight}`);

    document.documentElement.style.setProperty("--color-foreground", textColor);
    document.documentElement.style.setProperty("--color-primary", primaryColor);
    document.documentElement.style.setProperty("--color-background", bgColor);
  }, [metadata]);

  // Receive resume from parent via postMessage when embedded as iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const msg = event?.data;
      if (!msg || typeof msg !== 'object') return;
      if (typeof msg.type === 'string' && msg.type === 'SET_RESUME' && msg.payload?.resume) {
        try { setResume(msg.payload.resume); } catch {}
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setResume]);

  // Typography Options
  useEffect(() => {
    if (!metadata?.typography) return;
    // eslint-disable-next-line unicorn/prefer-spread
    const elements = Array.from(document.querySelectorAll(`[data-page]`));

    for (const el of elements) {
      el.classList.toggle("hide-icons", metadata.typography.hideIcons || false);
      el.classList.toggle("underline-links", metadata.typography.underlineLinks || false);
    }
  }, [metadata]);

  const resume = useArtboardStore((state) => state.resume);

  if (!resume) return null;

  return (
    <>
      <Helmet>
        <title>{`${name ?? ""} | Reactive Resume`}</title>
        {metadata?.css?.visible && metadata?.css?.value && (
          <style id="custom-css" lang="css">
            {metadata.css.value}
          </style>
        )}
      </Helmet>

      <Outlet />
    </>
  );
};
