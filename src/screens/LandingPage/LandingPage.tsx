import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  Users, 
  Target, 
  Zap,
  CheckCircle,
  Star,
  BarChart3,
  Briefcase
} from "lucide-react";

export const LandingPage = (): JSX.Element => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Smooth scroll with spring physics
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Parallax transforms with optimized ratios
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const middleY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const foregroundY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  
  // Smooth spring animations
  const smoothBackgroundY = useSpring(backgroundY, { stiffness: 100, damping: 30 });
  const smoothMiddleY = useSpring(middleY, { stiffness: 150, damping: 25 });
  const smoothForegroundY = useSpring(foregroundY, { stiffness: 200, damping: 20 });

  // Scale and opacity effects
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7], [1, 0.8, 0.3]);

  useEffect(() => {
    setIsLoaded(true);
    
    // Enable hardware acceleration
    if (containerRef.current) {
      containerRef.current.style.transform = "translateZ(0)";
      containerRef.current.style.willChange = "transform";
    }
  }, []);

  const features = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Smart Analytics",
      description: "Track your application success rate with AI-powered insights"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Network Building",
      description: "Connect with industry professionals and expand your network"
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Job Matching",
      description: "Get matched with jobs that fit your skills and preferences"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Auto Apply",
      description: "Automatically apply to relevant positions with custom resumes"
    }
  ];

  const stats = [
    { number: "10K+", label: "Active Users" },
    { number: "95%", label: "Success Rate" },
    { number: "500+", label: "Partner Companies" },
    { number: "24/7", label: "Support" }
  ];

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-black overflow-hidden relative"
      style={{ willChange: "transform" }}
    >
      {/* Background Layer - Slowest parallax (z-index: 1) */}
      <motion.div
        className="fixed inset-0 z-[1]"
        style={{ 
          y: smoothBackgroundY,
          transform: "translateZ(0)",
          willChange: "transform"
        }}
      >
        {/* Animated background elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-20 w-48 h-48 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-2xl animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-gradient-to-r from-[#1dff00]/15 to-[#0a8246]/15 rounded-full blur-xl animate-pulse delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-[#1dff00]/5 to-[#0a8246]/5 rounded-full blur-3xl animate-pulse delay-3000" />
      </motion.div>

      {/* Middle Layer - Medium parallax (z-index: 10) */}
      <motion.div
        className="relative z-[10]"
        style={{ 
          y: smoothMiddleY,
          transform: "translateZ(0)",
          willChange: "transform"
        }}
      >
        {/* Floating elements */}
        <div className="absolute top-20 right-10 opacity-20">
          <motion.div
            animate={{ 
              y: [-20, 20, -20],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          >
            <BarChart3 className="w-16 h-16 text-[#1dff00]" />
          </motion.div>
        </div>
        
        <div className="absolute bottom-32 left-10 opacity-20">
          <motion.div
            animate={{ 
              y: [20, -20, 20],
              rotate: [0, -5, 5, 0]
            }}
            transition={{ 
              duration: 10, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 2
            }}
          >
            <Briefcase className="w-12 h-12 text-[#1dff00]" />
          </motion.div>
        </div>
      </motion.div>

      {/* Foreground Content - Fastest parallax (z-index: 20) */}
      <motion.div
        className="relative z-[20] min-h-screen"
        style={{ 
          y: smoothForegroundY,
          transform: "translateZ(0)",
          willChange: "transform"
        }}
      >
        {/* Hero Section */}
        <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 50 }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ 
                scale,
                opacity,
                transform: "translateZ(0)",
                willChange: "transform"
              }}
            >
              {/* Logo */}
              <motion.div
                className="flex items-center justify-center mb-8"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="w-16 h-16 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center mr-4">
                  <Sparkles className="w-8 h-8 text-black" />
                </div>
                <span className="text-4xl font-bold text-white">JobRaker</span>
              </motion.div>

              {/* Main Headline */}
              <motion.h1
                className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white mb-6 leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
              >
                Land Your
                <span className="block bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                  Dream Job
                </span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                className="text-xl sm:text-2xl lg:text-3xl text-[#ffffff80] mb-12 max-w-4xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.4 }}
              >
                AI-powered job tracking, smart applications, and career insights 
                that put you ahead of the competition.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center mb-16"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.6 }}
              >
                <Button
                  onClick={() => navigate("/signup")}
                  className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-black font-bold text-lg px-8 py-4 rounded-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 min-w-[200px]"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                
                <Button
                  variant="outline"
                  className="border-2 border-[#1dff00] text-[#1dff00] font-bold text-lg px-8 py-4 rounded-xl hover:bg-[#1dff00]/10 hover:scale-105 transition-all duration-300 min-w-[200px]"
                >
                  Watch Demo
                </Button>
              </motion.div>

              {/* Stats */}
              <motion.div
                className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.8 }}
              >
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className="text-center"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1dff00] mb-2">
                      {stat.number}
                    </div>
                    <div className="text-sm sm:text-base text-[#ffffff60]">
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                Why Choose JobRaker?
              </h2>
              <p className="text-lg sm:text-xl text-[#ffffff80] max-w-3xl mx-auto">
                Our AI-powered platform gives you the tools and insights you need 
                to accelerate your job search and land your dream position.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05, y: -10 }}
                >
                  <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-6 rounded-2xl hover:shadow-2xl hover:border-[#1dff00]/50 transition-all duration-500 h-full">
                    <CardContent className="p-0">
                      <div className="w-12 h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center mb-4 text-black">
                        {feature.icon}
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">
                        {feature.title}
                      </h3>
                      <p className="text-[#ffffff80] leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Card className="bg-gradient-to-br from-[#1dff00] via-[#16d918] to-[#0a8246] border-none p-8 sm:p-12 rounded-3xl shadow-2xl">
                <CardContent className="p-0">
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-6">
                    Ready to Transform Your Career?
                  </h2>
                  <p className="text-lg sm:text-xl text-black/80 mb-8 max-w-2xl mx-auto">
                    Join thousands of professionals who have accelerated their job search with JobRaker.
                  </p>
                  <Button
                    onClick={() => navigate("/signup")}
                    className="bg-black text-[#1dff00] font-bold text-lg px-8 py-4 rounded-xl hover:bg-black/90 hover:scale-105 transition-all duration-300"
                  >
                    Start Your Journey Today
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </motion.div>
    </div>
  );
};