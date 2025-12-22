import React from 'react';
import { Button } from '../../../components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-[#1dff00]/5 z-0" />
      <div className="container mx-auto px-4 relative z-10 text-center">
        <h2 className="text-4xl md:text-7xl font-bold font-mono text-white mb-8 tracking-tighter">
          STOP SEARCHING.<br />
          START <span className="text-[#1dff00]">WORKING.</span>
        </h2>
        <p className="text-xl text-gray-400 font-mono mb-12 max-w-2xl mx-auto">
          Deploy your personal AI career agent today. The first 14 days are on us.
        </p>
        <Button
          onClick={() => navigate('/signup')}
          className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 h-14 px-10 text-xl font-bold rounded-none border-2 border-transparent hover:border-black transition-all transform hover:scale-105"
        >
          INITIALIZE AGENT
          <ArrowRight className="w-6 h-6 ml-2" />
        </Button>
      </div>
    </section>
  );
};
