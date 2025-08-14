import { useEffect, useState } from "react";

export const ResumePage = (): JSX.Element => {
  // Dev-time: point to the resume-builder client app (Vite default port in this repo)
  const [src] = useState<string>("http://localhost:5173/dashboard/resumes");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Placeholder for future postMessage handshake
  }, []);

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
          className="h-full w-full border-0"
          onLoad={() => setLoaded(true)}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
        />
      </div>
    </div>
  );
};