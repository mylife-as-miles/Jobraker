import React from "react";
import { Button } from "../../../components/ui/button";
import { ArrowRight, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EarthOrb } from "./EarthOrb";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <div className="relative w-full min-h-screen flex flex-col justify-center overflow-hidden bg-black pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1dff000a_1px,transparent_1px),linear-gradient(to_bottom,#1dff000a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">

        {/* Left Column: Text Content - Vertically centered */}
        <div className="flex-1 text-center lg:text-left space-y-8 z-20 pt-10 lg:pt-0">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-[#1dff00]/30 bg-[#1dff00]/5 text-[#1dff00] text-xs font-mono tracking-widest uppercase animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1dff00] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1dff00]"></span>
            </span>
            <span>AI Agent V2.0 Online</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold font-mono tracking-tight text-white leading-[0.9] lg:leading-[0.9]">
            Your AI Job Hunter <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1dff00] via-[#80ff72] to-[#00b300]">
              Never Sleeps
            </span>
          </h1>

          <p className="max-w-xl mx-auto lg:mx-0 text-sm sm:text-base md:text-lg text-neutral-400 font-mono leading-relaxed">
            JobRaker is the world's first autonomous AI agent that applies to jobs for you.
            It scans 50k+ boards, optimizes your resume, and submits applications 24/7.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
            <Button
              onClick={() => navigate('/signup')}
              className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 h-12 px-6 text-base font-bold rounded-none border border-[#1dff00] transition-all hover:shadow-[0_0_20px_rgba(29,255,0,0.4)] w-full sm:w-auto"
            >
              DEPLOY AGENT
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="border-[#1dff00] text-[#1dff00] bg-transparent hover:bg-[#1dff00]/10 h-12 px-6 text-base font-mono rounded-none w-full sm:w-auto"
            >
              <Terminal className="w-5 h-5 mr-2" />
              VIEW LOGS
            </Button>
          </div>

          {/* Trust/Stats Mini-section */}
          <div className="pt-8 flex items-center justify-center lg:justify-start space-x-8 text-neutral-500 text-sm font-mono">
             <div className="flex items-center space-x-2">
                <span className="text-[#1dff00] font-bold">50k+</span>
                <span>Job Boards</span>
             </div>
             <div className="w-px h-4 bg-neutral-800" />
             <div className="flex items-center space-x-2">
                <span className="text-[#1dff00] font-bold">24/7</span>
                <span>Active</span>
             </div>
          </div>
        </div>

        {/* Right Column: 3D Orb - Adjusted sizing and positioning */}
        <div className="flex-1 w-full relative h-[400px] sm:h-[500px] lg:h-[600px] flex items-center justify-center perspective-1000 -mt-10 lg:mt-0">
             {/* Glow effect behind orb */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#1dff00] rounded-full blur-[150px] opacity-15 pointer-events-none" />
             <EarthOrb />
        </div>

      </div>
    </div>
  );
};
