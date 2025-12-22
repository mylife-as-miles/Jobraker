import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: "How does the auto-apply feature work?",
    answer: "Our AI agent logs into job boards, fills out application forms using your profile data, uploads your tailored resume, and answers screening questions based on your experience."
  },
  {
    question: "Is my data secure?",
    answer: "Yes. We use enterprise-grade encryption for all user data. Your credentials are encrypted and never shared with third parties."
  },
  {
    question: "Can I review applications before they are sent?",
    answer: "Absolutely. You can set the agent to 'Review Mode' where it prepares applications for your approval before submission."
  },
  {
    question: "What job boards do you support?",
    answer: "We support major platforms like LinkedIn, Indeed, Glassdoor, ZipRecruiter, and specialized tech boards like Dice and Wellfound."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel directly from your dashboard. You'll retain access until the end of your billing period."
  }
];

export const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-black max-w-3xl mx-auto px-4">
      <h2 className="text-3xl md:text-5xl font-bold font-mono text-center text-white mb-12">
        SYSTEM <span className="text-[#1dff00]">FAQ</span>
      </h2>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="border border-white/10 rounded-lg bg-white/5 overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-white font-mono font-bold">{faq.question}</span>
              <ChevronDown className={`w-5 h-5 text-[#1dff00] transition-transform ${openIndex === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-6 pt-0 text-gray-400 font-mono text-sm leading-relaxed border-t border-white/5">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
};
