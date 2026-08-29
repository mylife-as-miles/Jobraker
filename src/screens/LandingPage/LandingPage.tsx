import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { capturePendingReferralCodeFromSearch } from "../../lib/referralAttribution";
import { captureClientEvent } from "@/lib/analytics";
import Seo from "@/components/seo/Seo";
import { ROUTES } from "@/routes";

import { Button } from "../../components/ui/button";

import { ShimmerText } from "@/components/ui/ShimmerText";

// New Components
import { HeroSection } from "./components/HeroSection";
import { DashboardPreview } from "./components/DashboardPreview";
import { SocialProof } from "./components/SocialProof";
import { BentoGrid as BentoSection } from "./components/BentoGrid"; // Reusing existing BentoGrid
import { IntegrationsSection } from "./components/IntegrationsSection";
import { LargeTestimonial } from "./components/LargeTestimonial";
import { PricingSection } from "./components/PricingSection";
import { TestimonialGridSection } from "./components/TestimonialGridSection";
import { FAQSection } from "./components/FAQSection";
import { CTASection } from "./components/CTASection";
import { FooterSection } from "./components/FooterSection";
import { AnimatedSection } from "./components/AnimatedSection";

export const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    capturePendingReferralCodeFromSearch(location.search || "");
  }, [location.search]);

  const trackLandingCta = (
    ctaId: string,
    destination: string,
    locationLabel: string,
  ) => {
    captureClientEvent("landing_cta_clicked", {
      cta_id: ctaId,
      destination,
      location: locationLabel,
    });
  };

  const [showCookieConsent, setShowCookieConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      const timer = setTimeout(() => setShowCookieConsent(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookieConsent", "accepted");
    captureClientEvent("cookie_consent_accepted", {});
    setShowCookieConsent(false);
  };

  const declineCookies = () => {
    localStorage.setItem("cookieConsent", "declined");
    captureClientEvent("cookie_consent_declined", {});
    setShowCookieConsent(false);
  };

  return (
    <div className='min-h-screen bg-background text-foreground font-mono selection:bg-brand selection:text-black overflow-x-hidden'>
      <Seo
        title='Beat the ATS & Land 3x More Interviews | JobRaker'
        description="Stop sending generic resumes. JobRaker's career AI custom-tailors your resume, drafts high-converting cover letters, and auto-applies to jobs on autopilot. Get hired 3x faster today."
        path='/'
      />
      {/* Navigation */}
      <nav className='fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-brand/20'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16 sm:h-20'>
            <div
              className='flex items-center space-x-2 cursor-pointer'
              onClick={() => window.scrollTo(0, 0)}
            >
              <div className='w-8 h-8 rounded overflow-clip'>
                <img
                  src='/logo/logo.jpeg'
                  alt='logo'
                  className='object-cover'
                />
              </div>
              <ShimmerText className='font-bold text-xl tracking-tighter'>
                JOBRAKER
              </ShimmerText>
            </div>

            <div className='flex items-center space-x-4'>
              <Button
                variant='ghost'
                onClick={() => {
                  trackLandingCta("nav_login", ROUTES.SIGNIN, "nav");
                  navigate(ROUTES.SIGNIN);
                }}
                className='text-gray-400 hover:text-brand hover:bg-transparent'
              >
                LOGIN
              </Button>
             
            </div>
          </div>
        </div>
      </nav>

      <div className='relative z-10'>
        <main className='mx-auto relative min-h-[60vh]'>
          {/* 1. Hero Section (New 3D Earth) */}
          <HeroSection />
        </main>

        {/* 2. Social Proof */}
        <AnimatedSection
          className='relative z-10 max-w-[1320px] mx-auto px-3 sm:px-6 lg:px-8 mt-10 md:mt-20'
          delay={0.1}
        >
          <SocialProof />
        </AnimatedSection>

        {/* 3. Features (Bento) - "Everything you need to dominate..." */}
        <AnimatedSection
          id='features-section'
          className='relative z-10 max-w-[1320px] mx-auto mt-12 sm:mt-16 md:mt-20'
          delay={0.2}
        >
          <BentoSection />
        </AnimatedSection>

        {/* 4. Dashboard Preview - "Everything in your control" - Moved after Bento */}
        <AnimatedSection
          className='relative z-20 w-full bg-background/50 mt-12 sm:mt-16 md:mt-20'
          delay={0.1}
        >
          <DashboardPreview />
        </AnimatedSection>

        {/* 5. Integrations */}
        <AnimatedSection
          id='integrations-section'
          className='relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16'
          delay={0.2}
        >
          <IntegrationsSection />
        </AnimatedSection>

        {/* 6. Large Testimonial */}
        <AnimatedSection
          className='relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16'
          delay={0.2}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <LargeTestimonial />
        </AnimatedSection>

        {/* 7. Pricing */}
        <AnimatedSection
          id='pricing-section'
          className='relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16'
          delay={0.2}
        >
          <PricingSection />
        </AnimatedSection>

        {/* 8. Testimonials Grid */}
        <AnimatedSection
          id='testimonials-section'
          className='relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16'
          delay={0.2}
        >
          <TestimonialGridSection />
        </AnimatedSection>

        {/* 9. FAQ */}
        <AnimatedSection
          id='faq-section'
          className='relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16'
          delay={0.2}
        >
          <FAQSection />
        </AnimatedSection>

        {/* 10. CTA */}
        <AnimatedSection
          className='relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16'
          delay={0.2}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <CTASection />
        </AnimatedSection>

        {/* 11. Footer */}
        <AnimatedSection
          className='relative z-10 max-w-[1320px] mx-auto mt-8 sm:mt-12 md:mt-16'
          delay={0.2}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <FooterSection />
        </AnimatedSection>
      </div>

      {/* Cookie Consent Popup */}
      {showCookieConsent && (
        <div
          className='fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 md:max-w-md md:left-auto md:right-6 z-50 animate-slide-up'
          role='dialog'
          aria-label='Cookie consent'
        >
          <div className='bg-background border border-brand/20 rounded-xl p-4 sm:p-5 shadow-2xl'>
            <div className='flex items-start space-x-3'>
              <div className='flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center'>
                <svg className='w-4 h-4 text-brand' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
                </svg>
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium text-foreground'>
                  We use cookies to improve your experience
                </p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  By clicking "Accept", you agree to store cookies on your device to enhance site navigation, analyze usage.
                </p>
              </div>
            </div>
            <div className='mt-4 flex items-center space-x-2 sm:justify-end'>
              <Button
                variant='ghost'
                size='sm'
                onClick={declineCookies}
                className='text-sm text-muted-foreground hover:text-foreground'
              >
                Decline
              </Button>
              <Button
                size='sm'
                onClick={acceptCookies}
                className='bg-brand text-black hover:bg-brand/90'
              >
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
