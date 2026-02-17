import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { Button } from '../../components/ui/button';

// New Components
import { HeroSection } from './components/HeroSection';
import { DashboardPreview } from './components/DashboardPreview';
import { SocialProof } from './components/SocialProof';
import { BentoGrid as BentoSection } from './components/BentoGrid'; // Reusing existing BentoGrid
import { IntegrationsSection } from './components/IntegrationsSection';
import { LargeTestimonial } from './components/LargeTestimonial';
import { PricingSection } from './components/PricingSection';
import { TestimonialGridSection } from './components/TestimonialGridSection';
import { FAQSection } from './components/FAQSection';
import { CTASection } from './components/CTASection';
import { FooterSection } from './components/FooterSection';
import { AnimatedSection } from './components/AnimatedSection';

export const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-[#1dff00] selection:text-black overflow-x-hidden">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-[#1dff00]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
              <div className="w-8 h-8 bg-[#1dff00] rounded flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <span className="text-white font-bold text-xl tracking-tighter">JOBRAKER</span>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/signin')}
                className="text-gray-400 hover:text-[#1dff00] hover:bg-transparent"
              >
                LOGIN
              </Button>
              <Button
                onClick={() => navigate('/signup')}
                className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 font-bold rounded-none"
              >
                GET STARTED
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10">
        <main className="mx-auto relative min-h-[60vh]">
          {/* 1. Hero Section (New 3D Earth) */}
          <HeroSection />
        </main>

        {/* 2. Social Proof */}
        <AnimatedSection
          className="relative z-10 max-w-[1320px] mx-auto px-3 sm:px-6 lg:px-8 mt-10 md:mt-20"
          delay={0.1}
        >
          <SocialProof />
        </AnimatedSection>

        {/* 3. Features (Bento) - "Everything you need to dominate..." */}
        <AnimatedSection
          id="features-section"
          className="relative z-10 max-w-[1320px] mx-auto mt-12 sm:mt-16 md:mt-20"
          delay={0.2}
        >
          <BentoSection />
        </AnimatedSection>

        {/* 4. Dashboard Preview - "Everything in your control" - Moved after Bento */}
        <AnimatedSection
          className="relative z-20 w-full bg-black/50 mt-12 sm:mt-16 md:mt-20"
          delay={0.1}
        >
             <DashboardPreview />
        </AnimatedSection>

        {/* 5. Integrations */}
        <AnimatedSection
          id="integrations-section"
          className="relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16"
          delay={0.2}
        >
          <IntegrationsSection />
        </AnimatedSection>

        {/* 6. Large Testimonial */}
        <AnimatedSection
          className="relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16"
          delay={0.2}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <LargeTestimonial />
        </AnimatedSection>

        {/* 7. Pricing */}
        <AnimatedSection
          id="pricing-section"
          className="relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16"
          delay={0.2}
        >
          <PricingSection />
        </AnimatedSection>

        {/* 8. Testimonials Grid */}
        <AnimatedSection
          id="testimonials-section"
          className="relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16"
          delay={0.2}
        >
          <TestimonialGridSection />
        </AnimatedSection>

        {/* 9. FAQ */}
        <AnimatedSection
          id="faq-section"
          className="relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16"
          delay={0.2}
        >
          <FAQSection />
        </AnimatedSection>

        {/* 10. CTA */}
        <AnimatedSection
          className="relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16"
          delay={0.2}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <CTASection />
        </AnimatedSection>

        {/* 11. Footer */}
        <AnimatedSection
          className="relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16"
          delay={0.2}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <FooterSection />
        </AnimatedSection>
      </div>
    </div>
  );
};
