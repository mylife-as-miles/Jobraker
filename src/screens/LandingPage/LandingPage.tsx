import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BarChart3, MessageSquare, FileText, Briefcase, Users, TrendingUp, Target, Shield, Globe, Zap, Sparkles, ArrowRight, Play, Quote, Star, CheckCircle, Award, Clock, Brain, Rocket, Heart, Menu, X, Bot, Search, Send, Radiation as Automation, Settings, Activity } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useState } from "react";
import { 
  useScrollReveal, 
  useParallaxEffect, 
  useCounterAnimation, 
  useStaggerAnimation,
  useTextReveal
} from "../../hooks/useGSAPAnimations";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

export const LandingPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP Animations
  useScrollReveal(".reveal-element");
  useParallaxEffect(".parallax-bg", 0.3);
  useCounterAnimation(".counter-50000", 50000);
  useCounterAnimation(".counter-95", 95);
  useCounterAnimation(".counter-1200", 1200);
  useCounterAnimation(".counter-7", 7);
  useStaggerAnimation(".stagger-item", 0.15);
  useTextReveal(".text-reveal");

  useEffect(() => {
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';
    
    const ctx = gsap.context(() => {
      // Hero section animations
      const heroTl = gsap.timeline();
      
      heroTl.fromTo(".hero-title", {
        y: 100,
        opacity: 0,
        scale: 0.8,
      }, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: "power3.out",
      })
      .fromTo(".hero-subtitle", {
        y: 50,
        opacity: 0,
      }, {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power2.out",
      }, "-=0.8")
      .fromTo(".hero-buttons", {
        y: 30,
        opacity: 0,
      }, {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power2.out",
      }, "-=0.6")
      .fromTo(".hero-dashboard", {
        x: 100,
        opacity: 0,
        rotationY: 20,
        scale: 0.8,
      }, {
        x: 0,
        opacity: 1,
        rotationY: 0,
        scale: 1,
        duration: 1.5,
        ease: "power3.out",
      }, "-=1");

      // Floating background elements
      gsap.to(".floating-bg-1", {
        y: -30,
        x: 20,
        rotation: 10,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
      });

      gsap.to(".floating-bg-2", {
        y: 20,
        x: -15,
        rotation: -5,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        delay: 1,
      });

      gsap.to(".floating-bg-3", {
        y: -15,
        x: 10,
        rotation: 8,
        duration: 10,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        delay: 2,
      });

      // Navigation scroll effect
      ScrollTrigger.create({
        trigger: "body",
        start: "top -80",
        end: "bottom bottom",
        onUpdate: (self) => {
          if (self.direction === 1) {
            gsap.to(".navbar", {
              y: -100,
              duration: 0.3,
              ease: "power2.out",
            });
          } else {
            gsap.to(".navbar", {
              y: 0,
              duration: 0.3,
              ease: "power2.out",
            });
          }
        },
      });

      // Features section reveal
      gsap.fromTo(".feature-card", {
        y: 100,
        opacity: 0,
        scale: 0.8,
        rotationX: 45,
      }, {
        y: 0,
        opacity: 1,
        scale: 1,
        rotationX: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".features-section",
          start: "top 70%",
          toggleActions: "play none none reverse",
        }
      });

      // Benefits section with morphing effect
      gsap.fromTo(".benefit-item", {
        x: -100,
        opacity: 0,
        scale: 0.8,
      }, {
        x: 0,
        opacity: 1,
        scale: 1,
        duration: 1.2,
        stagger: 0.3,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: ".benefits-section",
          start: "top 75%",
          toggleActions: "play none none reverse",
        }
      });

      // Testimonials carousel effect
      gsap.fromTo(".testimonial-card", {
        y: 80,
        opacity: 0,
        rotationY: 45,
        scale: 0.9,
      }, {
        y: 0,
        opacity: 1,
        rotationY: 0,
        scale: 1,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".testimonials-section",
          start: "top 70%",
          toggleActions: "play none none reverse",
        }
      });

      // Pricing cards with 3D effect
      gsap.fromTo(".pricing-card", {
        y: 100,
        opacity: 0,
        rotationX: 60,
        transformOrigin: "center bottom",
      }, {
        y: 0,
        opacity: 1,
        rotationX: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".pricing-section",
          start: "top 70%",
          toggleActions: "play none none reverse",
        }
      });

      // Stats counter animation with morphing background
      gsap.fromTo(".stats-section", {
        backgroundColor: "rgba(10, 10, 10, 0)",
      }, {
        backgroundColor: "rgba(10, 10, 10, 1)",
        duration: 1,
        scrollTrigger: {
          trigger: ".stats-section",
          start: "top 80%",
          end: "bottom 20%",
          scrub: true,
        }
      });

      // Newsletter section with wave effect
      gsap.fromTo(".newsletter-section", {
        y: 50,
        opacity: 0,
      }, {
        y: 0,
        opacity: 1,
        duration: 1.5,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".newsletter-section",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      });

      // CTA section with pulsing effect
      gsap.fromTo(".cta-section", {
        scale: 0.9,
        opacity: 0,
      }, {
        scale: 1,
        opacity: 1,
        duration: 1.5,
        ease: "elastic.out(1, 0.5)",
        scrollTrigger: {
          trigger: ".cta-section",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      });

      // Continuous pulsing animation for CTA
      gsap.to(".cta-pulse", {
        scale: 1.05,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
      });

      // Mouse follower effect
      const cursor = document.createElement('div');
      cursor.className = 'custom-cursor';
      cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        background: linear-gradient(45deg, #1dff00, #0a8246);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        mix-blend-mode: difference;
        transition: transform 0.1s ease;
      `;
      document.body.appendChild(cursor);

      const moveCursor = (e: MouseEvent) => {
        gsap.to(cursor, {
          x: e.clientX - 10,
          y: e.clientY - 10,
          duration: 0.1,
          ease: "power2.out",
        });
      };

      document.addEventListener('mousemove', moveCursor);

      return () => {
        document.removeEventListener('mousemove', moveCursor);
        document.body.removeChild(cursor);
      };
    }, containerRef);
    
    return () => {
      ctx.revert();
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  const features = [
    {
      icon: <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Autonomous Job Search",
      description: "Our AI continuously scans thousands of job boards and company websites to find opportunities that match your profile 24/7.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <Send className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Auto-Apply Technology",
      description: "Automatically submit tailored applications to relevant positions while you sleep. No manual work required.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Dynamic Resume Optimization",
      description: "AI automatically customizes your resume for each application, optimizing keywords and formatting for maximum ATS compatibility.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Smart Analytics Dashboard",
      description: "Track application success rates, response times, and optimize your job search strategy with real-time insights.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Intelligent Filtering",
      description: "Advanced AI filters ensure applications only go to legitimate, high-quality positions that match your criteria.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    },
    {
      icon: <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Real-Time Monitoring",
      description: "Get instant notifications about application status, interview requests, and new opportunities as they happen.",
      gradient: "from-[#1dff00]/20 to-[#0a8246]/20"
    }
  ];

  const benefits = [
    {
      icon: <Target className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00]" />,
      title: "10x More Applications",
      description: "Apply to 100+ relevant jobs per week automatically while maintaining quality",
      stat: "10x"
    },
    {
      icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00]" />,
      title: "24/7 Job Hunting",
      description: "Never miss an opportunity - our AI works around the clock",
      stat: "24/7"
    },
    {
      icon: <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00]" />,
      title: "95% Application Accuracy",
      description: "AI ensures each application is perfectly tailored and error-free",
      stat: "95%"
    },
    {
      icon: <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-[#1dff00]" />,
      title: "Zero Manual Work",
      description: "Completely hands-off job search - just set your preferences and relax",
      stat: "0%"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Senior Software Engineer",
      company: "Google",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      content: "JobRaker applied to 200+ jobs for me in just one month. I got 15 interviews and landed my dream job at Google without lifting a finger!",
      rating: 5
    },
    {
      name: "Michael Rodriguez",
      role: "Product Manager",
      company: "Meta",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      content: "The autonomous application system is incredible. While I was working my current job, JobRaker was secretly applying to better positions. Now I'm at Meta!",
      rating: 5
    },
    {
      name: "Emily Johnson",
      role: "UX Designer",
      company: "Apple",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      content: "I was skeptical about automated job applications, but JobRaker's AI is so smart. Every application was perfectly tailored. Got hired at Apple in 3 weeks!",
      rating: 5
    }
  ];

  const stats = [
    { number: "50,000+", label: "Jobs Applied Daily", icon: <Send className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { number: "95%", label: "Application Success Rate", icon: <Target className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { number: "1,200+", label: "Partner Job Boards", icon: <Globe className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { number: "7 Days", label: "Avg. Time to Interview", icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5" /> }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "$29",
      period: "per month",
      description: "Perfect for active job seekers",
      features: [
        "Up to 50 applications/week",
        "Basic resume optimization",
        "Email notifications",
        "Standard job board access",
        "Application tracking"
      ],
      cta: "Start Free Trial",
      popular: false
    },
    {
      name: "Professional",
      price: "$59",
      period: "per month",
      description: "For serious career changers",
      features: [
        "Unlimited applications",
        "Advanced AI resume tailoring",
        "Premium job board access",
        "Real-time notifications",
        "Interview scheduling assistance",
        "Salary negotiation insights",
        "Priority support"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Executive",
      price: "$99",
      period: "per month",
      description: "For senior-level positions",
      features: [
        "Everything in Professional",
        "Executive job board access",
        "Personal career consultant",
        "Custom application strategies",
        "LinkedIn optimization",
        "Reference management",
        "White-glove service"
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
    <div ref={containerRef} className="min-h-screen bg-black overflow-hidden">
      {/* Navigation */}
      <nav className="navbar fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-[#ffffff1a]">
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
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg sm:text-xl lg:text-2xl">JobRaker</span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => scrollToSection(featuresRef)}
                className="text-[#ffffff80] hover:text-white transition-colors text-sm lg:text-base"
              >
                How It Works
              </button>
              <button className="text-[#ffffff80] hover:text-white transition-colors text-sm lg:text-base">
                Pricing
              </button>
              <button className="text-[#ffffff80] hover:text-white transition-colors text-sm lg:text-base">
                Success Stories
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
                Start Auto-Applying
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
                  How It Works
                </button>
                <button className="text-[#ffffff80] hover:text-white transition-colors text-left">
                  Pricing
                </button>
                <button className="text-[#ffffff80] hover:text-white transition-colors text-left">
                  Success Stories
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
                    Start Auto-Applying
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
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="floating-bg-1 parallax-bg absolute top-20 left-10 w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-3xl" />
          <div className="floating-bg-2 parallax-bg absolute top-40 right-20 w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-3xl" />
          <div className="floating-bg-3 parallax-bg absolute bottom-20 left-1/3 w-40 h-40 sm:w-56 sm:h-56 lg:w-72 lg:h-72 bg-gradient-to-r from-[#1dff00]/15 to-[#0a8246]/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Hero Content */}
            <div className="text-center lg:text-left">
              <div className="hero-title mb-6 sm:mb-8">
                <div className="inline-flex items-center px-3 py-1 sm:px-4 sm:py-2 bg-[#1dff00]/10 border border-[#1dff00]/30 rounded-full text-[#1dff00] text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                  <Bot className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  #1 Autonomous Job Application Platform
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight text-reveal">
                  Your AI
                  <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                    {" "}Job Hunter
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                    Never Sleeps
                  </span>
                </h1>
              </div>
              
              <p className="hero-subtitle text-lg sm:text-xl lg:text-2xl text-[#ffffff80] mb-6 sm:mb-8 lg:mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                The world's first fully autonomous job application platform. Our AI searches, applies, and optimizes your job hunt 24/7 while you focus on what matters most.
              </p>
              
              <div className="hero-buttons flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-8 sm:mb-10">
                <Button
                  size="lg"
                  onClick={() => navigate("/signup")}
                  className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white hover:shadow-2xl transition-all px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold group"
                >
                  Start Auto-Applying Now
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#ffffff30] text-white hover:bg-[#ffffff10] px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg group"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:scale-110 transition-transform" />
                  See It In Action
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-8 text-sm text-[#ffffff60] stagger-item">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-[#1dff00]" />
                  <span>100% automated</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-[#1dff00]" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4 text-[#1dff00]" />
                  <span>No manual work required</span>
                </div>
              </div>
            </div>
            
            {/* Hero Image/Dashboard Preview */}
            <div className="hero-dashboard relative">
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
                      <div className="text-white font-semibold text-sm sm:text-base">Auto-Applications Today</div>
                      <div className="text-[#1dff00] text-xl sm:text-2xl font-bold">47</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                      <div className="bg-[#ffffff0a] p-3 rounded-lg text-center">
                        <div className="text-[#1dff00] text-lg sm:text-xl font-bold">12</div>
                        <div className="text-[#ffffff60] text-xs">Interviews</div>
                      </div>
                      <div className="bg-[#ffffff0a] p-3 rounded-lg text-center">
                        <div className="text-[#1dff00] text-lg sm:text-xl font-bold">95%</div>
                        <div className="text-[#ffffff60] text-xs">Success Rate</div>
                      </div>
                      <div className="bg-[#ffffff0a] p-3 rounded-lg text-center">
                        <div className="text-[#1dff00] text-lg sm:text-xl font-bold">3</div>
                        <div className="text-[#ffffff60] text-xs">Offers</div>
                      </div>
                    </div>
                    
                    <div className="bg-[#ffffff0a] p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm">AI Status</span>
                        <span className="text-[#1dff00] text-xs flex items-center">
                          <div className="w-2 h-2 bg-[#1dff00] rounded-full mr-1 animate-pulse"></div>
                          Active
                        </span>
                      </div>
                      <div className="text-[#ffffff80] text-xs">Currently applying to Software Engineer positions...</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section py-12 sm:py-16 lg:py-20 bg-[#0a0a0a] border-y border-[#ffffff1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center reveal-element">
                <div className="flex items-center justify-center mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-lg flex items-center justify-center text-[#1dff00] mr-2 sm:mr-3">
                    {stat.icon}
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1dff00] mb-1 sm:mb-2">
                  {stat.number}
                </div>
                <div className="text-[#ffffff80] text-xs sm:text-sm lg:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section ref={featuresRef} className="features-section py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20 reveal-element">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 text-reveal">
              How JobRaker
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Works For You
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-[#ffffff80] max-w-3xl mx-auto leading-relaxed">
              Set it up once, then let our AI handle everything. From job discovery to application submission, we've got you covered.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="feature-card bg-[#ffffff0d] backdrop-blur-md border-[#ffffff1a] hover:border-[#1dff00]/50 transition-all duration-300 hover:transform hover:scale-105 group cursor-pointer h-full">
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
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section py-16 sm:py-20 lg:py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="reveal-element">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 sm:mb-8 text-reveal">
                Why Choose
                <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                  {" "}Automation?
                </span>
              </h2>
              <div className="space-y-6 sm:space-y-8">
                {benefits.map((benefit, index) => (
                  <div key={index} className="benefit-item flex items-start space-x-4 sm:space-x-6">
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
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative reveal-element">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-2xl blur-3xl"></div>
                <img
                  src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwxfHxhdXRvbWF0aW9uJTIwcm9ib3R8ZW58MHx8fHx8MTcwNzQ4NzIwMHww&ixlib=rb-4.1.0&q=85"
                  alt="Automation Technology"
                  className="relative w-full h-auto rounded-2xl shadow-2xl border border-[#ffffff1a] parallax-bg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20 reveal-element">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 text-reveal">
              Success Stories from
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Our Users
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-[#ffffff80] max-w-3xl mx-auto leading-relaxed">
              Real people, real results. See how JobRaker's autonomous platform transformed their careers.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="testimonial-card bg-[#ffffff0d] backdrop-blur-md border-[#ffffff1a] hover:border-[#1dff00]/50 transition-all duration-300 h-full">
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
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section py-16 sm:py-20 lg:py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20 reveal-element">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 text-reveal">
              Choose Your
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Automation Level
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-[#ffffff80] max-w-3xl mx-auto leading-relaxed">
              From basic automation to full-service career management. All plans include our core autonomous application technology.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {pricingPlans.map((plan, index) => (
              <Card key={index} className={`pricing-card relative bg-[#ffffff0d] backdrop-blur-md border-[#ffffff1a] transition-all duration-300 h-full ${
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
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="newsletter-section py-16 sm:py-20 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="reveal-element">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 text-reveal">
              Stay Updated with
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Automation Insights
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-[#ffffff80] mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              Get weekly insights on job market automation, AI trends, and career optimization strategies.
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
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="cta-section py-16 sm:py-20 lg:py-24 bg-gradient-to-r from-[#1dff00] to-[#0a8246]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="cta-pulse">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Ready to Automate Your Career?
            </h2>
            <p className="text-lg sm:text-xl text-white/90 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              Join over 50,000 professionals who've automated their job search and landed better positions faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/signup")}
                className="bg-white text-[#0a8246] hover:bg-white/90 transition-all px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold group"
              >
                Start Auto-Applying Today
                <Send className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
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
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-[#ffffff1a] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
            {/* Company Info */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-white font-bold text-lg sm:text-xl">JobRaker</span>
              </div>
              <p className="text-[#ffffff80] text-sm sm:text-base leading-relaxed max-w-md">
                The world's first autonomous job application platform. Our AI searches for jobs and applies automatically, 
                helping professionals land their dream careers without the manual work.
              </p>
            </div>
            
            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Platform</h4>
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-[#ffffff80] hover:text-white transition-colors">Success Stories</a></li>
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
              © 2024 JobRaker. All rights reserved. Automate your career today.
            </p>
            <div className="flex items-center space-x-4 sm:space-x-6">
              <Bot className="w-4 h-4 text-[#1dff00]" />
              <span className="text-[#ffffff60] text-xs sm:text-sm">Powered by autonomous AI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};