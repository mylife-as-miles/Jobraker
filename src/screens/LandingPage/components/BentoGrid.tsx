import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, FileText, BarChart3, Shield, Activity, Zap } from 'lucide-react';

const features = [
  {
    icon: <Bot className="w-8 h-8 text-[#1dff00]" />,
    title: "Autonomous Search",
    description: "Scans 50k+ job boards daily. Filters spam. Identifies high-value roles matching your exact criteria.",
    colSpan: "col-span-1 md:col-span-2 lg:col-span-2",
  },
  {
    icon: <Send className="w-8 h-8 text-[#1dff00]" />,
    title: "Auto-Apply",
    description: "Submits applications while you sleep. Fills out forms, uploads files, and answers screening questions.",
    colSpan: "col-span-1 md:col-span-1",
  },
  {
    icon: <FileText className="w-8 h-8 text-[#1dff00]" />,
    title: "Dynamic Resume",
    description: "AI rewrites your resume for every single job to beat ATS filters.",
    colSpan: "col-span-1 md:col-span-1",
  },
  {
    icon: <BarChart3 className="w-8 h-8 text-[#1dff00]" />,
    title: "Analytics Core",
    description: "Real-time dashboard of your funnel: Applications sent, views, interviews, and offers.",
    colSpan: "col-span-1 md:col-span-2 lg:col-span-2",
  },
  {
    icon: <Shield className="w-8 h-8 text-[#1dff00]" />,
    title: "Verified Jobs Only",
    description: "Anti-spam filters ensure you only apply to legitimate companies.",
    colSpan: "col-span-1 md:col-span-1 lg:col-span-1",
  },
  {
    icon: <Activity className="w-8 h-8 text-[#1dff00]" />,
    title: "Status Monitoring",
    description: "Tracks email replies and application status updates automatically.",
    colSpan: "col-span-1 md:col-span-1 lg:col-span-2",
  },
];

export const BentoGrid = () => {
  return (
    <section className="py-24 bg-black relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-bold font-mono text-white mb-6">
            FULL STACK <span className="text-[#1dff00]">AUTOMATION</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto font-mono">
            A complete suite of tools designed to replace the manual labor of job hunting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`
                ${feature.colSpan}
                group relative p-6 md:p-8
                rounded-xl overflow-hidden
                bg-white/5 backdrop-blur-md
                border border-white/10 hover:border-[#1dff00]/50
                transition-colors duration-300
              `}
            >
              {/* Hover Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1dff00]/0 to-[#1dff00]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="mb-4 bg-black/50 w-fit p-3 rounded-lg border border-[#1dff00]/20 group-hover:border-[#1dff00] transition-colors">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 font-mono group-hover:text-[#1dff00] transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
