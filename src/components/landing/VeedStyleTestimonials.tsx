import React from 'react';
import { Quote, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../ui/card';

export const VeedStyleTestimonials: React.FC = () => {
  const testimonials = [
    {
      quote: "This platform has been game-changing. It's allowed us to create gorgeous content for social promotion and ad units with ease.",
      author: "Max Alter",
      title: "Director of Audience Development",
      company: "NBCUniversal",
      rating: 5,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
    },
    {
      quote: "I love using this tool. The subtitles are the most accurate I've seen on the market. It's helped take my content to the next level.",
      author: "Laura Haleydt",
      title: "Brand Marketing Manager",
      company: "Carlsberg Importers",
      rating: 5,
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face"
    },
    {
      quote: "I used multiple tools before - one for recording, another for captions, and a third for storing. I can now do this all in one spot.",
      author: "Cedric Gustavo Ravache",
      title: "Enterprise Account Executive",
      company: "Cloud Software Group",
      rating: 5,
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
    }
  ];

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
            LOVED BY CREATORS.
          </h2>
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#1dff00]">
            LOVED BY THE FORTUNE 500
          </h3>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.02 }}
              className="transition-transform duration-300"
            >
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] hover:border-[#1dff00]/50 transition-all duration-300 h-full">
                <CardContent className="p-6 sm:p-8 h-full flex flex-col">
                  {/* Quote Icon */}
                  <div className="mb-4 sm:mb-6">
                    <Quote className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />
                  </div>
                  
                  {/* Quote Text */}
                  <blockquote className="text-[#ffffff80] mb-6 leading-relaxed flex-grow text-sm sm:text-base">
                    "{testimonial.quote}"
                  </blockquote>
                  
                  {/* Author Info */}
                  <div className="border-t border-[#ffffff1a] pt-4 sm:pt-6">
                    <div className="flex items-center space-x-3 sm:space-x-4 mb-3">
                      <img
                        src={testimonial.image}
                        alt={testimonial.author}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#1dff00]"
                      />
                      <div>
                        <div className="font-bold text-white text-sm sm:text-base">
                          {testimonial.author}
                        </div>
                        <div className="text-xs sm:text-sm text-[#ffffff80]">
                          {testimonial.title}, {testimonial.company}
                        </div>
                      </div>
                    </div>
                    
                    {/* Rating */}
                    <div className="flex text-[#1dff00]">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};