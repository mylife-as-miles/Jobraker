import React from 'react';
import { ArrowRight, Target, Clock, Brain, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export const VeedStyleFeatures: React.FC = () => {
  const benefits = [
    {
      icon: <Target className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00]" />,
      title: "3x Higher Success Rate",
      description: "Our users land interviews 3x faster than traditional job seekers",
      stat: "300%"
    },
    {
      icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00]" />,
      title: "Save 15+ Hours Weekly",
      description: "Automate repetitive tasks and focus on what matters most",
      stat: "15h"
    },
    {
      icon: <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00]" />,
      title: "AI-Powered Insights",
      description: "Get personalized recommendations based on market data",
      stat: "AI"
    },
    {
      icon: <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00]" />,
      title: "Enterprise Security",
      description: "Your data is protected with bank-level encryption",
      stat: "100%"
    }
  ];

  const companies = ['VISA', 'Ventura Foods', 'MERCK', 'TARGET', 'PENTAX', 'P&G', 'Meta'];

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* First Feature */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-16 sm:mb-20">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4 sm:mb-6">
              Engage your audience.
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-[#ffffff80] mb-6 sm:mb-8 leading-relaxed">
              Effortlessly produce scroll-stopping content for TikTok, Instagram, and YouTube.
            </p>
            <Card className="bg-[#1dff00]/10 border border-[#1dff00]/30 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
              <CardContent className="p-0">
                <p className="text-[#1dff00] font-medium text-sm sm:text-base mb-2">
                  Create professional content 8X faster with our Enterprise plan
                </p>
                <Button 
                  variant="ghost" 
                  className="text-[#1dff00] hover:text-[#1dff00]/80 hover:bg-[#1dff00]/10 font-medium p-0 h-auto text-sm sm:text-base"
                >
                  Talk to Sales <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div 
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/20 rounded-2xl p-6 sm:p-8 h-64 sm:h-80 flex items-center justify-center border border-[#ffffff15] backdrop-blur-sm">
              <div className="text-center">
                <motion.div 
                  className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full mx-auto mb-4 flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <span className="text-white text-xl sm:text-2xl">🎬</span>
                </motion.div>
                <p className="text-white font-medium text-sm sm:text-base">Interactive Demo</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Benefits Grid */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] hover:border-[#1dff00]/50 transition-all duration-300 h-full">
                <CardContent className="p-4 sm:p-6 text-center h-full flex flex-col">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    {benefit.icon}
                  </div>
                  <div className="flex items-center justify-center space-x-2 mb-2 sm:mb-3">
                    <h3 className="text-base sm:text-lg font-bold text-white">{benefit.title}</h3>
                    <span className="text-[#1dff00] font-bold text-sm bg-[#1dff00]/10 px-2 py-1 rounded">
                      {benefit.stat}
                    </span>
                  </div>
                  <p className="text-[#ffffff80] text-xs sm:text-sm leading-relaxed flex-grow">{benefit.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Second Feature */}
        <motion.div 
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-6 sm:mb-8">
            Create engaging AI content from text prompts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto">
            <div className="text-left">
              <p className="text-[#ffffff80] leading-relaxed text-sm sm:text-base">
                Our AI content generator lets you create content in seconds — complete with visuals, narration, and captions. Simply type your idea or click one of our automatic prompts. You can describe your topic and the visuals you want to create. Choose between voice-only or a realistic AI avatar. Our AI will generate content from your text prompt.
              </p>
            </div>
            <div className="text-left">
              <p className="text-[#ffffff80] leading-relaxed text-sm sm:text-base">
                Create content for social media, YouTube, or marketing campaigns. Our platform goes beyond AI content generation. Add personal touches using our built-in editor: text overlays, brand logos, caption styles, and even your own avatar. With everything in one platform, cut down production time from days to minutes. Try our free text-to-content AI now.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Company Logos */}
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="grid grid-cols-3 md:grid-cols-7 gap-4 sm:gap-8 items-center opacity-60">
            {companies.map((company, index) => (
              <motion.div 
                key={index} 
                className="text-[#ffffff60] font-bold text-sm sm:text-lg text-center"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 0.6, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.1, opacity: 1 }}
              >
                {company}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};