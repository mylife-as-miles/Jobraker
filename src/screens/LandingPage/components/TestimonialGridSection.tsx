import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const proofPoints = [
  {
    label: "Time sink",
    before: "Evenings should not disappear into the same form fields.",
    after:
      "JobRaker prepares application packages from your profile so your energy goes into interviews, follow-ups, and decisions.",
  },
  {
    label: "Blank page",
    before: "Every resume needs to feel built for the role.",
    after:
      "Resume tailoring starts from the job description, your profile, and the positioning that makes you relevant faster.",
  },
  {
    label: "Role quality",
    before: "Not every opening deserves your best hour.",
    after:
      "Fit signals help you prioritize stronger opportunities before you spend time on another low-signal application.",
  },
  {
    label: "Pipeline clarity",
    before:
      "Drafted, submitted, waiting, and follow-up should never blur together.",
    after:
      "Your dashboard keeps each opportunity visible, organized, and ready for the next action.",
  },
  {
    label: "Trust controls",
    before: "Automation only works when you can slow it down.",
    after:
      "Review Mode lets you approve, revise, or skip important applications before they go out.",
  },
  {
    label: "Interview prep",
    before: "Generic practice does not prepare you for a specific role.",
    after:
      "Practice starts from the job description, so your answers connect to the actual conversation ahead.",
  },
];

export const TestimonialGridSection = () => {
  return (
    <section className='py-24 bg-background'>
      <div className='container mx-auto px-4'>
        <div className='mx-auto mb-16 max-w-3xl text-center'>
          <p className='mb-4 font-mono text-xs uppercase tracking-[0.28em] text-brand/70'>
            Proof points
          </p>
          <h2 className='text-3xl md:text-5xl font-bold font-mono text-foreground'>
            Why candidates stop doing it{" "}
            <span className='text-brand'>manually</span>
          </h2>
          <p className='mx-auto mt-5 max-w-2xl text-base md:text-lg leading-relaxed text-neutral-400'>
            JobRaker is built around the moments that make a search slow down:
            repetition, weak fit signals, scattered tracking, and generic prep.
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {proofPoints.map((point, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.22,
                delay: i * 0.04,
                ease: [0.23, 1, 0.32, 1],
              }}
              className='group relative overflow-hidden p-7 bg-[#0b0f16] border border-brand/15 rounded-xl hover:border-brand/45 transition-colors duration-200'
            >
              <div className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100' />
              <div className='mb-7 flex items-center justify-between'>
                <span className='font-mono text-xs font-bold uppercase tracking-[0.24em] text-brand'>
                  {point.label}
                </span>
                <span className='font-mono text-xs text-neutral-600'>
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <p className='min-h-[84px] text-xl font-mono leading-relaxed text-foreground'>
                "{point.before}"
              </p>
              <div className='mt-7 flex gap-3 border-t border-white/10 pt-5'>
                <CheckCircle2 className='mt-0.5 h-5 w-5 flex-shrink-0 text-brand' />
                <p className='text-sm leading-relaxed text-neutral-400'>
                  {point.after}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
