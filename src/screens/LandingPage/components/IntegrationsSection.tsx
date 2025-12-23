import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Globe, Linkedin, Mail, FileText, Database, Server, Code, Bot } from 'lucide-react';

const integrations = [
  { name: "LinkedIn", icon: <Linkedin className="w-6 h-6" />, angle: 0 },
  { name: "Indeed", icon: <Globe className="w-6 h-6" />, angle: 45 },
  { name: "Glassdoor", icon: <Briefcase className="w-6 h-6" />, angle: 90 },
  { name: "Gmail", icon: <Mail className="w-6 h-6" />, angle: 135 },
  { name: "Outlook", icon: <Mail className="w-6 h-6" />, angle: 180 },
  { name: "Greenhouse", icon: <Server className="w-6 h-6" />, angle: 225 },
  { name: "Lever", icon: <Database className="w-6 h-6" />, angle: 270 },
  { name: "GitHub", icon: <Code className="w-6 h-6" />, angle: 315 },
];

export const IntegrationsSection = () => {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      <div className="container mx-auto px-4 text-center relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold font-mono text-white mb-6">
          CONNECTED <span className="text-[#1dff00]">ECOSYSTEM</span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto font-mono mb-12">
          JobRaker acts as the central hub, autonomously interacting with the platforms you use every day.
        </p>

        {/* Orbit Animation Container */}
        <div className="relative w-full max-w-4xl mx-auto h-[350px] md:h-[500px] flex items-center justify-center">

            {/* Background Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[280px] h-[280px] md:w-[450px] md:h-[450px] rounded-full border border-white/5 animate-[spin_60s_linear_infinite]" />
                <div className="w-[400px] h-[400px] md:w-[650px] md:h-[650px] rounded-full border border-white/5 absolute animate-[spin_80s_linear_infinite_reverse]" />
            </div>

            {/* Central Hub (JobRaker) */}
            <motion.div
               animate={{ boxShadow: ["0 0 20px rgba(29,255,0,0.2)", "0 0 50px rgba(29,255,0,0.4)", "0 0 20px rgba(29,255,0,0.2)"] }}
               transition={{ duration: 3, repeat: Infinity }}
               className="w-24 h-24 bg-black rounded-full border-2 border-[#1dff00] z-20 flex items-center justify-center relative"
            >
                <Bot className="w-10 h-10 text-[#1dff00]" />
                <div className="absolute inset-0 bg-[#1dff00] rounded-full blur-xl opacity-20" />
            </motion.div>

            {/* Alternative Orbit Implementation: Rotation Containers */}
             {integrations.map((item, index) => {
                 return (
                    <div
                        key={index}
                        className="absolute top-1/2 left-1/2 w-[280px] h-[280px] md:w-[450px] md:h-[450px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ transform: `rotate(${item.angle}deg)` }} // Initial position
                    >
                        {/* Orbiting Wrapper */}
                        <motion.div
                           animate={{ rotate: 360 }}
                           transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                           className="w-full h-full absolute top-0 left-0"
                        >
                            {/* Icon Container (at top of circle) */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                                <motion.div
                                    whileHover={{ scale: 1.2, borderColor: "#1dff00" }}
                                    className="w-12 h-12 md:w-16 md:h-16 bg-[#0a0a0a] border border-white/10 rounded-xl flex items-center justify-center relative z-10 shadow-lg group"
                                >
                                    <motion.div
                                       animate={{ rotate: -360 }} // Counter-rotate to keep icon upright
                                       transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                                       className="text-white group-hover:text-[#1dff00] transition-colors"
                                    >
                                        {item.icon}
                                    </motion.div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                 );
             })}

             {/* Connection Lines (Static for simplicity or complex SVG) */}
             <div className="absolute top-1/2 left-1/2 w-[280px] h-[280px] md:w-[450px] md:h-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#1dff00]/20 pointer-events-none" />

        </div>
      </div>
    </section>
  );
};
