import React from 'react';
import { Edit3, Settings, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../ui/card';

export const VeedStyleHowTo: React.FC = () => {
  const steps = [
    {
      number: 1,
      title: 'Type a prompt',
      description: 'Describe the content you want to generate or click one of our prompts. Our AI will create a script you can edit to match your message and brand voice.',
      icon: <Edit3 className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-[#1dff00]" />,
      color: 'from-purple-500/20 to-purple-600/20'
    },
    {
      number: 2,
      title: 'Customize your content',
      description: 'Choose the aspect ratio, avatar or voiceover, music, and caption style. Replace footage by uploading your own media, selecting stock content, or generating new visuals.',
      icon: <Settings className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-[#1dff00]" />,
      color: 'from-blue-500/20 to-blue-600/20'
    },
    {
      number: 3,
      title: 'Export or keep creating',
      description: 'Click "Done" to export your content. Or open our editor to add text, your brand assets, and more. You can even create a custom avatar or voice clone to personalize your content.',
      icon: <Download className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-[#1dff00]" />,
      color: 'from-indigo-500/20 to-indigo-600/20'
    }
  ];

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            HOW TO GENERATE AI CONTENT FROM TEXT:
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 mb-16 sm:mb-20">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              className="text-center"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              {/* Icon */}
              <motion.div 
                className={`w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br ${step.color} rounded-2xl mx-auto mb-4 sm:mb-6 flex items-center justify-center border border-[#ffffff15] backdrop-blur-sm`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {step.icon}
              </motion.div>

              {/* Step Number */}
              <div className="text-xs sm:text-sm font-bold text-[#1dff00] mb-2">
                STEP {step.number}
              </div>

              {/* Title */}
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-3 sm:mb-4">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-[#ffffff80] leading-relaxed text-sm sm:text-base">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Learn More Section */}
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-3 sm:mb-4">
            LEARN MORE
          </h3>
          <p className="text-[#ffffff80] mb-6 sm:mb-8 text-sm sm:text-base">
            Watch our text-to-content AI tutorial:
          </p>
          
          {/* Video Placeholder */}
          <div className="max-w-4xl mx-auto">
            <motion.div 
              className="bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/20 rounded-2xl p-6 sm:p-8 h-48 sm:h-64 lg:h-80 flex items-center justify-center border border-[#ffffff15] backdrop-blur-sm cursor-pointer group"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center">
                <motion.div 
                  className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full mx-auto mb-3 sm:mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="text-white text-lg sm:text-xl lg:text-2xl">▶</span>
                </motion.div>
                <p className="text-white font-medium text-sm sm:text-base lg:text-lg">Tutorial Video</p>
                <p className="text-xs sm:text-sm text-[#ffffff80] mt-1 sm:mt-2">Generate content explaining how to build...</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};