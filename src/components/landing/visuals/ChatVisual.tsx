import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Mail } from 'lucide-react';

export const ChatVisual = () => {
  return (
    <div className="w-full h-full p-4 flex flex-col justify-end space-y-3 font-mono text-xs overflow-hidden">
      {/* Message 1: User Request */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="flex items-start space-x-2"
      >
        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <User className="w-3 h-3 text-gray-400" />
        </div>
        <div className="bg-white/10 p-2 rounded-r-lg rounded-bl-lg text-gray-300 max-w-[80%]">
          Check my emails for interview requests.
        </div>
      </motion.div>

      {/* Message 2: AI Processing (Gmail MCP) */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="flex items-start space-x-2 flex-row-reverse space-x-reverse"
      >
        <div className="w-6 h-6 rounded-full bg-[#1dff00]/10 border border-[#1dff00]/30 flex items-center justify-center shrink-0">
          <Bot className="w-3 h-3 text-[#1dff00]" />
        </div>
        <div className="bg-[#1dff00]/5 border border-[#1dff00]/10 p-2 rounded-l-lg rounded-br-lg text-[#1dff00] max-w-[85%]">
          <div className="flex items-center space-x-2 mb-1 opacity-70">
            <Mail className="w-3 h-3" />
            <span className="text-[10px] uppercase">Gmail Access Active</span>
          </div>
          Found 2 new invites from Google and Netflix.
        </div>
      </motion.div>

       {/* Message 3: Typing Indicator */}
       <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.0 }}
        className="flex items-start space-x-2 flex-row-reverse space-x-reverse"
      >
         <div className="w-6 h-6 rounded-full bg-[#1dff00]/10 border border-[#1dff00]/30 flex items-center justify-center shrink-0">
          <Bot className="w-3 h-3 text-[#1dff00]" />
        </div>
        <div className="bg-[#1dff00]/5 border border-[#1dff00]/10 px-3 py-2 rounded-l-lg rounded-br-lg flex space-x-1 items-center">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0 }}
              className="w-1 h-1 bg-[#1dff00] rounded-full"
            />
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
              className="w-1 h-1 bg-[#1dff00] rounded-full"
            />
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
              className="w-1 h-1 bg-[#1dff00] rounded-full"
            />
        </div>
      </motion.div>
    </div>
  );
};
