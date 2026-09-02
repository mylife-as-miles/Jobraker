import React, { Suspense, lazy } from "react";
import { Button } from "../../../components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { captureClientEvent } from "@/lib/analytics";
import { ROUTES } from "@/routes";

const EarthOrb = lazy(() =>
  import("./EarthOrb").then((mod) => ({ default: mod.EarthOrb }))
);

function EarthOrbFallback() {
  return (
    <div className='w-full h-full flex items-center justify-center pointer-events-none'>
      <div className='w-48 h-48 sm:w-64 sm:h-64 rounded-full border border-brand/20 bg-brand/5 animate-pulse flex items-center justify-center'>
        <div className='w-32 h-32 rounded-full border border-brand/40 bg-brand/10 blur-[2px]' />
      </div>
    </div>
  );
}

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <div className='relative w-full min-h-screen flex flex-col justify-center overflow-hidden bg-background pt-24 pb-20 px-4 sm:px-6 lg:px-8'>
      {/* Background Grid Effect */}
      <div className='absolute inset-0 bg-[linear-gradient(to_right,#2fd9680a_1px,transparent_1px),linear-gradient(to_bottom,#2fd9680a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none' />

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
                  destination: ROUTES.SIGNIN,
                  location: "hero",
                });
                navigate(ROUTES.SIGNIN);
              }}
              className='bg-brand text-black hover:bg-brand/90 h-12 px-6 text-base font-bold rounded-none border border-brand transition-all hover:shadow-[0_0_20px_rgba(47,217,104,0.4)] w-full sm:w-auto'
            >
              Sign Up
              <ArrowRight className='w-5 h-5 ml-2' />
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
          <Suspense fallback={<EarthOrbFallback />}>
            <EarthOrb />
          </Suspense>
        </div>
      </div>
    </div>
  );
};
