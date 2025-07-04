import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, Users, Zap } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export const LandingPage = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-title", {
        duration: 1,
        y: 100,
        opacity: 0,
        ease: "power4.out",
        delay: 0.2,
      });

      gsap.from(".hero-subtitle", {
        duration: 1,
        y: 100,
        opacity: 0,
        ease: "power4.out",
        delay: 0.4,
      });

      gsap.from(".hero-cta", {
        duration: 1,
        y: 100,
        opacity: 0,
        ease: "power4.out",
        delay: 0.6,
      });

      const sections = gsap.utils.toArray<HTMLElement>(".feature-section");
      sections.forEach((section) => {
        gsap.from(section, {
          y: 150,
          opacity: 0,
          duration: 1.2,
          ease: "power4.out",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="bg-gray-900 text-white font-sans">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center items-center text-center p-8 bg-gradient-to-b from-gray-900 to-gray-800">
        <motion.h1
          className="text-6xl md:text-8xl font-bold mb-4 hero-title"
        >
          Jobraker
        </motion.h1>
        <motion.p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8 hero-subtitle">
          The intelligent platform that helps you land your dream job faster.
        </motion.p>
        <motion.div className="hero-cta">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-4 rounded-full transition-transform transform hover:scale-105">
            Get Started <ArrowRight className="ml-2" />
          </Button>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
          <div className="text-center feature-section">
            <div className="flex justify-center items-center mb-4">
              <Briefcase size={40} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Smart Job Matching</h3>
            <p className="text-gray-400">
              Our AI analyzes your resume and skills to find the perfect job opportunities for you.
            </p>
          </div>
          <div className="text-center feature-section">
            <div className="flex justify-center items-center mb-4">
              <Users size={40} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Resume Optimization</h3>
            <p className="text-gray-400">
              Get real-time feedback on your resume to beat the ATS and impress recruiters.
            </p>
          </div>
          <div className="text-center feature-section">
            <div className="flex justify-center items-center mb-4">
              <Zap size={40} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Accelerated Applications</h3>
            <p className="text-gray-400">
              Apply to jobs faster with our streamlined application process and tracking tools.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-gray-800">
        <p className="text-gray-500">&copy; 2024 Jobraker. All rights reserved.</p>
      </footer>
    </div>
  );
};