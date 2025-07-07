import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OnboardingStep {
  id: number;
  title: string;
  subtitle: string;
  component: React.ReactNode;
}

export const Onboarding = (): JSX.Element => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [scalePercentage, setScalePercentage] = useState(80);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    experience: "",
    location: "",
    goals: [] as string[],
  });

  useEffect(() => {
    const calculateScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      let scale = 80;
      if (width < 480) scale = 65;
      else if (width < 640) scale = 70;
      else if (width < 768) scale = 75;
      else if (width < 1024) scale = 80;
      else if (width < 1280) scale = 85;
      else scale = 90;
      if (height < 600) scale -= 10;
      else if (height < 700) scale -= 5;
      scale = Math.max(50, Math.min(95, scale));
      setScalePercentage(scale);
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

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

  const getScaledValue = (baseValue: number) => Math.round(baseValue * (scalePercentage / 100));

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: "Welcome to JobTracker",
      subtitle: "Let's get your profile set up.",
      component: (
        <div className="w-full space-y-4">
          <Input
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => updateFormData("firstName", e.target.value)}
            className="w-full"
          />
          <Input
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => updateFormData("lastName", e.target.value)}
            className="w-full"
          />
        </div>
      ),
    },
    {
      id: 2,
      title: "Your Professional Details",
      subtitle: "Help us understand your career.",
      component: (
        <div className="w-full space-y-4">
          <Input
            placeholder="Current Job Title"
            value={formData.jobTitle}
            onChange={(e) => updateFormData("jobTitle", e.target.value)}
            className="w-full"
          />
          <Input
            placeholder="Years of Experience"
            type="number"
            value={formData.experience}
            onChange={(e) => updateFormData("experience", e.target.value)}
            className="w-full"
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
          className="w-full"
        />
      ),
    },
    {
      id: 4,
      title: "Your Goals",
      subtitle: "What are you looking for?",
      component: (
        <div className="grid grid-cols-2 gap-4">
          {["Find a new job", "Better salary", "Career growth", "Networking"].map((goal) => (
            <Button
              key={goal}
              variant={formData.goals.includes(goal) ? "default" : "outline"}
              onClick={() => toggleGoal(goal)}
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
            <div className="text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <p className="mt-4">You are all set to track your applications!</p>
            </div>
        )
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Finish onboarding
      console.log("Onboarding data:", formData);
      navigate("/dashboard");
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
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
      <motion.div
        className="w-full"
        style={{
          maxWidth: `${getScaledValue(500)}px`,
          transform: `scale(${scalePercentage / 100})`,
          transformOrigin: 'center center',
        }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="w-full bg-[#ffffff0d] backdrop-blur-[18px] border border-[#ffffff15] relative overflow-hidden">
          <CardContent className="relative z-10 p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex flex-col items-center text-center"
              >
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-white">{steps[currentStep].title}</h2>
                  <p className="text-gray-400">{steps[currentStep].subtitle}</p>
                </div>
                <div className="w-full my-8">
                  {steps[currentStep].component}
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="flex justify-between mt-8">
              <Button onClick={prevStep} disabled={currentStep === 0} variant="ghost">
                <ChevronLeft className="mr-2" />
                Back
              </Button>
              <Button onClick={nextStep}>
                {currentStep === steps.length - 1 ? "Finish" : "Next"}
                <ChevronRight className="ml-2" />
              </Button>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
              <motion.div
                className="bg-green-500 h-2.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
