import React from 'react';
import { Quote } from 'lucide-react';

export const LargeTestimonial = () => {
  return (
    <section className="py-24 bg-[#0a0a0a] border-y border-[#1dff00]/10">
      <div className="container mx-auto px-4 max-w-5xl text-center">
        <Quote className="w-12 h-12 text-[#1dff00] mx-auto mb-8 opacity-50" />
        <h3 className="text-3xl md:text-5xl font-bold font-mono text-white leading-tight mb-8">
          "I was skeptical at first, but JobRaker applied to 200 jobs in 3 days. I got 15 interviews and signed an offer with a 40% raise. It literally paid for itself in the first hour."
        </h3>
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#1dff00] to-[#0a8246] rounded-full mb-4" />
          <div className="text-white font-bold font-mono text-lg">Alex V.</div>
          <div className="text-[#1dff00] font-mono text-sm">Senior Frontend Engineer @ TechGiant</div>
        </div>
      </div>
    </section>
  );
};
