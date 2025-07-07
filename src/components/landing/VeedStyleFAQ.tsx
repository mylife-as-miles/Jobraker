import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/card';

export const VeedStyleFAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How to create content with the AI generator?",
      answer: "Simply type your idea in the prompt box, choose your preferences for style and format, and our AI will generate content for you in seconds. You can then customize and edit the output to match your needs."
    },
    {
      question: "How do I write good AI prompts?",
      answer: "Be specific and descriptive in your prompts. Include details about the style, tone, audience, and purpose of your content. The more context you provide, the better the AI can understand and fulfill your requirements."
    },
    {
      question: "Is the AI content generator free?",
      answer: "We offer a free tier with basic features and limited usage. For unlimited access and advanced features, we have premium plans starting at competitive rates."
    },
    {
      question: "Can AI generate professional content?",
      answer: "Yes, our AI is trained on high-quality content and can generate professional-grade materials suitable for business use, marketing campaigns, and commercial purposes."
    },
    {
      question: "How do I add custom branding?",
      answer: "You can upload your brand assets, customize colors, fonts, and styles through our editor. Premium plans include brand kit features for consistent branding across all your content."
    },
    {
      question: "What are the usage rights for AI-generated content?",
      answer: "You retain full commercial rights to content generated using our platform. However, please review our terms of service for specific guidelines and restrictions."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">FAQ</h2>
        </motion.div>

        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] hover:border-[#1dff00]/50 transition-all duration-300 overflow-hidden">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-4 py-4 sm:px-6 sm:py-5 text-left flex justify-between items-center hover:bg-[#ffffff0a] transition-colors"
                >
                  <span className="font-medium text-white text-sm sm:text-base pr-4">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {openIndex === index ? (
                      <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#1dff00] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#ffffff80] flex-shrink-0" />
                    )}
                  </motion.div>
                </button>
                
                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 sm:px-6 sm:pb-5">
                        <p className="text-[#ffffff80] leading-relaxed text-sm sm:text-base">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};