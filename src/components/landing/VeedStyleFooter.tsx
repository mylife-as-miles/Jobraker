import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export const VeedStyleFooter: React.FC = () => {
  const discoverTools = [
    'AI Ad Generator', 'AI Animation Generator', 'AI Art Generator', 'AI Commercial Generator',
    'AI Course Creator', 'AI Marketing Generator', 'AI Movie Generator', 'AI Music Generator',
    'AI News Generator', 'AI Reel Generator', 'AI Stock Generator', 'AI Text to Content',
    'AI Demo Tool', 'AI Editor', 'AI Content Generator', 'AI Content Maker',
    'AI Visual Generator', 'AI YouTube Maker', 'Animate from Audio', 'Article to Content',
    'Blog to Content', 'Faceless Content', 'Idea to Content', 'Script to Content'
  ];

  const exploreTools = [
    'AI Explainer Tool', 'AI Presenter', 'AI Text to Speech', 'AI Content Agent',
    'Avatar Creator', 'Explainer Software', 'Social Media Maker', 'Content GPT',
    'Idea Generator', 'Voice Dubber', 'YouTube Maker'
  ];

  const footerSections = [
    {
      title: "Product",
      links: ["Features", "Pricing", "API", "Enterprise"]
    },
    {
      title: "Company", 
      links: ["About", "Blog", "Careers", "Contact"]
    },
    {
      title: "Resources",
      links: ["Help Center", "Tutorials", "Community", "Templates"]
    },
    {
      title: "Legal",
      links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"]
    }
  ];

  return (
    <footer className="bg-[#0a0a0a] text-white border-t border-[#ffffff1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Discover More Section */}
        <motion.div 
          className="mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-[#1dff00]">DISCOVER MORE</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
            {discoverTools.map((tool, index) => (
              <motion.a
                key={index}
                href="#"
                className="text-xs sm:text-sm text-[#ffffff80] hover:text-white transition-colors border border-[#ffffff15] rounded-lg px-2 py-2 sm:px-3 sm:py-2 text-center hover:border-[#1dff00]/50 hover:bg-[#ffffff0a] transition-all duration-300"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.02 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                {tool}
              </motion.a>
            ))}
          </div>
        </motion.div>

        {/* Explore Related Tools */}
        <motion.div 
          className="mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-[#1dff00]">EXPLORE RELATED TOOLS</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
            {exploreTools.map((tool, index) => (
              <motion.a
                key={index}
                href="#"
                className="text-xs sm:text-sm text-[#ffffff80] hover:text-white transition-colors border border-[#ffffff15] rounded-lg px-2 py-2 sm:px-3 sm:py-2 text-center hover:border-[#1dff00]/50 hover:bg-[#ffffff0a] transition-all duration-300"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.02 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
              >
                {tool}
              </motion.a>
            ))}
          </div>
        </motion.div>

        {/* Main Footer Content */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
        >
          {footerSections.map((section, index) => (
            <div key={index}>
              <h4 className="font-bold mb-3 sm:mb-4 text-sm sm:text-base text-white">{section.title}</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-[#ffffff80]">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a href="#" className="hover:text-white transition-colors hover:text-[#1dff00]">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* Bottom Section */}
        <motion.div 
          className="border-t border-[#ffffff1a] pt-6 sm:pt-8"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-6 lg:space-y-0">
            <div className="flex-1">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#1dff00]">JobRaker</h2>
              </div>
              <p className="text-xs sm:text-sm text-[#ffffff80] mb-1 sm:mb-2 max-w-md">
                When it comes to amazing content, all you need is JobRaker
              </p>
              <p className="text-xs sm:text-sm text-[#ffffff80]">No credit card required</p>
            </div>
            
            <div className="text-left lg:text-center flex-1 lg:max-w-md">
              <p className="text-base sm:text-lg font-bold mb-2 text-white">More than AI content creation</p>
              <p className="text-xs sm:text-sm text-[#ffffff80] leading-relaxed">
                JobRaker is more than an AI tool to create content. It's a complete content-editing platform that lets you create professional content in minutes.
              </p>
            </div>
          </div>
          
          <div className="text-center mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-[#ffffff1a]">
            <p className="text-xs sm:text-sm text-[#ffffff60]">
              © 2024 JobRaker. All rights reserved.
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};