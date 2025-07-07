import React, { useState } from 'react';
import { Sparkles, Play, BookOpen, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export const VeedStyleHero: React.FC = () => {
  const [inputValue, setInputValue] = useState('');

  const quickActions = [
    { icon: <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Create an ad', color: 'border-orange-300 text-orange-600 hover:bg-orange-50' },
    { icon: <Play className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Create a promo video', color: 'border-green-300 text-green-600 hover:bg-green-50' },
    { icon: <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Create a tutorial', color: 'border-pink-300 text-pink-600 hover:bg-pink-50' },
    { icon: <Zap className="w-4 h-4 sm:w-5 sm:h-5" />, text: 'Create an AI Clip', color: 'border-blue-300 text-blue-600 hover:bg-blue-50' },
  ];

  return (
    <section className="pt-20 sm:pt-24 pb-12 sm:pb-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <motion.div 
          className="flex items-center space-x-2 text-xs sm:text-sm text-[#ffffff80] mb-6 sm:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-white">Home</span>
          <span>/</span>
          <span className="text-white">Your Tools</span>
          <span>/</span>
          <span className="text-[#1dff00]">AI Generator</span>
        </motion.div>

        {/* Main Content */}
        <div className="text-center">
          {/* Badge */}
          <motion.div 
            className="inline-flex items-center space-x-2 bg-[#1dff00]/10 border border-[#1dff00]/30 text-[#1dff00] px-3 py-2 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium mb-6 sm:mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>AI Text to Content</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1 
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            AI CONTENT GENERATOR
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            className="text-lg sm:text-xl lg:text-2xl text-[#ffffff80] mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            AI-generated content and UGC-style creators to educate, promote, and sell.
          </motion.p>

          {/* Input Section */}
          <motion.div 
            className="max-w-2xl mx-auto mb-6 sm:mb-8 px-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your idea here..."
                  className="w-full h-12 sm:h-16 px-3 py-2 sm:px-4 sm:py-3 bg-[#ffffff1a] border-2 border-[#ffffff33] rounded-lg focus:border-[#1dff00] focus:outline-none resize-none text-white placeholder:text-[#ffffff60] text-sm sm:text-base transition-all duration-300"
                />
              </div>
              <Button className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black hover:shadow-lg transition-all px-6 py-3 sm:px-8 sm:py-4 text-sm sm:text-base font-medium rounded-lg">
                Generate
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>

          {/* Quick Action Buttons */}
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto px-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {quickActions.map((action, index) => (
              <motion.button
                key={index}
                className={`flex items-center justify-center space-x-2 px-4 py-3 sm:px-6 sm:py-4 border-2 rounded-lg transition-all duration-300 bg-[#ffffff0a] backdrop-blur-sm hover:scale-105 hover:shadow-lg ${action.color}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
              >
                {action.icon}
                <span className="font-medium text-xs sm:text-sm">{action.text}</span>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};