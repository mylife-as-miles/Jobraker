import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const WaitlistPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Load Tally embed script
    const script = document.createElement("script");
    script.src = "https://tally.so/widgets/embed.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className='min-h-screen bg-background text-foreground relative'>
      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        className='fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 text-sm font-mono text-neutral-400 hover:text-brand transition-colors bg-background/80 backdrop-blur-md rounded border border-brand/20'
      >
        <ArrowLeft className='w-4 h-4' />
        Back
      </button>

      {/* Tally embed */}
      <iframe
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
