import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const steps = [
  {
    num: "01",
    title: "Configure Agent",
    description: "Set your target roles, desired salary, remote preferences, and upload your resume. The AI builds your profile.",
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop"
  },
  {
    num: "02",
    title: "AI Hunts & Applies",
    description: "Our autonomous engine scours the web, finding hidden opportunities and submitting tailored applications instantly.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
  },
  {
    num: "03",
    title: "Interview & Offer",
    description: "Sit back as interview requests land in your inbox. Use our insights to negotiate the best offer.",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop"
  }
];

export const ScrollShowcase = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  return (
    <section ref={containerRef} className="bg-black relative">
      {steps.map((step, i) => (
        <ShowcaseStep key={i} step={step} index={i} total={steps.length} />
      ))}
    </section>
  );
};

const ShowcaseStep = ({ step, index, total }: { step: typeof steps[0], index: number, total: number }) => {
  return (
    <div className="min-h-screen sticky top-0 flex items-center justify-center overflow-hidden border-t border-[#1dff00]/10 bg-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="order-2 lg:order-1"
          >
            <div className="text-[#1dff00] text-6xl md:text-8xl font-mono font-bold opacity-20 mb-4">
              {step.num}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 font-mono">
              {step.title}
            </h2>
            <p className="text-xl text-gray-400 max-w-lg leading-relaxed font-mono">
              {step.description}
            </p>
          </motion.div>

          {/* Visual Content */}
          <div className="order-1 lg:order-2 relative">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="relative aspect-video rounded-xl overflow-hidden border border-[#1dff00]/30 shadow-[0_0_50px_rgba(29,255,0,0.1)]"
            >
              <div className="absolute inset-0 bg-[#1dff00]/10 mix-blend-overlay z-10" />
              <img
                src={step.image}
                alt={step.title}
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
              />

              {/* Overlay UI Mockup */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-[#1dff00]/20 p-4 rounded z-20">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#1dff00] rounded-full animate-pulse" />
                  <div className="h-2 w-2/3 bg-[#1dff00]/20 rounded" />
                </div>
                <div className="mt-2 h-2 w-1/2 bg-[#1dff00]/10 rounded" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};
