import { Button } from "../../../components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EarthOrb } from "./EarthOrb";
import { captureClientEvent } from "@/lib/analytics";
import { ROUTES } from "@/routes";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <div className='relative w-full min-h-screen flex flex-col justify-center overflow-hidden bg-background pt-24 pb-20 px-4 sm:px-6 lg:px-8'>
      {/* Background Grid Effect */}
      <div className='absolute inset-0 bg-[linear-gradient(to_right,#1dff000a_1px,transparent_1px),linear-gradient(to_bottom,#1dff000a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none' />

      <div className='relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20'>
        {/* Left Column: Text Content - Vertically centered */}
        <div className='flex-1 text-center lg:text-left space-y-8 z-20 pt-10 lg:pt-0'>
          <div className='inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-brand/30 bg-brand/5 text-brand text-xs font-mono tracking-widest uppercase animate-fade-in-up'>
            <span className='relative flex h-2 w-2'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75'></span>
              <span className='relative inline-flex rounded-full h-2 w-2 bg-brand'></span>
            </span>
            <span>AI Career Agent Ready</span>
          </div>

          <h1 className='text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-mono tracking-tight text-foreground leading-[0.9] lg:leading-[0.9]'>
            Stop applying <br />
            <span className='text-transparent bg-clip-text bg-gradient-to-r from-brand via-[#80ff72] to-background'>
              one job at a time
            </span>
          </h1>

          <p className='max-w-xl mx-auto lg:mx-0 text-sm sm:text-base md:text-lg text-neutral-400 font-mono leading-relaxed'>
            JobRaker turns your profile into an AI-powered job search system: it
            finds stronger-fit roles, tailors your materials, and moves
            applications forward with you in control.
          </p>

          <div className='flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4'>
            <Button
              onClick={() => {
                captureClientEvent("landing_cta_clicked", {
                  cta_id: "hero_join_waitlist",
                  destination: ROUTES.WAITLIST,
                  location: "hero",
                });
                navigate(ROUTES.WAITLIST);
              }}
              className='bg-brand text-black hover:bg-brand/90 h-12 px-6 text-base font-bold rounded-none border border-brand transition-all hover:shadow-[0_0_20px_rgba(29,255,0,0.4)] w-full sm:w-auto'
            >
              JOIN WAITLIST
              <ArrowRight className='w-5 h-5 ml-2' />
            </Button>
            <Button
              onClick={() => {
                captureClientEvent("landing_cta_clicked", {
                  cta_id: "hero_request_early_access",
                  destination: ROUTES.EARLY_ACCESS,
                  location: "hero",
                });
                navigate(ROUTES.EARLY_ACCESS);
              }}
              variant='outline'
              className='border-brand text-brand bg-transparent hover:bg-brand/10 h-12 px-6 text-base font-mono rounded-none w-full sm:w-auto'
            >
              REQUEST EARLY ACCESS
            </Button>
          </div>

          {/* Trust/Stats Mini-section */}
          <div className='pt-8 flex items-center justify-center lg:justify-start space-x-8 text-neutral-500 text-sm font-mono'>
            <div className='flex items-center space-x-2'>
              <span className='text-brand font-bold'>Review-first</span>
              <span>you stay in control</span>
            </div>
            <div className='w-px h-4 bg-neutral-800' />
            <div className='flex items-center space-x-2'>
              <span className='text-brand font-bold'>Tailored</span>
              <span>resume and cover letter workflows</span>
            </div>
          </div>
        </div>

        {/* Right Column: 3D Orb - Adjusted sizing and positioning */}
        <div className='flex-1 w-full relative h-[400px] sm:h-[500px] lg:h-[600px] flex items-center justify-center perspective-1000 -mt-10 lg:mt-0'>
          {/* Glow effect behind orb */}
          <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-brand rounded-full blur-[150px] opacity-15 pointer-events-none' />
          <EarthOrb />
        </div>
      </div>
    </div>
  );
};
