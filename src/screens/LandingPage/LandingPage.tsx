import React, { useEffect } from 'react';
import { Hero } from './components/Hero';
import { BentoGrid } from './components/BentoGrid';
import { ScrollShowcase } from './components/ScrollShowcase';
import { PricingSection } from './components/PricingSection';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Bot, Check, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-[#1dff00] selection:text-black">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-[#1dff00]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
              <div className="w-8 h-8 bg-[#1dff00] rounded flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <span className="text-white font-bold text-xl tracking-tighter">JOBRAKER</span>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/signin')}
                className="text-gray-400 hover:text-[#1dff00] hover:bg-transparent"
              >
                LOGIN
              </Button>
              <Button
                onClick={() => navigate('/signup')}
                className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 font-bold rounded-none"
              >
                GET STARTED
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <Hero />

        <BentoGrid />

        <ScrollShowcase />

        <PricingSection />

        {/* Footer */}
        <footer className="py-12 border-t border-[#1dff00]/10 bg-black text-center text-gray-600 text-sm font-mono">
          <p>© {new Date().getFullYear()} JobRaker AI. All systems operational.</p>
        </footer>

      </main>
    </div>
  );
};
