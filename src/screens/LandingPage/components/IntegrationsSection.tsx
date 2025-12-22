import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Globe, Linkedin, Mail, FileText, Database, Server, Code } from 'lucide-react';

const integrations = [
  { name: "LinkedIn", icon: <Linkedin className="w-8 h-8" /> },
  { name: "Indeed", icon: <Globe className="w-8 h-8" /> },
  { name: "Glassdoor", icon: <Briefcase className="w-8 h-8" /> },
  { name: "Gmail", icon: <Mail className="w-8 h-8" /> },
  { name: "Outlook", icon: <Mail className="w-8 h-8" /> },
  { name: "Greenhouse", icon: <Server className="w-8 h-8" /> },
  { name: "Lever", icon: <Database className="w-8 h-8" /> },
  { name: "GitHub", icon: <Code className="w-8 h-8" /> },
];

export const IntegrationsSection = () => {
  return (
    <section className="py-24 bg-black relative">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-5xl font-bold font-mono text-white mb-6">
          CONNECTED <span className="text-[#1dff00]">ECOSYSTEM</span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto font-mono mb-16">
          JobRaker integrates seamlessly with the platforms you use every day.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {integrations.map((item, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05, borderColor: "#1dff00" }}
              className="flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <div className="text-white mb-4 opacity-80 group-hover:opacity-100 group-hover:text-[#1dff00] transition-colors">
                {item.icon}
              </div>
              <span className="text-gray-400 font-mono text-sm">{item.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
