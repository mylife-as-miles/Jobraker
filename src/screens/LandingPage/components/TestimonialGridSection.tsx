import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  {
    text: "The AI customized my resume for every single application. I didn't even know that was possible.",
    author: "Sarah J.",
    role: "Product Manager"
  },
  {
    text: "Finally, a tool that actually works. The auto-apply feature is a lifesaver.",
    author: "Mike T.",
    role: "DevOps Engineer"
  },
  {
    text: "Got an interview with Amazon within a week. Highly recommend.",
    author: "Jessica L.",
    role: "Data Scientist"
  },
  {
    text: "The dashboard analytics helped me understand where I was failing. Tweaked my profile and boom - offers.",
    author: "David R.",
    role: "Full Stack Dev"
  },
  {
    text: "Worth every penny. Saved me hours of boring form filling.",
    author: "Emily W.",
    role: "UX Designer"
  },
  {
    text: "I used to apply to 5 jobs a day. Now JobRaker does 50 while I sleep.",
    author: "Chris P.",
    role: "Marketing Lead"
  }
];

export const TestimonialGridSection = () => {
  return (
    <section className="py-24 bg-black">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-5xl font-bold font-mono text-center text-white mb-16">
          COMMUNITY <span className="text-[#1dff00]">FEEDBACK</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 bg-white/5 border border-white/10 rounded-xl hover:border-[#1dff00]/30 transition-all"
            >
              <div className="flex text-[#1dff00] mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-gray-300 font-mono mb-6 leading-relaxed">"{t.text}"</p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white/10 rounded-full mr-3 flex items-center justify-center font-bold text-white">
                  {t.author[0]}
                </div>
                <div>
                  <div className="text-white font-bold font-mono text-sm">{t.author}</div>
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
