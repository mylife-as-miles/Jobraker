import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ChevronLeft, ChevronRight, CheckCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../../lib/supabaseClient";

interface OnboardingStep {
  id: number;
  title: string;
  subtitle: string;
  component: React.ReactNode;
}

export const Onboarding = (): JSX.Element => {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    experience: "",
    location: "",
    goals: [] as string[],
  });

  const updateFormData = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleGoal = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }));
  };

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: "Welcome to JobRaker",
      subtitle: "Let's get your profile set up.",
      component: (
        <div className="w-full space-y-3 sm:space-y-4">
          <Input
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => updateFormData("firstName", e.target.value)}
            className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
          />
          <Input
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => updateFormData("lastName", e.target.value)}
            className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
          />
        </div>
      ),
    },
    {
      id: 2,
      title: "Your Professional Details",
      subtitle: "Help us understand your career.",
      component: (
        <div className="w-full space-y-3 sm:space-y-4">
          <Input
            placeholder="Current Job Title"
            value={formData.jobTitle}
            onChange={(e) => updateFormData("jobTitle", e.target.value)}
            className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
          />
          <Input
            placeholder="Years of Experience"
            type="number"
            value={formData.experience}
            onChange={(e) => updateFormData("experience", e.target.value)}
            className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
          />
        </div>
      ),
    },
    {
      id: 3,
      title: "Location",
      subtitle: "Where are you based?",
      component: (
        <Input
          placeholder="City, State, Country"
          value={formData.location}
          onChange={(e) => updateFormData("location", e.target.value)}
          className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
        />
      ),
    },
    {
      id: 4,
      title: "Your Goals",
      subtitle: "What are you looking for?",
      component: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
          {["Find a new job", "Better salary", "Career growth", "Networking"].map((goal) => (
            <Button
              key={goal}
              variant={formData.goals.includes(goal) ? "primary" : "outline"}
              onClick={() => toggleGoal(goal)}
              className={`h-10 sm:h-12 text-xs sm:text-sm transition-all duration-200 ${
                formData.goals.includes(goal)
                  ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                  : "border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]"
              }`}
            >
              {goal}
            </Button>
          ))}
        </div>
      ),
    },
    {
      id: 5,
      title: "All Set!",
      subtitle: "Your profile is ready.",
      component: (
        <div className="text-center space-y-4 sm:space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            <CheckCircle className="mx-auto h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20 text-[#1dff00]" />
          </motion.div>
          <motion.p
            className="text-white text-sm sm:text-base lg:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            You are all set to track your applications!
          </motion.p>
          <motion.div
            className="flex flex-wrap justify-center gap-2 text-xs sm:text-sm text-[#ffffff80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span className="bg-[#ffffff1a] px-2 py-1 rounded">✓ Profile Complete</span>
            <span className="bg-[#ffffff1a] px-2 py-1 rounded">✓ Goals Set</span>
            <span className="bg-[#ffffff1a] px-2 py-1 rounded">✓ Ready to Go</span>
          </motion.div>
        </div>
      )
    }
  ];

  const nextStep = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // If user is not authenticated, send to sign-in route
          navigate('/signIn');
          return;
        }
        // Upsert profile information and mark onboarding complete
        const { error } = await supabase.from('profiles').upsert({
          id: user.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          job_title: formData.jobTitle,
          experience_years: formData.experience ? Number(formData.experience) : null,
          location: formData.location,
          goals: formData.goals,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
        if (error) throw error;
  navigate("/dashboard/overview");
      } catch (err) {
        console.error('Failed to save onboarding:', err);
        alert('Failed to save onboarding info. Please try again.');
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: 0.1,
      },
    },
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      x: -50,
      transition: { duration: 0.3, ease: "easeIn" },
    },
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl">
        {/* Floating background elements */}
        <motion.div
          className="absolute top-4 sm:top-8 left-2 sm:left-4 lg:left-8 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-xl w-8 h-8 sm:w-12 sm:h-12 lg:w-16 lg:h-16"
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-4 sm:bottom-8 right-2 sm:right-4 lg:right-8 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-xl w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20"
          animate={{ y: [10, -10, 10] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        <motion.div
          className="w-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="w-full bg-[#ffffff0d] backdrop-blur-[18px] border border-[#ffffff15] relative overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl">
            {/* Animated border glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 via-transparent to-[#1dff00]/20 opacity-50 animate-pulse rounded-xl sm:rounded-2xl" />
            
            <CardContent className="relative z-10 p-4 sm:p-6 lg:p-8 xl:p-10">
              {/* Header with logo */}
              <div className="flex items-center justify-center mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                  </div>
                  <span className="text-white font-bold text-lg sm:text-xl lg:text-2xl">JobRaker</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex flex-col items-center text-center"
                >
                  {/* Step content */}
                  <div className="mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 sm:mb-3">
                      {steps[currentStep].title}
                    </h2>
                    <p className="text-[#ffffff80] text-sm sm:text-base lg:text-lg">
                      {steps[currentStep].subtitle}
                    </p>
                  </div>
                  
                  {/* Step component */}
                  <div className="w-full mb-6 sm:mb-8">
                    {steps[currentStep].component}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Button 
                  onClick={prevStep} 
                  disabled={currentStep === 0} 
                  variant="ghost"
                  className="w-full sm:w-auto text-white hover:bg-[#ffffff1a] disabled:opacity-50 disabled:cursor-not-allowed h-10 sm:h-12 text-sm sm:text-base order-2 sm:order-1"
                >
                  <ChevronLeft className="mr-1 sm:mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                  Back
                </Button>
                
                <Button 
                  onClick={nextStep}
                  className="w-full sm:w-auto bg-gradient-to-r from-white to-[#f0f0f0] text-black hover:shadow-lg transition-all h-10 sm:h-12 text-sm sm:text-base font-medium order-1 sm:order-2"
                >
                  {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                  <ChevronRight className="ml-1 sm:ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#ffffff20] rounded-full h-2 sm:h-3 mt-4 sm:mt-6 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-white to-[#f0f0f0] h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>

              {/* Step indicator */}
              <div className="flex justify-center mt-3 sm:mt-4 space-x-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                      index <= currentStep ? "bg-[#1dff00]" : "bg-[#ffffff30]"
                    }`}
                  />
                ))}
              </div>

              {/* Step counter */}
              <div className="text-center mt-2 sm:mt-3">
                <span className="text-xs sm:text-sm text-[#ffffff60]">
                  Step {currentStep + 1} of {steps.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};