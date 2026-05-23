import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { captureClientEvent } from "@/lib/analytics";
import { Seo } from "@/components/seo/Seo";

export const WaitlistPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    captureClientEvent("waitlist_viewed", {
      location: "waitlist_page",
    });

    // Load Tally embed script
    const script = document.createElement("script");
    script.src = "https://tally.so/widgets/embed.js";
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.Tally) {
        // @ts-ignore
        window.Tally.loadEmbeds();
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") {
        return;
      }

      const payload = event.data as { event?: string; type?: string };
      const eventName = payload.event || payload.type;
      if (eventName === "Tally.FormSubmitted") {
        captureClientEvent("waitlist_submitted", {
          location: "waitlist_page",
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className='min-h-screen bg-background text-foreground relative overflow-hidden'>
      <Seo
        title="Join the JobRaker Waitlist"
        description="Join the JobRaker waitlist to get updates on guided job search, AI drafting, and background scouting."
        path="/waitlist"
      />
      {/* Back button */}
      <button
        onClick={() => {
          captureClientEvent("landing_cta_clicked", {
            cta_id: "waitlist_back_home",
            destination: "/",
            location: "waitlist_page",
          });
          navigate("/");
        }}
        className='fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 text-sm font-mono text-neutral-400 hover:text-brand transition-colors bg-background/80 backdrop-blur-md rounded border border-brand/20'
      >
        <ArrowLeft className='w-4 h-4' />
        Back
      </button>

      {/* Tally embed */}
      <iframe
        src="https://tally.so/r/WOpZre?transparentBackground=1&formEventsForwarding=1"
        data-tally-src="https://tally.so/r/WOpZre?transparentBackground=1&formEventsForwarding=1"
        width="100%"
        height="100%"
        frameBorder="0"
        marginHeight={0}
        marginWidth={0}
        title="JobRaker Waitlist"
        className='absolute inset-0 border-0'
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
    </div>
  );
};
