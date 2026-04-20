import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    text: "I am done spending evenings rewriting the same answers. I want my search moving while I prepare for the conversations that matter.",
    author: "Pain",
    role: "Repetitive applications"
  },
  {
    text: "I need every resume to feel built for the role, without starting from a blank document every time.",
    author: "Promise",
    role: "Tailored materials"
  },
  {
    text: "I want to know which roles are worth my energy before I apply, not after another silent rejection.",
    author: "Priority",
    role: "Better-fit targets"
  },
  {
    text: "I need a dashboard that shows what is drafted, submitted, waiting, and ready for follow-up.",
    author: "Control",
    role: "Clear pipeline"
  },
  {
    text: "I want help with the form work, but I still need review controls before anything important goes out.",
    author: "Trust",
    role: "Governed automation"
  },
  {
    text: "I need interview prep that starts from the actual job description, not generic questions from a search result.",
    author: "Momentum",
    role: "Role-specific prep"
  }
];

export const TestimonialGridSection = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-5xl font-bold font-mono text-center text-foreground mb-16">
          WHY CANDIDATES <span className="text-[#ffd700]">SWITCH</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 bg-muted/50 border border-foreground/10 rounded-xl hover:border-[#ffd700]/30 transition-all"
            >
              <div className="flex text-[#ffd700] mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-gray-300 font-mono mb-6 leading-relaxed">"{t.text}"</p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-muted rounded-full mr-3 flex items-center justify-center font-bold text-foreground">
                  {t.author[0]}
                </div>
                <div>
                  <div className="text-foreground font-bold font-mono text-sm">{t.author}</div>
                  <div className="text-gray-500 font-mono text-xs">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
