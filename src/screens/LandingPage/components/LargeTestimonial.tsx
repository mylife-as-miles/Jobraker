import React from "react";
import { Quote } from "lucide-react";

export const LargeTestimonial = () => {
  return (
    <section className='py-24 bg-background border-y border-brand/10'>
      <div className='container mx-auto px-4 max-w-5xl text-center'>
        <Quote className='w-12 h-12 text-brand mx-auto mb-8 opacity-50' />
        <h3 className='text-3xl md:text-5xl font-bold font-mono text-foreground leading-tight mb-8'>
          "Your job search should not depend on how many repetitive forms you
          can survive. Let the agent handle the busywork so your energy goes
          into better interviews, smarter follow-ups, and stronger decisions."
        </h3>
        <div className='flex flex-col items-center'>
          <div className='w-16 h-16 bg-gradient-to-br from-brand to-background rounded-full mb-4' />
          <div className='text-foreground font-bold font-mono text-lg'>
            JobRaker
          </div>
          <div className='text-brand font-mono text-sm'>
            Autonomous job search platform
          </div>
        </div>
      </div>
    </section>
  );
};
