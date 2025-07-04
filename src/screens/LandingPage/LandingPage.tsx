import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
  Star
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ScrollAnimationWrapper } from "../../components/animations/ScrollAnimationWrapper";
import { ParticleBackground } from "../../components/animations/ParticleBackground";
import { MagneticButton } from "../../components/ui/MagneticButton";
import { TypingAnimation } from "../../components/animations/TypingAnimation";

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

export const LandingPage = (): JSX.Element => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const testimonialsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hero section animations
    const heroTimeline = gsap.timeline();
    heroTimeline
      .from(".hero-title", {
        y: 100,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
      })
      .from(".hero-subtitle", {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
      }, "-=0.5")
      .from(".hero-cta", {
        y: 30,
        opacity: 0,
        duration: 0.6,
        ease: "power3.out"
      }, "-=0.3")
      .from(".hero-image", {
        scale: 0.8,
        opacity: 0,
        duration: 1,
        ease: "power3.out"
      }, "-=0.8");

    // Floating elements animation
    gsap.to(".floating-element", {
      y: -20,
      duration: 3,
      ease: "power2.inOut",
      repeat: -1,
      yoyo: true,
      stagger: 0.5
    });

    // Features section scroll animation
    ScrollTrigger.create({
      trigger: featuresRef.current,
      start: "top 80%",
      onEnter: () => {
        gsap.from(".feature-card", {
          y: 50,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.2
        });
      }
    });

    // Benefits section scroll animation
    ScrollTrigger.create({
      trigger: benefitsRef.current,
      start: "top 80%",
      onEnter: () => {
        gsap.from(".benefit-item", {
          x: -50,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15
        });
      }
    });

    // Testimonials scroll animation
    ScrollTrigger.create({
      trigger: testimonialsRef.current,
      start: "top 80%",
      onEnter: () => {
        gsap.from(".testimonial-card", {
          scale: 0.8,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.2
        });
      }
    });

    // CTA section animation
    ScrollTrigger.create({
      trigger: ctaRef.current,
      start: "top 80%",
      onEnter: () => {
        gsap.from(".cta-content", {
          y: 50,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out"
        });
      }
    });

    // Stats counter animation
    ScrollTrigger.create({
      trigger: ".stats-section",
      start: "top 80%",
      onEnter: () => {
        gsap.from(".stat-number", {
          innerHTML: 0,
          duration: 2,
          ease: "power2.out",
          snap: { innerHTML: 1 },
          stagger: 0.1
        });
      }
    });

    return () => {
      ScrollTrigger.killAll();
    };
  }, []);

  const features = [
    {
      icon: <BarChart3 className="w-8 h-8 text-[#1dff00]" />,
      title: "Smart Dashboard",
      description: "Get a comprehensive view of your job search progress with real-time analytics and insights.",
      color: "from-[#1dff00] to-[#0a8246]"
    },
    {
      icon: <MessageSquare className="w-8 h-8 text-[#1dff00]" />,
      title: "AI-Powered Chat",
      description: "Get personalized career advice and job search tips from our intelligent assistant.",
      color: "from-[#1dff00] to-[#0a8246]"
    },
    {
      icon: <FileText className="w-8 h-8 text-[#1dff00]" />,
      title: "Resume Builder",
      description: "Create professional resumes tailored to specific job applications with our smart templates.",
      color: "from-[#1dff00] to-[#0a8246]"
    },
    {
      icon: <Briefcase className="w-8 h-8 text-[#1dff00]" />,
      title: "Job Tracking",
      description: "Organize and track all your job applications in one place with status updates.",
      color: "from-[#1dff00] to-[#0a8246]"
    },
    {
      icon: <Users className="w-8 h-8 text-[#1dff00]" />,
      title: "Application Management",
      description: "Never miss a deadline with automated reminders and application status tracking.",
      color: "from-[#1dff00] to-[#0a8246]"
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-[#1dff00]" />,
      title: "Career Analytics",
      description: "Gain insights into your job search performance and optimize your strategy.",
      color: "from-[#1dff00] to-[#0a8246]"
    }
  ];

  const benefits = [
    {
      icon: <Target className="w-6 h-6 text-[#1dff00]" />,
      title: "Increase Success Rate",
      description: "Users see 3x more interview invitations with our optimized approach"
    },
    {
      icon: <Zap className="w-6 h-6 text-[#1dff00]" />,
      title: "Save Time",
      description: "Automate repetitive tasks and focus on what matters most"
    },
    {
      icon: <Shield className="w-6 h-6 text-[#1dff00]" />,
      title: "Stay Organized",
      description: "Never lose track of an application or miss a deadline again"
    },
    {
      icon: <Globe className="w-6 h-6 text-[#1dff00]" />,
      title: "Global Opportunities",
      description: "Access job opportunities from companies worldwide"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Software Engineer",
      company: "Google",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
      content: "JobRaker transformed my job search. I landed my dream job at Google within 2 months!"
    },
    {
      name: "Michael Chen",
      role: "Product Manager",
      company: "Meta",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      content: "The analytics helped me understand what wasn't working. Now I'm a PM at Meta!"
    },
    {
      name: "Emily Rodriguez",
      role: "UX Designer",
      company: "Apple",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
      content: "Best career tool I've ever used. The resume builder alone is worth it!"
    }
  ];

  const stats = [
    { number: "50000", label: "Job Seekers", suffix: "+" },
    { number: "85", label: "Success Rate", suffix: "%" },
    { number: "1000", label: "Partner Companies", suffix: "+" },
    { number: "15", label: "Average Days to Offer", suffix: "" }
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-black overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-[#ffffff1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-xl">JobRaker</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/signup")}
                className="text-white hover:text-[#1dff00] transition-colors"
              >
                Sign In
              </Button>
              <Button
                onClick={() => navigate("/signup")}
                className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white hover:shadow-lg transition-all"
              >
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Particle Background */}
        <ParticleBackground />
        
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="floating-element absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-3xl"></div>
          <div className="floating-element absolute top-40 right-20 w-48 h-48 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-3xl"></div>
          <div className="floating-element absolute bottom-20 left-1/3 w-40 h-40 bg-gradient-to-r from-[#1dff00]/15 to-[#0a8246]/15 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <motion.h1 
                className="hero-title text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                Land Your
                <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                  {" "}Dream Job
                </span>
                <br />
                <TypingAnimation 
                  texts={["Faster Than Ever", "With AI Power", "Like A Pro"]}
                  className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent"
                  speed={0.15}
                  delay={2}
                />
              </motion.h1>
              
              <motion.p 
                className="hero-subtitle text-xl text-[#ffffff80] mb-8 max-w-2xl"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Join thousands of professionals who've transformed their careers with our AI-powered job tracking platform. 
                Get organized, stay motivated, and land your dream job 3x faster.
              </motion.p>
              
              <motion.div 
                className="hero-cta flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <MagneticButton
                  size="lg"
                  onClick={() => navigate("/signup")}
                  className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] text-white hover:shadow-2xl transition-all px-8 py-4 text-lg"
                  strength={0.4}
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </MagneticButton>
                <MagneticButton
                  size="lg"
                  variant="outline"
                  className="border-[#ffffff30] text-white hover:bg-[#ffffff10] px-8 py-4 text-lg"
                  strength={0.3}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </MagneticButton>
              </motion.div>
            </div>
            
            <div className="relative">
              <motion.div
                className="hero-image"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.6 }}
              >
                <img
                  src="https://images.unsplash.com/photo-1556505619-58f906d76346?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwyfHxqb2IlMjBzZWFyY2glMjB0ZWNobm9sb2d5fGVufDB8fHxibHVlfDE3NTE1Nzk5OTJ8MA&ixlib=rb-4.1.0&q=85"
                  alt="JobRaker Dashboard"
                  className="w-full h-auto rounded-2xl shadow-2xl border border-[#ffffff1a]"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section py-20 bg-[#0a0a0a] border-y border-[#ffffff1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-[#1dff00] mb-2">
                  <span className="stat-number">{stat.number}</span>
                  <span>{stat.suffix}</span>
                </div>
                <div className="text-[#ffffff80] text-sm lg:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimationWrapper animation="fadeInUp" className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Everything You Need to
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Succeed
              </span>
            </h2>
            <p className="text-xl text-[#ffffff80] max-w-3xl mx-auto">
              Our comprehensive suite of tools helps you track, optimize, and accelerate your job search journey.
            </p>
          </ScrollAnimationWrapper>
          
          <ScrollAnimationWrapper animation="stagger" className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="feature-card bg-[#ffffff0d] backdrop-blur-md border-[#ffffff1a] hover:border-[#1dff00]/50 transition-all duration-300 hover:transform hover:scale-105 group cursor-pointer"
              >
                <CardContent className="p-8">
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      {feature.icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-[#ffffff80] leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* Benefits Section */}
      <section ref={benefitsRef} className="py-20 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <ScrollAnimationWrapper animation="fadeInLeft">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                Why Choose
                <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                  {" "}JobRaker?
                </span>
              </h2>
              <div className="space-y-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="benefit-item flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      {benefit.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{benefit.title}</h3>
                      <p className="text-[#ffffff80]">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollAnimationWrapper>
            <ScrollAnimationWrapper animation="fadeInRight" className="relative">
              <img
                src="https://images.unsplash.com/photo-1555212697-194d092e3b8f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwyfHxjYXJlZXIlMjBzdWNjZXNzfGVufDB8fHxibHVlfDE3NTE1Nzk5OTl8MA&ixlib=rb-4.1.0&q=85"
                alt="Career Success"
                className="w-full h-auto rounded-2xl shadow-2xl border border-[#ffffff1a]"
              />
            </ScrollAnimationWrapper>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section ref={testimonialsRef} className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimationWrapper animation="fadeInUp" className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Success Stories from
              <span className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] bg-clip-text text-transparent">
                {" "}Our Users
              </span>
            </h2>
            <p className="text-xl text-[#ffffff80] max-w-3xl mx-auto">
              Join thousands of professionals who've transformed their careers with JobRaker.
            </p>
          </ScrollAnimationWrapper>
          
          <ScrollAnimationWrapper animation="stagger" className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="testimonial-card bg-[#ffffff0d] backdrop-blur-md border-[#ffffff1a] hover:border-[#1dff00]/50 transition-all duration-300"
              >
                <CardContent className="p-8">
                  <div className="flex items-center mb-6">
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full mr-4 border-2 border-[#1dff00]"
                    />
                    <div>
                      <h4 className="text-white font-bold">{testimonial.name}</h4>
                      <p className="text-[#ffffff80] text-sm">{testimonial.role} at {testimonial.company}</p>
                    </div>
                  </div>
                  <Quote className="w-8 h-8 text-[#1dff00] mb-4" />
                  <p className="text-[#ffffff80] leading-relaxed">{testimonial.content}</p>
                  <div className="flex text-[#1dff00] mt-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* Final CTA Section */}
      <section ref={ctaRef} className="py-20 bg-gradient-to-r from-[#1dff00] to-[#0a8246]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimationWrapper animation="fadeInUp" className="cta-content">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Career?
            </h2>
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Join over 50,000 professionals who've already accelerated their career growth with JobRaker.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <MagneticButton
                size="lg"
                onClick={() => navigate("/signup")}
                className="bg-white text-[#0a8246] hover:bg-white/90 transition-all px-8 py-4 text-lg font-bold"
                strength={0.4}
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </MagneticButton>
              <MagneticButton
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 px-8 py-4 text-lg"
                strength={0.3}
              >
                Schedule Demo
              </MagneticButton>
            </div>
            <p className="text-white/60 text-sm mt-4">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </ScrollAnimationWrapper>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-[#ffffff1a] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-xl">JobRaker</span>
            </div>
            <p className="text-[#ffffff60] text-sm">
              © 2024 JobRaker. All rights reserved. Transform your career today.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};