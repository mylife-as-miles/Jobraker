import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Globe, Linkedin, Mail, FileText, Database, Server, Code, Bot, Cpu, Network, Share2 } from 'lucide-react';

// Split integrations into two orbital groups
const innerOrbitIcons = [
  { name: "Gmail", icon: <Mail className="w-5 h-5" />, color: "#EA4335" },
  { name: "Outlook", icon: <Mail className="w-5 h-5" />, color: "#0078D4" },
  { name: "Indeed", icon: <Globe className="w-5 h-5" />, color: "#2164f3" },
  { name: "Glassdoor", icon: <Briefcase className="w-5 h-5" />, color: "#0CAA41" },
];

const outerOrbitIcons = [
  { name: "LinkedIn", icon: <Linkedin className="w-6 h-6" />, color: "#0077b5" },
  { name: "Greenhouse", icon: <Server className="w-6 h-6" />, color: "#00B2A9" },
  { name: "Lever", icon: <Database className="w-6 h-6" />, color: "#F76800" },
  { name: "GitHub", icon: <Code className="w-6 h-6" />, color: "#ffffff" },
  { name: "Workday", icon: <FileText className="w-6 h-6" />, color: "#E2832B" },
];

export const IntegrationsSection = () => {
  return (
    <section className="py-24 bg-black relative overflow-hidden min-h-[800px] flex flex-col justify-center">
      {/* Background Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#1dff00]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 text-center relative z-10 mb-12">
        <h2 className="text-4xl md:text-6xl font-bold font-mono text-white mb-6 tracking-tight">
          CONNECTED <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1dff00] to-emerald-500">ECOSYSTEM</span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto font-mono text-lg">
          JobRaker acts as the central intelligence, orchestrating your entire job search across every platform.
        </p>
      </div>

      {/* Advanced Orbital System Container */}
      <div className="relative w-full h-[600px] flex items-center justify-center overflow-visible">

        {/* Central Hub (The AI Core) */}
        <div className="absolute z-20">
            <div className="relative flex items-center justify-center">
                {/* Core Pulse */}
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute w-32 h-32 bg-[#1dff00]/20 rounded-full blur-xl"
                />
                <div className="w-20 h-20 bg-black rounded-full border border-[#1dff00]/50 flex items-center justify-center shadow-[0_0_30px_rgba(29,255,0,0.3)] relative z-20 backdrop-blur-sm">
                    <Bot className="w-10 h-10 text-[#1dff00]" />
                </div>
                {/* Scanning Ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute w-24 h-24 rounded-full border-t-2 border-[#1dff00] border-r-transparent border-b-transparent border-l-transparent opacity-50"
                />
            </div>
        </div>

        {/* Inner Orbit (Clockwise) */}
        <div className="absolute z-10">
            <div className="relative w-[300px] h-[300px] rounded-full border border-white/5 flex items-center justify-center">
                {/* Orbit Path Visuals */}
                <div className="absolute inset-0 rounded-full border border-dashed border-white/10 animate-[spin_60s_linear_infinite]" />

                {/* Icons */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                >
                    {innerOrbitIcons.map((item, index) => {
                        const angle = (index / innerOrbitIcons.length) * 360;
                        return (
                            <div
                                key={item.name}
                                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full"
                                style={{ transform: `rotate(${angle}deg)` }}
                            >
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <motion.div
                                        animate={{ rotate: -360 }}
                                        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                                        className="w-12 h-12 bg-[#0a0a0a] border border-white/10 rounded-xl flex items-center justify-center shadow-lg hover:border-[#1dff00] hover:scale-110 transition-all duration-300 group"
                                    >
                                        <div className="text-gray-300 group-hover:text-white transition-colors">
                                            {item.icon}
                                        </div>
                                        {/* Tooltip */}
                                        <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/10 px-2 py-1 rounded text-xs whitespace-nowrap text-[#1dff00]">
                                            {item.name}
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        );
                    })}
                </motion.div>
            </div>
        </div>

        {/* Outer Orbit (Counter-Clockwise) */}
        <div className="absolute z-10">
            <div className="relative w-[500px] h-[500px] rounded-full border border-white/5 flex items-center justify-center">
                 {/* Orbit Path Visuals */}
                 <div className="absolute inset-0 rounded-full border border-white/5 opacity-50" />
                 <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 100, repeat: Infinity, ease: "linear" }} // Background ring spins slowly
                    className="absolute inset-0 rounded-full border-t border-white/20"
                 />

                {/* Icons */}
                <motion.div
                    animate={{ rotate: -360 }} // Reverse direction
                    transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                >
                    {outerOrbitIcons.map((item, index) => {
                        const angle = (index / outerOrbitIcons.length) * 360;
                        return (
                            <div
                                key={item.name}
                                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full"
                                style={{ transform: `rotate(${angle}deg)` }}
                            >
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <motion.div
                                        animate={{ rotate: 360 }} // Counter-rotate relative to container
                                        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                                        className="w-14 h-14 bg-[#0a0a0a] border border-white/10 rounded-2xl flex items-center justify-center shadow-xl hover:border-[#1dff00] hover:scale-110 transition-all duration-300 group backdrop-blur-md"
                                    >
                                        <div className="text-gray-300 group-hover:text-white transition-colors">
                                            {item.icon}
                                        </div>
                                        <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/10 px-2 py-1 rounded text-xs whitespace-nowrap text-[#1dff00]">
                                            {item.name}
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        );
                    })}
                </motion.div>
            </div>
        </div>

        {/* Decor: Floating Particles / Satellites */}
         <div className="absolute z-0 w-[700px] h-[700px] pointer-events-none opacity-30">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
                className="w-full h-full relative"
            >
                <div className="absolute top-0 left-1/2 w-2 h-2 bg-[#1dff00] rounded-full blur-[2px]" />
                <div className="absolute bottom-1/4 right-0 w-1 h-1 bg-white rounded-full blur-[1px]" />
                <div className="absolute top-1/3 left-0 w-1.5 h-1.5 bg-[#1dff00] rounded-full blur-[1px]" />
            </motion.div>
         </div>

      </div>
    </section>
  );
};
