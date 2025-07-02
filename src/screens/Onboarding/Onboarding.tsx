import { useState } from "react";
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
      
      // Adjust based on screen width
      if (width < 480) {
        scale = 65; // 35% reduction for very small screens
      } else if (width < 640) {
        scale = 70; // 30% reduction for small screens
      } else if (width < 768) {
        scale = 75; // 25% reduction for medium screens
      } else if (width < 1024) {
        scale = 80; // 20% reduction for large screens
      } else if (width < 1280) {
        scale = 85; // 15% reduction for xl screens
      } else {
        scale = 90; // 10% reduction for 2xl+ screens
      }
      
      // Adjust based on screen height
      if (height < 600) {
        scale -= 10; // Additional 10% reduction for short screens
      } else if (height < 700) {
        scale -= 5; // Additional 5% reduction for medium height screens
      }
      
      // Ensure scale doesn't go below 50% or above 95%
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
      transition: