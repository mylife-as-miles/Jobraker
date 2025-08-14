import { useEffect, useRef, useState } from "react";

export const ResumePage = (): JSX.Element => {
  // Dev-time: point to the resume-builder client app (Vite default port in this repo)
  const [src] = useState<string>("http://localhost:5173/dashboard/resumes");
  const [loaded, setLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const sendThemeToIframe = () => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;

      const docStyle = getComputedStyle(document.documentElement);
      const cssVars = [
        "--background",
        "--foreground",
        "--primary",
        "--primary-foreground",
        "--secondary",
        "--secondary-foreground",
        "--muted",
        "--muted-foreground",
        "--accent",
        "--accent-foreground",
        "--border",
        "--ring",
        "--card",
        "--card-foreground",
      ].reduce<Record<string, string>>((acc, key) => {
        acc[key] = docStyle.getPropertyValue(key).trim();
        return acc;
      }, {});

      const isDark = document.documentElement.classList.contains("dark");

      const targetOrigin = new URL(src, window.location.href).origin;
      iframe.contentWindow.postMessage({ type: "SET_THEME", payload: { vars: cssVars, dark: isDark } }, targetOrigin);
    };

    // Initial send after iframe loads
    if (loaded) sendThemeToIframe();

    // Observe theme class changes
    const mo = new MutationObserver(() => sendThemeToIframe());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => mo.disconnect();
  }, [loaded, src]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h1 className="text-lg sm:text-xl font-semibold">Resume Builder</h1>
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-4"
          >
            Open in new tab
          </a>
        </div>
      </div>

      <div className="relative flex-1 min-h-[60vh]">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">
            Loading resume builder…
          </div>
        )}
        <iframe
          title="Resume Builder"
          src={src}
          ref={iframeRef}
          className="h-full w-full border-0"
          onLoad={() => setLoaded(true)}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
        />
      </div>
    </div>
  );
};