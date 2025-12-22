import React from 'react';
import { motion } from 'framer-motion';
import { LiveDemo } from './LiveDemo';
import { Button } from '../../../components/ui/button';
import { ArrowRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-10 overflow-hidden bg-black">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1dff000a_1px,transparent_1px),linear-gradient(to_bottom,#1dff000a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Spotlights */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-[#1dff00]/10 to-transparent blur-[100px] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left Column: Text */}
          <div className="space-y-8 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-[#1dff00]/30 bg-[#1dff00]/5 text-[#1dff00] text-xs font-mono tracking-widest uppercase"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1dff00] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1dff00]"></span>
              </span>
              <span>System Online</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white font-mono"
            >
              YOUR AI JOB HUNTER <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1dff00] to-[#00b300] animate-pulse">
                NEVER SLEEPS
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-gray-400 max-w-xl mx-auto lg:mx-0 font-mono"
            >
              The world's first autonomous agent that searches, applies, and networks for you 24/7. Land your dream job on autopilot.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
            >
              <Button
                size="lg"
                onClick={() => navigate('/signup')}
                className="w-full sm:w-auto bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all font-bold text-base px-8 h-12 rounded-none border border-[#1dff00]"
              >
                DEPLOY AGENT
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-[#1dff00] text-[#1dff00] bg-transparent hover:bg-[#1dff00]/10 font-mono h-12 rounded-none"
              >
                <Play className="w-4 h-4 mr-2" />
                WATCH DEMO
              </Button>
            </motion.div>
          </div>

          {/* Right Column: Live Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            {/* Decorative background blur behind the terminal */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00] to-[#0a8246] blur-3xl opacity-20 transform rotate-6 scale-90" />
            <LiveDemo />
          </motion.div>

        </div>
      </div>
    </section>
  );
};
