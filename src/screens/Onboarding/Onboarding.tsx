import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ChevronLeft, ChevronRight, User, Briefcase, Target, MapPin, Sparkles, CheckCircle } from "lucide-react";
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

  // Dynamic scaling based on screen size and height
  useEffect(() => {
    const calculateScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let scale = 80; // Base scale (20% reduction)
      
      // Enhanced responsive breakpoints
      if (width < 360) {
        scale = 55; // 45% reduction for extra small screens (phones in portrait)
      } else if (width < 480) {
        scale = 60; // 40% reduction for small phones
      } else if (width < 640) {
        scale = 65; // 35% reduction for large phones
      } else if (width < 768) {
        scale = 70; // 30% reduction for small tablets
      } else if (width < 1024) {
        scale = 75; // 25% reduction for tablets
      } else if (width < 1280) {
        scale = 80; // 20% reduction for small laptops
      } else if (width < 1536) {
        scale = 85; // 15% reduction for laptops
      } else {
        scale = 90; // 10% reduction for desktops
      }
      
      // Enhanced height-based adjustments
      if (height < 500) {
        scale -= 15; // Additional 15% reduction for very short screens
      } else if (height < 600) {
        scale -= 10; // Additional 10% reduction for short screens
      } else if (height < 700) {
        scale -= 5; // Additional 5% reduction for medium height screens
      }
      
      // Ensure scale doesn't go below 40% or above 95%
      scale = Math.max(40, Math.min(95, scale));
      
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

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  const floatingVariants = {
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  // Calculate responsive values based on scale percentage
  const getScaledValue = (baseValue: number) => Math.round(baseValue * (scalePercentage / 100));

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: "Welcome to JobRacker",
      subtitle: "Let's get to know you better",
      component: (
        <motion.div
          className="space-y-[9px] sm:space-y-[11px] md:space-y-[12px] lg:space-y-[13px]"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div 
            className="text-center"
            style={{ marginBottom: `${getScaledValue(16)}px` }}
            variants={itemVariants}
          >
            <motion.div
              className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center mx-auto shadow-lg"
              style={{
                width: `${getScaledValue(40)}px`,
                height: `${getScaledValue(40)}px`,
                marginBottom: `${getScaledValue(8)}px`,
              }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <User 
                className="text-white"
                style={{
                  width: `${getScaledValue(20)}px`,
                  height: `${getScaledValue(20)}px`,
                }}
              />
            </motion.div>
            <motion.p
              className="text-[#ffffff80]"
              style={{ 
                fontSize: `${getScaledValue(12)}px`,
                padding: `0 ${getScaledValue(12)}px`,
              }}
              variants={itemVariants}
            >
              Tell us your name to personalize your experience
            </motion.p>
          </motion.div>
          <motion.div 
            className="space-y-[5px] sm:space-y-[7px] md:space-y-[8px] lg:space-y-[9px]" 
            variants={itemVariants}
          >
            <motion.div
              whileFocus={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div 
                className="flex w-full items-center bg-[#ffffff26] border border-solid border-[#ffffff33] hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 backdrop-blur-sm"
                style={{
                  height: `${getScaledValue(48)}px`,
                  gap: `${getScaledValue(8)}px`,
                  padding: `${getScaledValue(12)}px`,
                  borderRadius: `${getScaledValue(8)}px`,
                }}
              >
                <Input
                  className="border-none bg-transparent text-white tracking-[-0.36px] placeholder:text-[#ffffff99] focus-visible:ring-0 p-0 h-auto"
                  style={{ fontSize: `${getScaledValue(14)}px` }}
                  type="text"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) => updateFormData("firstName", e.target.value)}
                />
              </div>
            </motion.div>
            <motion.div
              whileFocus={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div 
                className="flex w-full items-center bg-[#ffffff26] border border-solid border-[#ffffff33] hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 backdrop-blur-sm"
                style={{
                  height: `${getScaledValue(48)}px`,
                  gap: `${getScaledValue(8)}px`,
                  padding: `${getScaledValue(12)}px`,
                  borderRadius: `${getScaledValue(8)}px`,
                }}
              >
                <Input
                  className="border-none bg-transparent text-white tracking-[-0.36px] placeholder:text-[#ffffff99] focus-visible:ring-0 p-0 h-auto"
                  style={{ fontSize: `${getScaledValue(14)}px` }}
                  type="text"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => updateFormData("lastName", e.target.value)}
                />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      ),
    },
    {
      id: 2,
      title: "Tell us about your career",
      subtitle: "Help us personalize your experience",
      component: (
        <motion.div
          className="space-y-[9px] sm:space-y-[11px] md:space-y-[12px] lg:space-y-[13px]"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div 
            className="text-center"
            style={{ marginBottom: `${getScaledValue(16)}px` }}
            variants={itemVariants}
          >
            <motion.div
              className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center mx-auto shadow-lg"
              style={{
                width: `${getScaledValue(40)}px`,
                height: `${getScaledValue(40)}px`,
                marginBottom: `${getScaledValue(8)}px`,
              }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Briefcase 
                className="text-white"
                style={{
                  width: `${getScaledValue(20)}px`,
                  height: `${getScaledValue(20)}px`,
                }}
              />
            </motion.div>
            <motion.p
              className="text-[#ffffff80]"
              style={{ 
                fontSize: `${getScaledValue(12)}px`,
                padding: `0 ${getScaledValue(12)}px`,
              }}
              variants={itemVariants}
            >
              Share your professional background with us
            </motion.p>
          </motion.div>
          <motion.div 
            className="space-y-[5px] sm:space-y-[7px] md:space-y-[8px] lg:space-y-[9px]" 
            variants={itemVariants}
          >
            <motion.div
              whileFocus={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div 
                className="flex w-full items-center bg-[#ffffff26] border border-solid border-[#ffffff33] hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 backdrop-blur-sm"
                style={{
                  height: `${getScaledValue(48)}px`,
                  gap: `${getScaledValue(8)}px`,
                  padding: `${getScaledValue(12)}px`,
                  borderRadius: `${getScaledValue(8)}px`,
                }}
              >
                <Input
                  className="border-none bg-transparent text-white tracking-[-0.36px] placeholder:text-[#ffffff99] focus-visible:ring-0 p-0 h-auto"
                  style={{ fontSize: `${getScaledValue(14)}px` }}
                  type="text"
                  placeholder="Current Job Title"
                  value={formData.jobTitle}
                  onChange={(e) => updateFormData("jobTitle", e.target.value)}
                />
              </div>
            </motion.div>
            <motion.div
              whileFocus={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div 
                className="flex w-full items-center bg-[#ffffff26] border border-solid border-[#ffffff33] hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 backdrop-blur-sm"
                style={{
                  height: `${getScaledValue(48)}px`,
                  gap: `${getScaledValue(8)}px`,
                  padding: `${getScaledValue(12)}px`,
                  borderRadius: `${getScaledValue(8)}px`,
                }}
              >
                <select
                  className="w-full bg-transparent text-white tracking-[-0.36px] focus:outline-none"
                  style={{ fontSize: `${getScaledValue(14)}px` }}
                  value={formData.experience}
                  onChange={(e) => updateFormData("experience", e.target.value)}
                >
                  <option value="" className="bg-gray-800">Years of Experience</option>
                  <option value="0-1" className="bg-gray-800">0-1 years</option>
                  <option value="2-5" className="bg-gray-800">2-5 years</option>
                  <option value="6-10" className="bg-gray-800">6-10 years</option>
                  <option value="10+" className="bg-gray-800">10+ years</option>
                </select>
              </div>
            </motion.div>
            <motion.div
              whileFocus={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div 
                className="flex w-full items-center bg-[#ffffff26] border border-solid border-[#ffffff33] hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 backdrop-blur-sm"
                style={{
                  height: `${getScaledValue(48)}px`,
                  gap: `${getScaledValue(8)}px`,
                  padding: `${getScaledValue(12)}px`,
                  borderRadius: `${getScaledValue(8)}px`,
                }}
              >
                <MapPin 
                  className="text-white flex-shrink-0"
                  style={{
                    width: `${getScaledValue(16)}px`,
                    height: `${getScaledValue(16)}px`,
                  }}
                />
                <Input
                  className="border-none bg-transparent text-white tracking-[-0.36px] placeholder:text-[#ffffff99] focus-visible:ring-0 p-0 h-auto"
                  style={{ fontSize: `${getScaledValue(14)}px` }}
                  type="text"
                  placeholder="Location (City, State)"
                  value={formData.location}
                  onChange={(e) => updateFormData("location", e.target.value)}
                />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      ),
    },
    {
      id: 3,
      title: "What are your goals?",
      subtitle: "Select all that apply to customize your dashboard",
      component: (
        <motion.div
          className="space-y-[9px] sm:space-y-[11px] md:space-y-[12px] lg:space-y-[13px]"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div 
            className="text-center"
            style={{ marginBottom: `${getScaledValue(16)}px` }}
            variants={itemVariants}
          >
            <motion.div
              className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center mx-auto shadow-lg"
              style={{
                width: `${getScaledValue(40)}px`,
                height: `${getScaledValue(40)}px`,
                marginBottom: `${getScaledValue(8)}px`,
              }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Target 
                className="text-white"
                style={{
                  width: `${getScaledValue(20)}px`,
                  height: `${getScaledValue(20)}px`,
                }}
              />
            </motion.div>
            <motion.p
              className="text-[#ffffff80]"
              style={{ 
                fontSize: `${getScaledValue(12)}px`,
                padding: `0 ${getScaledValue(12)}px`,
              }}
              variants={itemVariants}
            >
              Choose your career objectives to get personalized insights
            </motion.p>
          </motion.div>
          <motion.div 
            className="grid grid-cols-1"
            style={{ gap: `${getScaledValue(8)}px` }}
            variants={itemVariants}
          >
            {[
              "Find a new job",
              "Track current applications",
              "Network with professionals",
              "Improve interview skills",
              "Salary negotiation",
              "Career advancement",
            ].map((goal, index) => (
              <motion.button
                key={goal}
                onClick={() => toggleGoal(goal)}
                className={`flex w-full items-center border border-solid transition-all duration-300 backdrop-blur-sm ${
                  formData.goals.includes(goal)
                    ? "bg-[#1dff0026] border-[#1dff00] text-[#1dff00] shadow-[0px_0px_14px_rgba(29,255,0,0.3)]"
                    : "bg-[#ffffff26] border-[#ffffff33] text-white hover:bg-[#ffffff33] hover:border-[#ffffff4d]"
                }`}
                style={{
                  height: `${getScaledValue(48)}px`,
                  gap: `${getScaledValue(8)}px`,
                  padding: `${getScaledValue(12)}px`,
                  borderRadius: `${getScaledValue(8)}px`,
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <motion.div
                  className={`rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    formData.goals.includes(goal)
                      ? "border-[#1dff00] bg-[#1dff00]"
                      : "border-[#ffffff66]"
                  }`}
                  style={{
                    width: `${getScaledValue(16)}px`,
                    height: `${getScaledValue(16)}px`,
                  }}
                  animate={{
                    scale: formData.goals.includes(goal) ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <AnimatePresence>
                    {formData.goals.includes(goal) && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CheckCircle 
                          className="text-black"
                          style={{
                            width: `${getScaledValue(10)}px`,
                            height: `${getScaledValue(10)}px`,
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <span 
                  className="tracking-[-0.36px] font-medium"
                  style={{ fontSize: `${getScaledValue(14)}px` }}
                >
                  {goal}
                </span>
              </motion.button>
            ))}
          </motion.div>
        </motion.div>
      ),
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    console.log("Onboarding completed:", formData);
    // STEP 2 → STEP 3: Onboarding completed, navigate to Dashboard
    navigate("/dashboard");
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return formData.firstName.trim() && formData.lastName.trim();
      case 1:
        return formData.jobTitle.trim() && formData.experience && formData.location.trim();
      case 2:
        return formData.goals.length > 0;
      default:
        return true;
    }
  };

  // Create polygon background pattern
  const createPolygonGrid = () => {
    const rows = [
      { startTop: 890, count: 12, height: 92 },
      { startTop: 778, count: 12, height: 153 },
      { startTop: 665, count: 12, height: 153 },
      { startTop: 552, count: 12, height: 153 },
      { startTop: 439, count: 12, height: 153 },
      { startTop: 326, count: 12, height: 153 },
      { startTop: 213, count: 12, height: 153 },
      { startTop: 100, count: 12, height: 153 },
      { startTop: 0, count: 12, height: 141 },
    ];

    return rows.flatMap((row, rowIndex) =>
      Array.from({ length: row.count }, (_, i) => ({
        key: `polygon-${rowIndex}-${i}`,
        top: `top-[${row.startTop}px]`,
        left:
          i === 0 && rowIndex % 2 !== 0
            ? `left-0`
            : `left-[${i * 130 + (rowIndex % 2 === 0 ? 0.5 : 0)}px]`,
        width: i === row.count - 1 ? "w-[81px]" : "w-[133px]",
        height: `h-[${row.height}px]`,
      })),
    );
  };

  const polygons = createPolygonGrid();

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center overflow-hidden">
      {/* Enhanced responsive container with better breakpoints */}
      <div className="w-full h-full flex flex-col justify-center items-center px-2 xs:px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-2 xs:py-3 sm:py-4 md:py-6 lg:py-8">
        {/* Responsive onboarding layout with enhanced breakpoints */}
        <div className="flex flex-col gap-3 xs:gap-4 sm:gap-5 md:gap-6 w-full max-w-xs xs:max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl">
          {/* Animated background elements - dynamically scaled with enhanced responsiveness */}
          <motion.div
            className="absolute top-4 xs:top-6 sm:top-8 md:top-12 lg:top-16 left-2 xs:left-3 sm:left-4 md:left-8 lg:left-12 xl:left-16 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-sm xs:blur-md sm:blur-lg md:blur-xl lg:blur-2xl"
            style={{
              width: `${getScaledValue(24)}px`,
              height: `${getScaledValue(24)}px`,
            }}
            variants={floatingVariants}
            animate="animate"
          />
          <motion.div
            className="absolute bottom-4 xs:bottom-6 sm:bottom-8 md:bottom-12 lg:bottom-16 right-2 xs:right-3 sm:right-4 md:right-8 lg:right-12 xl:right-16 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-sm xs:blur-md sm:blur-lg md:blur-xl lg:blur-2xl"
            style={{
              width: `${getScaledValue(40)}px`,
              height: `${getScaledValue(40)}px`,
            }}
            variants={floatingVariants}
            animate="animate"
            transition={{ delay: 2 }}
          />
          <motion.div
            className="absolute top-1/2 right-1 sm:right-4 md:right-6 lg:right-8 bg-gradient-to-r from-[#1dff00]/15 to-[#0a8246]/15 rounded-full blur-md sm:blur-lg md:blur-xl"
            style={{
              width: `${getScaledValue(24)}px`,
              height: `${getScaledValue(24)}px`,
            }}
            variants={floatingVariants}
            animate="animate"
            transition={{ delay: 4 }}
          />

          {/* Enhanced background pattern - responsive visibility */}
          <div className="absolute inset-0 overflow-hidden opacity-10 xs:opacity-15 sm:opacity-20 hidden xs:block">
            {polygons.map((polygon) => (
              <motion.img
                key={polygon.key}
                className={`absolute ${polygon.width} ${polygon.height} ${polygon.top} ${polygon.left} opacity-30 xs:opacity-40 sm:opacity-50 md:opacity-60 lg:opacity-70`}
                alt="Polygon"
                src="/polygon-95.svg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: Math.random() * 2 }}
              />
            ))}
          </div>

          {/* Enhanced Onboarding Card - Dynamically scaled with better responsiveness */}
          <motion.div
            className="w-full relative"
            style={{
              maxWidth: `${getScaledValue(380)}px`,
              transform: `scale(${scalePercentage / 100})`,
              transformOrigin: 'center center',
            }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <Card 
              className="w-full bg-[#ffffff0d] backdrop-blur-[18px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(18px)_brightness(100%)] border border-[#ffffff15] relative overflow-hidden shadow-2xl"
              style={{
                borderRadius: `${getScaledValue(12)}px`,
                boxShadow: `0px ${getScaledValue(8)}px ${getScaledValue(32)}px rgba(0,0,0,0.2), 0px ${getScaledValue(16)}px ${getScaledValue(48)}px rgba(0,0,0,0.15)`,
              }}
            >
              {/* Enhanced animated border glow */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 via-transparent to-[#1dff00]/20 opacity-50 animate-pulse"
                style={{ borderRadius: `${getScaledValue(12)}px` }}
              />
              
              <CardContent 
                className="relative z-10"
                style={{ 
                  padding: `${getScaledValue(16)}px ${getScaledValue(20)}px ${getScaledValue(20)}px`,
                }}
              >
                {/* Enhanced progress indicator - Dynamically scaled */}
                <motion.div
                  className="flex justify-center"
                  style={{ 
                    marginBottom: `${getScaledValue(12)}px`,
                    paddingTop: `${getScaledValue(4)}px`,
                  }}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div 
                    className="flex"
                    style={{ gap: `${getScaledValue(6)}px` }}
                  >
                    {steps.map((_, index) => (
                      <motion.div
                        key={index}
                        className={`rounded-full transition-all duration-500 ${
                          index <= currentStep
                            ? "bg-[#1dff00] shadow-[0px_0px_7px_rgba(29,255,0,0.5)]"
                            : "bg-[#ffffff33]"
                        }`}
                        style={{
                          width: `${getScaledValue(8)}px`,
                          height: `${getScaledValue(8)}px`,
                        }}
                        animate={{
                          scale: index === currentStep ? [1, 1.2, 1] : 1,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* Step content - Dynamically scaled */}
                <motion.div
                  className="text-center"
                  style={{ marginBottom: `${getScaledValue(16)}px` }}
                  key={currentStep}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.h2
                    className="font-bold text-white text-center tracking-[0] leading-normal"
                    style={{ 
                      fontSize: `${getScaledValue(20)}px`,
                      marginBottom: `${getScaledValue(6)}px`,
                    }}
                    layoutId="title"
                  >
                    {steps[currentStep].title}
                  </motion.h2>
                  <motion.p
                    className="text-[#ffffff80] text-center"
                    style={{ 
                      fontSize: `${getScaledValue(14)}px`,
                      padding: `0 ${getScaledValue(12)}px`,
                    }}
                    layoutId="subtitle"
                  >
                    {steps[currentStep].subtitle}
                  </motion.p>
                </motion.div>

                {/* Step component - Dynamically scaled */}
                <div 
                  style={{ 
                    marginBottom: `${getScaledValue(16)}px`,
                    minHeight: `${getScaledValue(180)}px`,
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div key={currentStep}>
                      {steps[currentStep].component}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Enhanced Navigation buttons - Multi-screen responsive */}
                <motion.div
                  className="flex justify-between items-center w-full"
                  style={{ gap: `${getScaledValue(8)}px` }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <motion.div
                    whileHover={{ scale: currentStep === 0 ? 1 : 1.05 }}
                    whileTap={{ scale: currentStep === 0 ? 1 : 0.95 }}
                    className="flex-shrink-0"
                  >
                    <Button
                      variant="ghost"
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      className={`flex items-center transition-all duration-300 ${
                        currentStep === 0
                          ? "text-[#ffffff30] cursor-not-allowed opacity-50"
                          : "text-white hover:bg-[#ffffff20] border border-[#ffffff15] hover:border-[#ffffff30]"
                      }`}
                      style={{
                        gap: `${getScaledValue(3)}px`,
                        padding: `${getScaledValue(8)}px ${getScaledValue(12)}px`,
                        borderRadius: `${getScaledValue(8)}px`,
                        fontSize: `${getScaledValue(12)}px`,
                      }}
                    >
                      <ChevronLeft 
                        style={{
                          width: `${getScaledValue(12)}px`,
                          height: `${getScaledValue(12)}px`,
                        }}
                      />
                      <span className="hidden sm:inline">Back</span>
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: isStepValid() ? 1.02 : 1 }}
                    whileTap={{ scale: isStepValid() ? 0.98 : 1 }}
                    className="flex-shrink-0"
                  >
                    <Button
                      onClick={currentStep === steps.length - 1 ? handleComplete : nextStep}
                      disabled={!isStepValid()}
                      className={`flex items-center font-bold transition-all duration-300 ${
                        isStepValid()
                          ? "bg-[linear-gradient(270deg,rgba(29,255,0,1)_0%,rgba(10,130,70,1)_85%)] text-white shadow-[0px_3px_14px_#00000040] hover:shadow-[0px_4px_22px_#00000060]"
                          : "bg-[#ffffff33] text-[#ffffff66] cursor-not-allowed"
                      }`}
                      style={{
                        gap: `${getScaledValue(6)}px`,
                        padding: `${getScaledValue(8)}px ${getScaledValue(16)}px`,
                        borderRadius: `${getScaledValue(8)}px`,
                        fontSize: `${getScaledValue(12)}px`,
                      }}
                    >
                      {currentStep === steps.length - 1 ? (
                        <>
                          <span className="hidden sm:inline">Complete</span>
                          <span className="sm:hidden">Done</span>
                          <Sparkles 
                            style={{
                              width: `${getScaledValue(12)}px`,
                              height: `${getScaledValue(12)}px`,
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline">Continue</span>
                          <span className="sm:hidden">Next</span>
                          <ChevronRight 
                            style={{
                              width: `${getScaledValue(12)}px`,
                              height: `${getScaledValue(12)}px`,
                            }}
                          />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};