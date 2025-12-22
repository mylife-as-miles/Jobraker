import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, FileText, BarChart3, Shield, Activity, Zap, Check, Cpu, Brain, Lock } from 'lucide-react';

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
  {
    icon: <Brain className="w-8 h-8 text-[#1dff00]" />,
    title: "Interview Coach",
    description: "AI simulates interviews based on the specific job description you're applying for.",
    colSpan: "col-span-1 md:col-span-2 lg:col-span-2",
  },
  {
    icon: <Lock className="w-8 h-8 text-[#1dff00]" />,
    title: "Secure Data",
    description: "Enterprise-grade encryption for your personal data and resume documents.",
    colSpan: "col-span-1 md:col-span-1",
  }
];

export const BentoGrid = () => {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#1dff00]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#0a8246]/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-16 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-[#1dff00]/30 bg-[#1dff00]/5 text-[#1dff00] text-xs font-mono tracking-widest uppercase mb-4">
             <Cpu className="w-3 h-3 mr-2" />
             Core Features
          </div>
          <h2 className="text-3xl md:text-5xl font-bold font-mono text-white mb-6">
            FULL STACK <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1dff00] to-[#00b300]">AUTOMATION</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto font-mono text-lg">
            A complete suite of tools designed to replace the manual labor of job hunting with precision engineering.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[minmax(200px,auto)]">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`
                ${feature.colSpan}
                group relative p-8
                rounded-2xl overflow-hidden
                bg-[#0f0f0f]
                border border-white/5 hover:border-[#1dff00]/50
                transition-all duration-500 ease-out
                hover:shadow-[0_0_30px_rgba(29,255,0,0.1)]
              `}
            >
              {/* Hover Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#1dff00] to-[#00b300] rounded-2xl opacity-0 group-hover:opacity-10 blur transition duration-500" />
              <div className="absolute inset-0 bg-[#0a0a0a] rounded-2xl" />

              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-black/80 p-3 rounded-xl border border-[#1dff00]/20 group-hover:border-[#1dff00] group-hover:bg-[#1dff00]/10 transition-colors duration-300">
                    {feature.icon}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                    <Check className="w-5 h-5 text-[#1dff00]" />
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-3 font-mono group-hover:text-[#1dff00] transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-mono">
                    {feature.description}
                  </p>
                </div>

                {/* Decorative tech lines */}
                <div className="absolute bottom-4 right-4 flex space-x-1 opacity-20 group-hover:opacity-60 transition-opacity">
                  <div className="w-1 h-1 bg-[#1dff00] rounded-full animate-pulse" />
                  <div className="w-1 h-1 bg-[#1dff00] rounded-full animate-pulse delay-75" />
                  <div className="w-1 h-1 bg-[#1dff00] rounded-full animate-pulse delay-150" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
