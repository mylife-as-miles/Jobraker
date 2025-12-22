import React, { useEffect } from 'react';
import { Hero } from './components/Hero';
import { BentoGrid } from './components/BentoGrid';
import { ScrollShowcase } from './components/ScrollShowcase';
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

        {/* Pricing / Final CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-[#1dff00]/10 to-transparent pointer-events-none" />
          
          <div className="container mx-auto px-4 text-center relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-bold mb-8 font-mono"
            >
              READY TO <span className="text-[#1dff00]">DOMINATE</span>?
            </motion.h2>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-md mx-auto bg-white/5 backdrop-blur-xl border border-[#1dff00]/30 p-8 rounded-2xl relative group hover:border-[#1dff00] transition-colors"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#1dff00] text-black px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Limited Access
              </div>

              <div className="text-5xl font-bold text-white mb-2">$49<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <p className="text-gray-400 mb-8 text-sm">Cancel anytime. 14-day money-back guarantee.</p>

              <ul className="space-y-3 text-left mb-8 text-sm text-gray-300">
                <li className="flex items-center"><Check className="w-4 h-4 text-[#1dff00] mr-2" /> Unlimited Applications</li>
                <li className="flex items-center"><Check className="w-4 h-4 text-[#1dff00] mr-2" /> AI Resume Optimization</li>
                <li className="flex items-center"><Check className="w-4 h-4 text-[#1dff00] mr-2" /> 24/7 Priority Support</li>
                <li className="flex items-center"><Check className="w-4 h-4 text-[#1dff00] mr-2" /> Interview Coaching</li>
              </ul>

              <Button
                onClick={() => navigate('/signup')}
                className="w-full bg-[#1dff00] text-black hover:bg-[#1dff00]/90 h-12 text-lg font-bold rounded-xl"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-[#1dff00]/10 bg-black text-center text-gray-600 text-sm font-mono">
          <p>© {new Date().getFullYear()} JobRaker AI. All systems operational.</p>
        </footer>

      </main>
    </div>
  );
};
