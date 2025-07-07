import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { 
  Bot, 
  Send, 
  Target, 
  Clock, 
  Shield, 
  Zap, 
  ArrowRight, 
  Play, 
  Quote, 
  Star, 
  CheckCircle, 
  Menu, 
  X, 
  ChevronDown,
  Users,
  TrendingUp,
  Globe,
  Activity,
  Sparkles,
  Heart,
  FileText,
  BarChart3,
  Settings
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useState } from "react";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

export const LandingPage = (): JSX.Element => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const parallaxOffset = scrollY * 0.5;
  const zoomScale = 1 + scrollY * 0.0002;

  useEffect(() => {
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';
    
    const ctx = gsap.context(() => {
      // Hero section animations
      const heroTl = gsap.timeline();
      
      heroTl.fromTo(".hero-badge", {
        y: 30,
        opacity: 0,
        scale: 0.8,
      }, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.8,
        ease: "back.out(1.7)",
      })
      .fromTo(".hero-title", {
        y: 100,
        opacity: 0,
        scale: 0.9,
      }, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: "power3.out",
      }, "-=0.6")
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
      .fromTo(".hero-trust", {
        y: 20,
        opacity: 0,
      }, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power2.out",
      }, "-=0.4");

      // Floating background elements
      gsap.to(".floating-bg-1", {
        y: -30,
        x: 20,
        rotation: 10,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
      });

      gsap.to(".floating-bg-2", {
        y: 20,
        x: -15,
        rotation: -5,
        duration: 10,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        delay: 2,
      });

      gsap.to(".floating-bg-3", {
        y: -15,
        x: 10,
        rotation: 8,
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        delay: 4,
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

      // Stats counter animation
      gsap.utils.toArray(".counter").forEach((counter: any) => {
        const endValue = parseInt(counter.dataset.count);
        const obj = { value: 0 };
        
        gsap.to(obj, {
          value: endValue,
          duration: 2,
          ease: "power2.out",
          onUpdate: () => {
            counter.textContent = Math.round(obj.value).toLocaleString();
          },
          scrollTrigger: {
            trigger: counter,
            start: "top 80%",
            toggleActions: "play none none reverse"
          }
        });
      });

      // Testimonials reveal
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

      // Blog cards animation
      gsap.fromTo(".blog-card", {
        y: 60,
        opacity: 0,
        scale: 0.9,
      }, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.8,
        stagger: 0.15,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".blog-section",
          start: "top 75%",
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
        scale: 1.02,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
      });

    }, containerRef);
    
    return () => {
      ctx.revert();
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  const features = [
    {
      icon: <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Autonomous Job Discovery",
      description: "AI continuously scans thousands of job boards and company websites to find opportunities that match your profile 24/7."
    },
    {
      icon: <Send className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Intelligent Auto-Apply",
      description: "Automatically submit tailored applications to relevant positions while you sleep. No manual work required."
    },
    {
      icon: <Target className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Smart Targeting",
      description: "Advanced AI filters ensure applications only go to legitimate, high-quality positions that match your criteria."
    },
    {
      icon: <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-[#1dff00]" />,
      title: "Quality Assurance",
      description: "Every application is reviewed by AI for accuracy, relevance, and professional presentation before submission."
    }
  ];

  const stats = [
    { number: "50000", label: "Jobs Applied Daily", suffix: "+" },
    { number: "95", label: "Application Success Rate", suffix: "%" },
    { number: "1200", label: "Partner Job Boards", suffix: "+" },
    { number: "7", label: "Avg. Days to Interview", suffix: "" }
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
      content: "The autonomous application system is incredible. While I was working my current job, JobRaker was secretly applying to better positions.",
      rating: 5
    },
    {
      name: "Emily Johnson",
      role: "UX Designer",
      company: "Apple", 
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      content: "I was skeptical about automated job applications, but JobRaker's AI is so smart. Every application was perfectly tailored.",
      rating: 5
    }
  ];

  const blogPosts = [
    {
      category: "GUIDE",
      title: "JobRaker is now generally available. Offering free trials for new users.",
      description: "After months of development and testing with beta users, JobRaker is now open to everyone for autonomous job applications.",
      color: "text-blue-400"
    },
    {
      category: "CASE STUDY", 
      title: "How Sarah Landed Her Dream Job in 2 Weeks Using JobRaker",
      description: "A detailed case study of how one professional accelerated her job search using autonomous applications.",
      color: "text-green-400"
    },
    {
      category: "RESEARCH",
      title: "The Future of Job Applications: AI and Automation in 2025", 
      description: "Understanding how AI is transforming the job application process and what it means for job seekers.",
      color: "text-purple-400"
    },
    {
      category: "TIPS",
      title: "Optimizing Your Resume for AI-Powered Job Matching",
      description: "Best practices for structuring your resume to maximize success with automated application systems.",
      color: "text-orange-400"
    }
  ];

  const companyLogos = [
    "TechCorp", "InnovateLabs", "FutureWorks", "NextGen", "ProTech", "DataFlow"
  ];

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Email submitted:", email);
    setEmail("");
  };

  const scrollToSection = (sectionRef: React.RefObject<HTMLDivElement>) => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Navigation */}
      <nav className="navbar fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <motion.div 
              className="flex items-center space-x-2 sm:space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-gray-900 font-bold text-lg sm:text-xl lg:text-2xl">Jobraker</span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => scrollToSection(featuresRef)}
                className="text-gray-700 hover:text-gray-900 transition-colors text-sm lg:text-base font-medium"
              >
                Features
              </button>
              <button className="text-gray-700 hover:text-gray-900 transition-colors text-sm lg:text-base font-medium">
                Pricing
              </button>
              <button className="text-gray-700 hover:text-gray-900 transition-colors text-sm lg:text-base font-medium">
                Blog
              </button>
              <button className="text-gray-700 hover:text-gray-900 transition-colors text-sm lg:text-base font-medium">
                Contact
              </button>
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
              <Button
                variant="outline"
                onClick={() => navigate("/signup")}
                className="text-gray-700 border-gray-300 hover:bg-gray-50 transition-colors text-sm lg:text-base"
              >
                Watch Demo
              </Button>
              <Button
                onClick={() => navigate("/signup")}
                className="bg-gray-900 text-white hover:bg-gray-800 transition-all text-sm lg:text-base px-4 lg:px-6"
              >
                Get Started
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-gray-900"
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
              className="md:hidden border-t border-gray-200 py-4"
            >
              <div className="flex flex-col space-y-4">
                <button className="text-gray-700 hover:text-gray-900 transition-colors text-left">
                  Features
                </button>
                <button className="text-gray-700 hover:text-gray-900 transition-colors text-left">
                  Pricing
                </button>
                <button className="text-gray-700 hover:text-gray-900 transition-colors text-left">
                  Blog
                </button>
                <button className="text-gray-700 hover:text-gray-900 transition-colors text-left">
                  Contact
                </button>
                <div className="flex flex-col space-y-2 pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/signup")}
                    className="text-gray-700 border-gray-300 hover:bg-gray-50 justify-start"
                  >
                    Watch Demo
                  </Button>
                  <Button
                    onClick={() => navigate("/signup")}
                    className="bg-gray-900 text-white hover:bg-gray-800 justify-start"
                  >
                    Get Started
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20">
        {/* Parallax Background */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1451187580459-43490279c0fa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwxfHxzcGFjZSUyMHRlY2hub2xvZ3l8ZW58MHx8fHx8MTcwNzQ4NzIwMHww&ixlib=rb-4.1.0&q=85)`,
            transform: `translateY(${parallaxOffset}px) scale(${zoomScale})`,
            transformOrigin: 'center center'
          }}
        />
        <div className="absolute inset-0 bg-black/20" />

        {/* Floating background elements */}
        <div className="absolute inset-0">
          <div className="floating-bg-1 absolute top-20 left-10 w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl" />
          <div className="floating-bg-2 absolute top-40 right-20 w-48 h-48 sm:w-64 sm:h-64 lg:w-80 lg:h-80 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-full blur-3xl" />
          <div className="floating-bg-3 absolute bottom-20 left-1/3 w-40 h-40 sm:w-56 sm:h-56 lg:w-72 lg:h-72 bg-gradient-to-r from-purple-500/15 to-pink-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className="hero-badge mb-6 inline-block px-4 py-2 bg-green-500/20 rounded-full border border-green-400/30">
            <span className="text-green-300 text-sm font-medium">🚀 Now available! Autonomous job applications</span>
          </div>
          
          <h1 className="hero-title text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            The autonomous platform to find, apply, and secure your dream job
          </h1>
          
          <p className="hero-subtitle text-lg sm:text-xl md:text-2xl mb-8 text-gray-200 max-w-3xl mx-auto leading-relaxed">
            Let AI search for jobs and automatically apply for them while you focus on what matters most - preparing for interviews and advancing your career.
          </p>
          
          <div className="hero-buttons flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button 
              size="lg" 
              onClick={() => navigate("/signup")}
              className="bg-white text-gray-900 hover:bg-gray-100 px-8 py-4 text-lg font-semibold"
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-white text-white hover:bg-white/10 px-8 py-4 text-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Watch Demo
            </Button>
          </div>
          
          <div className="hero-trust">
            <p className="text-sm text-gray-300 mb-4">TRUSTED BY</p>
            <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 opacity-70">
              {companyLogos.map((logo, index) => (
                <div key={index} className="text-white font-semibold text-sm sm:text-base">
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" ref={featuresRef} className="features-section py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              For ambitious professionals and career-focused individuals
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Jobraker is the end-to-end platform for professionals who want to accelerate their career growth through intelligent automation.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <div key={index} className="feature-card text-center p-6 sm:p-8 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 hover:scale-105">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Precisely engineered for unparalleled success
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Jobraker powers the career growth of ambitious professionals with unmatched performance and reliability.
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
                  <span className="counter" data-count={stat.number}>0</span>
                  {stat.suffix}
                </div>
                <div className="text-gray-400 mb-2 text-sm sm:text-base">{stat.label}</div>
                <div className="text-xs sm:text-sm text-gray-500">Built for limitless processing power</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Powering career growth for professionals worldwide
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              From ambitious graduates to seasoned executives, Jobraker helps professionals at every level find and secure their next opportunity.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="testimonial-card bg-white border border-gray-200 hover:shadow-lg transition-all duration-300 h-full">
                <CardContent className="p-6 sm:p-8 h-full flex flex-col">
                  <div className="flex items-center mb-4 sm:mb-6">
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full mr-3 sm:mr-4 border-2 border-blue-500"
                    />
                    <div>
                      <h4 className="text-gray-900 font-bold text-sm sm:text-base">{testimonial.name}</h4>
                      <p className="text-gray-600 text-xs sm:text-sm">{testimonial.role} at {testimonial.company}</p>
                    </div>
                  </div>
                  <Quote className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500 mb-3 sm:mb-4" />
                  <p className="text-gray-700 leading-relaxed flex-grow text-sm sm:text-base mb-4">{testimonial.content}</p>
                  <div className="flex text-yellow-400">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex justify-center items-center space-x-8 sm:space-x-12 opacity-60">
            {companyLogos.slice(0, 5).map((logo, index) => (
              <div key={index} className="text-xl sm:text-2xl font-bold text-gray-400">
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="blog-section py-16 sm:py-20 lg:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">Career Resources</h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Find the knowledge to accelerate your career growth and unlock new opportunities across guides, insights, and expert advice.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {blogPosts.map((post, index) => (
              <div key={index} className="blog-card bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 cursor-pointer">
                <div className={`text-sm font-medium mb-2 ${post.color}`}>{post.category}</div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 leading-tight">
                  {post.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {post.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="cta-section py-16 sm:py-20 lg:py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="cta-pulse">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Transform Your Career?
            </h2>
            <p className="text-lg sm:text-xl text-white/90 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
              Join thousands of professionals who've automated their job search and landed better positions faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/signup")}
                className="bg-white text-blue-600 hover:bg-gray-100 transition-all px-8 py-4 text-lg font-bold"
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8 py-4 text-lg"
              >
                Schedule Demo
              </Button>
            </div>
            <p className="text-white/70 text-sm mt-6">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 mb-8 sm:mb-12">
            {/* Company Info */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-bold text-xl">Jobraker</span>
              </div>
              <p className="text-gray-400 mb-6 max-w-md leading-relaxed">
                The autonomous platform for intelligent job applications. Let AI handle your job search while you focus on what matters most.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">Twitter</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">LinkedIn</a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">GitHub</a>
              </div>
            </div>
            
            {/* Product Links */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              </ul>
            </div>
            
            {/* Company Links */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Jobraker. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};