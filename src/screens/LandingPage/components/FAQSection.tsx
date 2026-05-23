import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "How does the auto-apply feature work?",
    answer:
      "Your agent uses your profile, preferences, and resume data to prepare role-specific application packages. You can keep the workflow in review mode when you want approval before anything is submitted.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. We protect account data in transit and at rest, and we do not sell your personal information. If you need a security review, contact support before rollout.",
  },
  {
    question: "Can I stay in control before applications are sent?",
    answer:
      "Yes. Review Mode lets JobRaker draft and prepare applications first, so you can approve, revise, or skip each opportunity before submission.",
  },
  {
    question: "What job boards do you support?",
    answer:
      "We support major platforms like LinkedIn, Indeed, Glassdoor, ZipRecruiter, and specialized tech boards like Dice and Wellfound.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes, you can cancel directly from your dashboard. You will retain access until the end of your billing period.",
  },
  {
    question: "What are search and AI credits?",
    answer:
      "Credits power job search, evaluations, resume tailoring, cover letters, AI chat, and other metered features. Your plan includes a monthly allowance, and one-time packs are available from Billing. Governed auto-apply uses separate monthly run limits on paid tiers.",
  },
  {
    question: "Do you offer quarterly or annual billing?",
    answer:
      "Pro and Ultimate can be billed monthly, quarterly (10% off for Pro and 15% off for Ultimate versus three monthly payments), or annually. Basics supports monthly and annual. See the Billing page in your dashboard for live prices and checkout.",
  },
  {
    question: "Can I use JobRaker on mobile?",
    answer:
      "The product is built as a responsive web app. Use it in your phone or tablet browser. For the best drafting and review experience, many users still prefer desktop.",
  },
  {
    question: "How does match or ATS scoring work?",
    answer:
      "JobRaker compares your resume with job descriptions to surface fit signals and practical insights. Scores help you prioritize, but they are guidance, not guarantees from employers.",
  },
  {
    question: "Who do I contact for billing or account help?",
    answer:
      "Use in-app support or your account email to reach us. Include any payment reference or screenshot if the issue is about a charge. Our Billing FAQ in the dashboard covers plans, credits, and checkout in more detail.",
  },
];

export const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className='py-24 bg-background max-w-3xl mx-auto px-4'>
      <h2 className='text-3xl md:text-5xl font-bold font-mono text-center text-foreground mb-12'>
        SYSTEM <span className='text-brand'>FAQ</span>
      </h2>

      <div className='space-y-4'>
        {faqs.map((faq, i) => (
          <div
            key={faq.question}
            className='border border-white/10 rounded-lg overflow-hidden'
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className='w-full flex items-center justify-between p-6 text-left bg-black hover:bg-white/5 transition-colors'
            >
              <span className='text-foreground font-mono font-bold'>
                {faq.question}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-brand transition-transform ${openIndex === i ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className='p-6 pt-0 text-gray-400 font-mono text-sm leading-relaxed border-t border-foreground/5'>
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
