import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  MessageSquare, 
  FileText, 
  Briefcase, 
  Users, 
  TrendingUp,
  Target,
  Shield,
  Globe,
  Zap,
  Sparkles,
  ArrowRight,
  Play,
  Quote,
  Star,
  CheckCircle,
  Award,
  Clock,
  Brain,
  Rocket,
  Heart,
  Menu,
  X
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useState } from "react";
import { VeedStyleHero } from "../../components/landing/VeedStyleHero";
import { VeedStyleFeatures } from "../../components/landing/VeedStyleFeatures";
import { VeedStyleHowTo } from "../../components/landing/VeedStyleHowTo";
import { VeedStyleTestimonials } from "../../components/landing/VeedStyleTestimonials";
import { VeedStyleFAQ } from "../../components/landing/VeedStyleFAQ";
import { VeedStyleFooter } from "../../components/landing/VeedStyleFooter";

export const LandingPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';
    
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  const features = [
    {
      icon: <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Smart Analytics",
      description: "Get deep insights into your job search performance with AI-powered analytics and personalized recommendations.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "AI Career Coach",
      description: "24/7 AI assistant that provides personalized career advice, interview prep, and job search strategies.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Smart Resume Builder",
      description: "Create ATS-optimized resumes tailored to specific jobs with our intelligent template system.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Job Tracking",
      description: "Never lose track of applications with automated status updates and deadline reminders.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Network Builder",
      description: "Connect with industry professionals and get referrals through our networking platform.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Career Growth",
      description: "Track your career progression and get personalized growth recommendations.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    }
  ];

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

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Senior Software Engineer",
      company: "Google",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      content: "JobRaker transformed my job search completely. I went from 0 responses to 5 interviews in just 2 weeks. The AI insights were game-changing!",
      rating: 5
    },
    {
      name: "Michael Rodriguez",
      role: "Product Manager",
      company: "Meta",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      content: "The analytics dashboard helped me understand exactly what wasn't working in my applications. Now I'm a PM at Meta!",
      rating: 5
    },
    {
      name: "Emily Johnson",
      role: "UX Designer",
      company: "Apple",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      content: "Best career tool I've ever used. The resume builder and job tracking features are absolutely incredible. Highly recommend!",
      rating: 5
    }
  ];

  const stats = [
    { number: "50,000+", label: "Active Users", icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { number: "89%", label: "Success Rate", icon: <Target className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { number: "1,200+", label: "Partner Companies", icon: <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { number: "12 Days", label: "Avg. Time to Offer", icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5" /> }
  ];

  const pricingPlans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for getting started",
      features: [
        "Track up to 10 applications",
        "Basic resume builder",
        "Email notifications",
        "Community support"
      ],
      cta: "Get Started Free",
      popular: false
    },
    {
      name: "Pro",
      price: "$19",
      period: "per month",
      description: "For serious job seekers",
      features: [
        "Unlimited applications",
        "AI-powered insights",
        "Advanced resume builder",
        "Priority support",
        "Interview preparation",
        "Salary negotiation tools"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      price: "$49",
      period: "per month",
      description: "For teams and organizations",
      features: [
        "Everything in Pro",
        "Team collaboration",
        "Custom integrations",
        "Dedicated support",
        "Advanced analytics",
        "White-label options"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Email submitted:", email);
    setEmail("");
    // Show success message or redirect
  };

  const scrollToSection = (sectionRef: React.RefObject<HTMLDivElement>) => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-[#ffffff1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <motion.div 
              className="flex items-center space-x-2 sm:space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg sm:text-xl lg:text-2xl">JobRaker</span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => scrollToSection(featuresRef)}
                className="text-[#ffffff80] hover:text-white transition-colors text-sm lg:text-base"
              >
                Features
              </button>
              <button className="text-[#ffffff80] hover:text-white transition-colors text-sm lg:text-base">
                Pricing
              </button>
              <button className="text-[#ffffff80] hover:text-white transition-colors text-sm lg:text-base">
                About
              </button>
              <button className="text-[#ffffff80] hover:text-white transition-colors text-sm lg:text-base">
                Contact
              </button>
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/signup")}
                className="text-white hover:text-[#1dff00] transition-colors text-sm lg:text-base"
              >
                Sign In
              </Button>
              <Button
                onClick={() => navigate("/signup")}
                className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white hover:shadow-lg transition-all text-sm lg:text-base px-4 lg:px-6"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-[#ffffff1a] py-4"
            >
              <div className="flex flex-col space-y-4">
                <button className="text-[#ffffff80] hover:text-white transition-colors text-left">
                  Features
                </button>
                <button className="text-[#ffffff80] hover:text-white transition-colors text-left">
                  Pricing
                </button>
                <button className="text-[#ffffff80] hover:text-white transition-colors text-left">
                  About
                </button>
                <button className="text-[#ffffff80] hover:text-white transition-colors text-left">
                  Contact
                </button>
                <div className="flex flex-col space-y-2 pt-4 border-t border-[#ffffff1a]">
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/signup")}
                    className="text-white hover:text-[#1dff00] justify-start"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => navigate("/signup")}
                    className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white justify-start"
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20">
        {/* VEED-Style Hero Section */}
        <VeedStyleHero />
        
        {/* Animated Background */}
        <div className="absolute inset-0">
          <motion.div 
            className="absolute top-20 left-10 w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-3xl"
            animate={{ 
              y: [-20, 20, -20],
              scale: [1, 1.1, 1],
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
          <motion.div 
            className="absolute top-40 right-20 w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-3xl"
            animate={{ 
              y: [20, -20, 20],
              scale: [1.1, 1, 1.1],
            }}
            transition={{ 
              duration: 10, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 2 
            }}
          />
          <motion.div 
            className="absolute bottom-20 left-1/3 w-40 h-40 sm:w-56 sm:h-56 lg:w-72 lg:h-72 bg-gradient-to-r from-[#1dff00]/15 to-[#0a8246]/15 rounded-full blur-3xl"
            animate={{ 
              y: [-15, 15, -15],
              x: [-10, 10, -10],
            }}
            transition={{ 
              duration: 12, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 4 
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Hero Content */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mb-6 sm:mb-8"
              >
                <div className="inline-flex items-center px-3 py-1 sm:px-4 sm:py-2 bg-[#1dff00]/10 border border-[#1dff00]/30 rounded-full text-[#1dff00] text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <Rocket className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  #1 AI-Powered Job Tracker
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight">
                  Land Your
                  <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                    {" "}Dream Job
                  </span>
                  <br />
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent"
                  >
                    3x Faster
                  </motion.span>
                </h1>
              </motion.div>
              
              <motion.p 
                className="text-lg sm:text-xl lg:text-2xl text-[#ffffff80] mb-6 sm:mb-8 lg:mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Join 50,000+ professionals who've transformed their careers with our AI-powered platform. 
                Get organized, stay motivated, and accelerate your job search with intelligent insights.
              </motion.p>
              
              <motion.div 
                className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-8 sm:mb-10"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <Button
                  size="lg"
                  onClick={() => navigate("/signup")}
                  className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white hover:shadow-2xl transition-all px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold group"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#ffffff30] text-white hover:bg-[#ffffff10] px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg group"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Watch Demo
                </Button>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-8 text-sm text-[#ffffff60]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-[#1dff00]" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-[#1dff00]" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-[#1dff00]" />
                  <span>Cancel anytime</span>
                </div>
              </motion.div>
            </div>
            
            {/* Hero Image/Dashboard Preview */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.8, rotateY: 20 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ duration: 1, delay: 0.6 }}
            >
              <div className="relative">
                {/* Glowing border effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-2xl blur-xl opacity-30"></div>
                
                {/* Dashboard mockup */}
                <div className="relative bg-[#0a0a0a] border border-[#ffffff1a] rounded-2xl p-4 sm:p-6 shadow-2xl">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Mock dashboard content */}
                    <div className="flex items-center justify-between">
                      <div className="text-white font-semibold text-sm sm:text-base">Job Applications</div>
                      <div className="text-[#1dff00] text-xl sm:text-2xl font-bold">47</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                      <div className="bg-[#ffffff0a] p-3 rounded-lg text-center">
                        <div className="text-[#1dff00] text-lg sm:text-xl font-bold">12</div>
                        <div className="text-[#ffffff60] text-xs">Interviews</div>
                      </div>
                      <div className="bg-[#ffffff0a] p-3 rounded-lg text-center">
                        <div className="text-[#1dff00] text-lg sm:text-xl font-bold">89%</div>
                        <div className="text-[#ffffff60] text-xs">Match Rate</div>
                      </div>
                      <div className="bg-[#ffffff0a] p-3 rounded-lg text-center">
                        <div className="text-[#1dff00] text-lg sm:text-xl font-bold">3</div>
                        <div className="text-[#ffffff60] text-xs">Offers</div>
                      </div>
                    </div>
                    
                    <div className="h-20 sm:h-24 bg-[#ffffff0a] rounded-lg flex items-end justify-between p-3">
                      {[40, 65, 45, 80, 60, 90, 75].map((height, i) => (
                        <motion.div
                          key={i}
                          className="bg-gradient-to-t from-[#1dff00] to-[#0a8246] rounded-sm"
                          style={{ height: `${height}%`, width: '8px' }}
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: 1 + i * 0.1, duration: 0.5 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-[#0a0a0a] border-y border-[#ffffff1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center justify-center mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-lg flex items-center justify-center text-[#1dff00] mr-2 sm:mr-3">
                    {stat.icon}
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1dff00] mb-1 sm:mb-2">
                  {stat.number}
                </div>
                <div className="text-[#ffffff80] text-xs sm:text-sm lg:text-base">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-16 sm:py-20 lg:py-24">
        {/* VEED-Style Features */}
        <VeedStyleFeatures />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12 sm:mb-16 lg:mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Everything You Need to
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Succeed
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-[#ffffff80] max-w-3xl mx-auto leading-relaxed">
              Our comprehensive suite of AI-powered tools helps you track, optimize, and accelerate your job search journey.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-[#ffffff0d] backdrop-blur-md border-[#ffffff1a] hover:border-[#1dff00]/50 transition-all duration-300 hover:transform hover:scale-105 group cursor-pointer h-full">
                  <CardContent className="p-6 sm:p-8 h-full flex flex-col">
                    <div className="mb-4 sm:mb-6">
                      <div className={`w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r ${feature.gradient} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        {feature.icon}
                      </div>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{feature.title}</h3>
                    <p className="text-[#ffffff80] leading-relaxed flex-grow text-sm sm:text-base">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[#0a0a0a]">
        {/* VEED-Style How To Section */}
        <VeedStyleHowTo />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 sm:mb-8">
                Why Choose
                <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                  {" "}JobRaker?
                </span>
              </h2>
              <div className="space-y-6 sm:space-y-8">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    className="flex items-start space-x-4 sm:space-x-6"
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      {benefit.icon}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold text-white">{benefit.title}</h3>
                        <span className="text-[#1dff00] font-bold text-sm sm:text-base bg-[#1dff00]/10 px-2 py-1 rounded">
                          {benefit.stat}
                        </span>
                      </div>
                      <p className="text-[#ffffff80] text-sm sm:text-base leading-relaxed">{benefit.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
            
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-2xl blur-3xl"></div>
                <img
                  src="https://images.unsplash.com/photo-1551434678-e076c223a692?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxjYXJlZXIlMjBzdWNjZXNzfGVufDB8fHxibHVlfDE3NTE1Nzk5OTl8MA&ixlib=rb-4.1.0&q=85"
                  alt="Career Success"
                  className="relative w-full h-auto rounded-2xl shadow-2xl border border-[#ffffff1a]"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        {/* VEED-Style Testimonials */}
        <VeedStyleTestimonials />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12 sm:mb-16 lg:mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Success Stories from
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Our Users
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-[#ffffff80] max-w-3xl mx-auto leading-relaxed">
              Join thousands of professionals who've transformed their careers with JobRaker.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-[#ffffff0d] backdrop-blur-md border-[#ffffff1a] hover:border-[#1dff00]/50 transition-all duration-300 h-full">
                  <CardContent className="p-6 sm:p-8 h-full flex flex-col">
                    <div className="flex items-center mb-4 sm:mb-6">
                      <img
                        src={testimonial.image}
                        alt={testimonial.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full mr-3 sm:mr-4 border-2 border-[#1dff00]"
                      />
                      <div>
                        <h4 className="text-white font-bold text-sm sm:text-base">{testimonial.name}</h4>
                        <p className="text-[#ffffff80] text-xs sm:text-sm">{testimonial.role} at {testimonial.company}</p>
                      </div>
                    </div>
                    <Quote className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00] mb-3 sm:mb-4" />
                    <p className="text-[#ffffff80] leading-relaxed flex-grow text-sm sm:text-base mb-4">{testimonial.content}</p>
                    <div className="flex text-[#1dff00]">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-12 sm:mb-16 lg:mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Choose Your
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Plan
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-[#ffffff80] max-w-3xl mx-auto leading-relaxed">
              Start free and upgrade as you grow. All plans include our core features.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className={`relative bg-[#ffffff0d] backdrop-blur-md border-[#ffffff1a] transition-all duration-300 h-full ${
                  plan.popular ? 'border-[#1dff00] scale-105' : 'hover:border-[#1dff00]/50'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white px-3 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardContent className="p-6 sm:p-8 h-full flex flex-col">
                    <div className="text-center mb-6 sm:mb-8">
                      <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{plan.name}</h3>
                      <div className="mb-2">
                        <span className="text-3xl sm:text-4xl font-bold text-[#1dff00]">{plan.price}</span>
                        <span className="text-[#ffffff80] text-sm">/{plan.period}</span>
                      </div>
                      <p className="text-[#ffffff80] text-sm">{plan.description}</p>
                    </div>
                    
                    <div className="flex-grow">
                      <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                        {plan.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-center text-sm sm:text-base">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#1dff00] mr-3 flex-shrink-0" />
                            <span className="text-[#ffffff80]">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? 'bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white hover:shadow-lg'
                          : 'border-[#ffffff33] text-white hover:bg-[#ffffff1a]'
                      } transition-all`}
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => navigate("/signup")}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 sm:py-20 lg:py-24">
        {/* VEED-Style FAQ Section */}
        <VeedStyleFAQ />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Stay Updated with
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Career Tips
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-[#ffffff80] mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              Get weekly insights, job market trends, and career advice delivered to your inbox.
            </p>
            
            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-grow bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-12 sm:h-14 text-sm sm:text-base"
                required
              />
              <Button
                type="submit"
                className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white hover:shadow-lg transition-all px-6 sm:px-8 h-12 sm:h-14 text-sm sm:text-base font-medium"
              >
                Subscribe
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
            
            <p className="text-[#ffffff60] text-xs sm:text-sm mt-3 sm:mt-4">
              No spam. Unsubscribe anytime. We respect your privacy.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gradient-to-r from-[#1dff00] to-[#0a8246]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Ready to Transform Your Career?
            </h2>
            <p className="text-lg sm:text-xl text-white/90 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              Join over 50,000 professionals who've already accelerated their career growth with JobRaker.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/signup")}
                className="bg-white text-[#0a8246] hover:bg-white/90 transition-all px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold group"
              >
                Start Your Free Trial
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg"
              >
                Schedule Demo
              </Button>
            </div>
            <p className="text-white/70 text-xs sm:text-sm mt-4 sm:mt-6">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-[#ffffff1a] py-12 sm:py-16">
        {/* VEED-Style Footer */}
        <VeedStyleFooter />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
            {/* Company Info */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-white font-bold text-lg sm:text-xl">JobRaker</span>
              </div>
              <p className="text-[#ffffff80] text-sm sm:text-base leading-relaxed max-w-md">
                The AI-powered platform that helps professionals land their dream jobs 3x faster. 
                Join thousands who've transformed their careers with our intelligent job tracking system.
              </p>
            </div>
            
            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Product</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            {/* Support */}
            <div>
              <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Support</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-[#ffffff1a] pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between">
            <p className="text-[#ffffff60] text-xs sm:text-sm mb-4 sm:mb-0">
              © 2024 JobRaker. All rights reserved. Transform your career today.
            </p>
            <div className="flex items-center space-x-4 sm:space-x-6">
              <Heart className="w-4 h-4 text-[#1dff00]" />
              <span className="text-[#ffffff60] text-xs sm:text-sm">Made with love for job seekers</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};