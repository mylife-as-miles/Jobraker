import React from 'react';
import { motion } from 'framer-motion';
import { Bot, FileText, BarChart3, Activity, ArrowRight, MessageSquare, Mic } from 'lucide-react';
import { KanbanCard } from '../../../components/landing/visuals/KanbanCard';
import { ScanningVisual } from '../../../components/landing/visuals/ScanningVisual';
import { ChatVisual } from '../../../components/landing/visuals/ChatVisual';
import { VoiceInteractionVisual } from '../../../components/landing/visuals/VoiceInteractionVisual';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
};

export const BentoGrid = () => {
  return (
    <section className="py-24 bg-black relative overflow-hidden">
      {/* Subtle Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[400px] h-[400px] bg-[#1dff00]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="mb-20 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/5 text-gray-300 text-xs font-mono tracking-widest uppercase mb-6 backdrop-blur-sm"
          >
             <Bot className="w-3 h-3 mr-2 text-[#1dff00]" />
             Platform Capabilities
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold font-sans text-white mb-6 tracking-tight"
          >
            Everything you need to <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1dff00] to-emerald-600">dominate the job market.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg md:text-xl font-light leading-relaxed"
          >
            Stop manually applying. JobRaker automates the entire process from search to submission, giving you an unfair advantage.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >

          {/* Card 1: Kanban (Large) */}
          <motion.div
            variants={itemVariants}
            className="col-span-1 md:col-span-2 row-span-2 relative group overflow-hidden rounded-3xl bg-[#0B0C0E] border border-white/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="p-8 h-full flex flex-col z-10 relative">
              <div className="mb-8">
                <div className="w-10 h-10 rounded-full bg-[#1dff00]/10 flex items-center justify-center mb-4 border border-[#1dff00]/20">
                  <Activity className="w-5 h-5 text-[#1dff00]" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-2">Autonomous Application System</h3>
                <p className="text-gray-400 max-w-md">Our AI agents navigate job boards, fill out forms, and submit applications while you sleep. Watch your 'Applied' column grow automatically.</p>
              </div>

              <div className="flex-1 w-full relative min-h-[250px] bg-[#15171A] rounded-xl border border-white/5 overflow-hidden">
                <KanbanCard />
              </div>
            </div>
          </motion.div>

          {/* Card 2: Resume Intelligence (Small) */}
          <motion.div
             variants={itemVariants}
             className="col-span-1 md:col-span-1 row-span-1 relative group overflow-hidden rounded-3xl bg-[#0B0C0E] border border-white/10"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
             <div className="p-6 h-full flex flex-col">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <FileText className="w-4 h-4 text-blue-400" />
                 </div>
               </div>
               <h3 className="text-lg font-semibold text-white mb-1">Resume Intelligence</h3>
               <p className="text-gray-400 text-sm mb-4">Dynamic tailoring for every application.</p>
               <div className="flex-1 w-full bg-[#15171A] rounded-lg border border-white/5 overflow-hidden relative">
                 <ScanningVisual />
               </div>
             </div>
          </motion.div>

          {/* Card 3: Chat with AI (Small - was Analytics) */}
          <motion.div
             variants={itemVariants}
             className="col-span-1 md:col-span-1 row-span-1 relative group overflow-hidden rounded-3xl bg-[#0B0C0E] border border-white/10"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
             <div className="p-6 h-full flex flex-col">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-8 h-8 rounded-full bg-[#1dff00]/10 flex items-center justify-center border border-[#1dff00]/20">
                    <MessageSquare className="w-4 h-4 text-[#1dff00]" />
                 </div>
               </div>
               <h3 className="text-lg font-semibold text-white mb-1">AI Assistant</h3>
               <p className="text-gray-400 text-sm mb-4">Chat with your agent. Gmail integrated.</p>
               <div className="flex-1 w-full bg-[#15171A] rounded-lg border border-white/5 overflow-hidden flex flex-col">
                 <ChatVisual />
               </div>
             </div>
          </motion.div>

          {/* Card 4: Interview Coach (Wide - Updated Visual) */}
          <motion.div
             variants={itemVariants}
             className="col-span-1 md:col-span-3 relative group overflow-hidden rounded-3xl bg-[#0B0C0E] border border-white/10 p-8 flex flex-col md:flex-row items-center gap-8"
          >
             <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

             <div className="flex-1 relative z-10">
               <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#1dff00]/10 text-[#1dff00] text-xs font-bold mb-4">
                 <Mic className="w-3 h-3 mr-2" />
                 VOICE INTERACTIVE
               </div>
               <h3 className="text-2xl font-semibold text-white mb-3">Interview Coach AI</h3>
               <p className="text-gray-400 mb-6">
                 Practice with a voice-interactive AI that simulates real interviews based on the specific job description. Get real-time feedback on your answers.
               </p>
               <button className="text-white flex items-center text-sm font-semibold hover:text-[#1dff00] transition-colors">
                 Try it out <ArrowRight className="w-4 h-4 ml-2" />
               </button>
             </div>

             {/* New Visual Component */}
             <div className="flex-1 w-full h-full min-h-[200px] bg-[#15171A] rounded-xl border border-white/5 flex items-center justify-center relative overflow-hidden">
                <VoiceInteractionVisual />
             </div>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
};
