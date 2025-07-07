import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { 
  ArrowRight, 
  CheckCircle, 
  Star, 
  Users, 
  TrendingUp, 
  Shield, 
  Zap, 
  Target,
  ChevronDown,
  Play,
  Award,
  BarChart3,
  Globe,
  Sparkles,
  Menu,
  X
} from "lucide-react";

export const LandingPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Parallax transforms
  const backgroundY = useTransform(smoothProgress, [0, 1], ["0%", "50%"]);
  const textY = useTransform(smoothProgress, [0, 1], ["0%", "200%"]);
  const heroScale = useTransform(smoothProgress, [0, 0.5], [1, 1.1]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const debouncedScroll = debounce(handleScroll, 16); // ~60fps
    window.addEventListener('scroll', debouncedScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', debouncedScroll);
  }, []);

  // Debounce utility for performance
  function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const features = [
    {
      icon: <Target className="w-8 h-8 text-[#1dff00]" />,
      title: "Smart Job Matching",
      description: "AI-powered algorithms match you with opportunities that align with your skills and career goals.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-[#1dff00]" />,
      title: "Application Analytics",
      description: "Track your application success rate and get insights to improve your job search strategy.",
      gradient: "from-blue-500/20 to-cyan-500/20"
    },
    {
      icon: <Shield className="w-8 h-8 text-[#1dff00]" />,
      title: "Resume Optimization",
      description: "Get personalized recommendations to optimize your resume for each job application.",
      gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
      icon: <Zap className="w-8 h-8 text-[#1dff00]" />,
      title: "Instant Notifications",
      description: "Stay updated with real-time notifications about application status and new opportunities.",
      gradient: "from-orange-500/20 to-red-500/20"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Software Engineer",
      company: "Google",
      content: "JobRaker helped me land my dream job at Google. The AI matching was incredibly accurate!",
      avatar: "SC",
      rating: 5
    },
    {
      name: "Michael Rodriguez",
      role: "Product Manager",
      company: "Microsoft",
      content: "The analytics dashboard gave me insights I never had before. Increased my success rate by 300%.",
      avatar: "MR",
      rating: 5
    },
    {
      name: "Emily Johnson",
      role: "UX Designer",
      company: "Apple",
      content: "Clean interface, powerful features. JobRaker made my job search organized and efficient.",
      avatar: "EJ",
      rating: 5
    }
  ];

  const stats = [
    { number: "50K+", label: "Active Users", icon: <Users className="w-6 h-6" /> },
    { number: "95%", label: "Success Rate", icon: <TrendingUp className="w-6 h-6" /> },
    { number: "500+", label: "Partner Companies", icon: <Globe className="w-6 h-6" /> },
    { number: "24/7", label: "Support", icon: <Shield className="w-6 h-6" /> }
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Navigation */}
      <motion.nav 
        className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-[#ffffff15]"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <motion.div 
              className="flex items-center space-x-2"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold text-white">JobRaker</span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {["Features", "Pricing", "About", "Contact"].map((item) => (
                <motion.a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-[#ffffff80] hover:text-[#1dff00] transition-colors duration-300 font-medium"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {item}
                </motion.a>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/signup")}
                className="text-white hover:text-[#1dff00] hover:bg-[#1dff00]/10"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => navigate("/signup")}
                className="bg-[#1dff00] text-black hover:bg-[#16d918] shadow-lg hover:shadow-xl"
              >
                Get Started
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div
            className="md:hidden bg-black/95 backdrop-blur-md border-t border-[#ffffff15]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="px-4 py-6 space-y-4">
              {["Features", "Pricing", "About", "Contact"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="block text-[#ffffff80] hover:text-[#1dff00] transition-colors duration-300 font-medium py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item}
                </a>
              ))}
              <div className="pt-4 space-y-3">
                <Button 
                  variant="ghost" 
                  className="w-full justify-center text-white hover:text-[#1dff00] hover:bg-[#1dff00]/10"
                  onClick={() => navigate("/signup")}
                >
                  Sign In
                </Button>
                <Button 
                  className="w-full justify-center bg-[#1dff00] text-black hover:bg-[#16d918]"
                  onClick={() => navigate("/signup")}
                >
                  Get Started
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.nav>

      {/* Hero Section with Parallax */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Parallax Background */}
        <motion.div
          className="absolute inset-0 z-0"
          style={{ y: backgroundY, scale: heroScale }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(29,255,0,0.1)_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(29,255,0,0.05)_0%,transparent_50%)]" />
        </motion.div>

        {/* Floating Elements */}
        <motion.div
          className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-xl"
          animate={{ 
            y: [-20, 20, -20],
            rotate: [0, 180, 360]
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        />
        <motion.div
          className="absolute bottom-32 right-16 w-32 h-32 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-2xl"
          animate={{ 
            y: [20, -20, 20],
            scale: [1, 1.2, 1]
          }}
          transition={{ 
            duration: 10, 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: 2
          }}
        />

        {/* Hero Content */}
        <motion.div
          className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto"
          style={{ y: textY }}
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-8"
          >
            <motion.div
              className="inline-flex items-center px-4 py-2 bg-[#1dff00]/10 border border-[#1dff00]/30 rounded-full text-[#1dff00] text-sm font-medium mb-6"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Powered Job Search Platform
            </motion.div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-[#1dff00] to-white bg-clip-text text-transparent">
                Land Your Dream Job
              </span>
              <br />
              <span className="text-white">
                With Smart Analytics
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-[#ffffff80] mb-8 max-w-3xl mx-auto leading-relaxed">
              Track applications, analyze success rates, and get AI-powered insights 
              to accelerate your career growth.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <Button 
              size="lg"
              onClick={() => navigate("/signup")}
              className="bg-[#1dff00] text-black hover:bg-[#16d918] text-lg px-8 py-4 shadow-2xl hover:shadow-[#1dff00]/25 transition-all duration-300"
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            
            <Button 
              size="lg"
              variant="outline"
              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 text-lg px-8 py-4"
            >
              <Play className="mr-2 w-5 h-5" />
              Watch Demo
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="text-center"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="flex items-center justify-center mb-2 text-[#1dff00]">
                  {stat.icon}
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  {stat.number}
                </div>
                <div className="text-sm text-[#ffffff80]">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-6 h-6 text-[#ffffff60]" />
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Powerful Features for
              <span className="text-[#1dff00]"> Job Seekers</span>
            </h2>
            <p className="text-xl text-[#ffffff80] max-w-3xl mx-auto">
              Everything you need to streamline your job search and land your next opportunity
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
                whileHover={{ 
                  scale: 1.05,
                  rotateY: 5,
                  rotateX: 5
                }}
                className="group"
              >
                <Card className={`h-full bg-gradient-to-br ${feature.gradient} border-[#ffffff15] hover:border-[#1dff00]/50 transition-all duration-300 transform-gpu`}>
                  <CardContent className="p-6">
                    <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">
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

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#0a0a0a] to-[#111111]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Trusted by <span className="text-[#1dff00]">Professionals</span>
            </h2>
            <p className="text-xl text-[#ffffff80] max-w-3xl mx-auto">
              See what our users say about their success with JobRaker
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.02 }}
              >
                <Card className="h-full bg-[#0a0a0a] border-[#ffffff15] hover:border-[#1dff00]/50 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-[#1dff00] fill-current" />
                      ))}
                    </div>
                    <p className="text-[#ffffff80] mb-6 leading-relaxed">
                      "{testimonial.content}"
                    </p>
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center text-black font-bold mr-4">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {testimonial.name}
                        </div>
                        <div className="text-sm text-[#ffffff80]">
                          {testimonial.role} at {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(29,255,0,0.1)_0%,transparent_70%)]" />
        
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Transform Your
            <span className="text-[#1dff00]"> Career Journey?</span>
          </h2>
          <p className="text-xl text-[#ffffff80] mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who have accelerated their careers with JobRaker's intelligent job search platform.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button 
              size="lg"
              onClick={() => navigate("/signup")}
              className="bg-[#1dff00] text-black hover:bg-[#16d918] text-lg px-8 py-4 shadow-2xl hover:shadow-[#1dff00]/25 transition-all duration-300"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            
            <Button 
              size="lg"
              variant="outline"
              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 text-lg px-8 py-4"
            >
              Schedule Demo
            </Button>
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-[#ffffff60]">
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-[#1dff00] mr-2" />
              No credit card required
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-[#1dff00] mr-2" />
              14-day free trial
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-[#1dff00] mr-2" />
              Cancel anytime
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-[#ffffff15] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Logo and Description */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <span className="text-xl font-bold text-white">JobRaker</span>
              </div>
              <p className="text-[#ffffff80] text-sm leading-relaxed">
                Empowering professionals to find their dream careers through intelligent job search technology.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-white font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                {["Features", "Pricing", "Analytics", "Integrations"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[#ffffff80] hover:text-[#1dff00] transition-colors duration-300">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                {["About", "Careers", "Blog", "Contact"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[#ffffff80] hover:text-[#1dff00] transition-colors duration-300">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="text-white font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                {["Help Center", "Documentation", "API", "Status"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[#ffffff80] hover:text-[#1dff00] transition-colors duration-300">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-[#ffffff15] pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-[#ffffff60] text-sm">
              © 2025 JobRaker. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              {["Privacy", "Terms", "Cookies"].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="text-[#ffffff60] hover:text-[#1dff00] text-sm transition-colors duration-300"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};