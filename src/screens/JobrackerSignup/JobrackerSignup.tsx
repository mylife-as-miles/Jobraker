import { LockKeyholeIcon, MailIcon, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";

export const JobrackerSignup = (): JSX.Element => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [scalePercentage, setScalePercentage] = useState(80);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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

  // Create a data structure for the polygon background pattern
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (showForgotPassword) {
      // Handle forgot password
      console.log("Reset password for:", formData.email);
      // For demo purposes, just show success message
      alert("Password reset link sent to your email!");
      setShowForgotPassword(false);
    } else if (isSignUp) {
      // STEP 1 → STEP 2: Sign Up completed, navigate to Onboarding
      console.log("Sign up completed:", formData);
      navigate("/onboarding");
    } else {
      // Alternative flow: Sign In directly to Dashboard
      console.log("Sign in completed:", formData);
      navigate("/dashboard");
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
        {
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        },
    },
  };

  // Calculate responsive values based on scale percentage
  const getScaledValue = (baseValue: number) => Math.round(baseValue * (scalePercentage / 100));

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl p-3 sm:p-6">
        {/* Responsive signup layout */}
        <div className="flex flex-col gap-4">
          {/* Animated background elements - dynamically scaled */}
          <motion.div
            className="absolute top-8 sm:top-12 md:top-16 left-3 sm:left-8 md:left-12 lg:left-16 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-lg sm:blur-xl md:blur-2xl"
            style={{
              width: `${getScaledValue(32)}px`,
              height: `${getScaledValue(32)}px`,
            }}
            variants={floatingVariants}
            animate="animate"
          />
          <motion.div
            className="absolute bottom-8 sm:bottom-12 md:bottom-16 right-3 sm:right-8 md:right-12 lg:right-16 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-lg sm:blur-xl md:blur-2xl"
            style={{
              width: `${getScaledValue(40)}px`,
              height: `${getScaledValue(40)}px`,
            }}
            variants={floatingVariants}
            animate="animate"
            transition={{ delay: 2 }}
          />
          <motion.div
            className="absolute top-1/2 left-1 sm:left-4 md:left-6 lg:left-8 bg-gradient-to-r from-[#1dff00]/15 to-[#0a8246]/15 rounded-full blur-md sm:blur-lg md:blur-xl"
            style={{
              width: `${getScaledValue(24)}px`,
              height: `${getScaledValue(24)}px`,
            }}
            variants={floatingVariants}
            animate="animate"
            transition={{ delay: 4 }}
          />

          {/* Background pattern - hidden on mobile for performance */}
          <div className="absolute inset-0 overflow-hidden opacity-20 hidden sm:block">
            {polygons.map((polygon) => (
              <motion.img
                key={polygon.key}
                className={`absolute ${polygon.width} ${polygon.height} ${polygon.top} ${polygon.left}`}
                alt="Polygon"
                src="/polygon-95.svg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: Math.random() * 2 }}
              />
            ))}
          </div>

          {/* Main Card - Dynamically scaled based on screen size */}
          <motion.div
            className="w-full"
            style={{
              maxWidth: `${getScaledValue(360)}px`,
              transform: `scale(${scalePercentage / 100})`,
              transformOrigin: 'center center',
            }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <Card 
              className="w-full bg-[#ffffff0d] backdrop-blur-[18px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(18px)_brightness(100%)] border border-[#ffffff15] relative overflow-hidden"
              style={{
                borderRadius: `${getScaledValue(12)}px`,
                boxShadow: `0px ${getScaledValue(16)}px ${getScaledValue(48)}px rgba(0,0,0,0.3)`,
              }}
            >
              {/* Animated border glow */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 via-transparent to-[#1dff00]/20 opacity-50 animate-pulse"
                style={{ borderRadius: `${getScaledValue(12)}px` }}
              />
              
              <CardContent 
                className="relative z-10"
                style={{
                  padding: `${getScaledValue(24)}px`,
                }}
              >
                <motion.div
                  className="flex flex-col items-center justify-center relative"
                  style={{ gap: `${getScaledValue(16)}px` }}
                  variants={itemVariants}
                >
                  {/* Logo and Title - Dynamically scaled */}
                  <motion.div
                    className="flex flex-col items-center"
                    style={{ gap: `${getScaledValue(8)}px` }}
                    variants={itemVariants}
                  >
                    <motion.div
                      className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center shadow-lg"
                      style={{
                        width: `${getScaledValue(40)}px`,
                        height: `${getScaledValue(40)}px`,
                      }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Sparkles 
                        style={{
                          width: `${getScaledValue(20)}px`,
                          height: `${getScaledValue(20)}px`,
                        }}
                        className="text-white" 
                      />
                    </motion.div>
                    
                    <AnimatePresence mode="wait">
                      <motion.h2
                        key={showForgotPassword ? "forgot" : isSignUp ? "signup" : "signin"}
                        className="font-bold text-white text-center tracking-[0] leading-normal"
                        style={{ fontSize: `${getScaledValue(20)}px` }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {showForgotPassword
                          ? "Reset Password"
                          : isSignUp
                          ? "Create Account"
                          : "Welcome Back"}
                      </motion.h2>
<<<<<<< HEAD
                    </AnimatePresence>
=======
                    </AnimatePresence
>>>>>>> 96a5f12096373c7b5db91129c2d9cb763580b9aa
                    
                    <motion.p
                      className="text-[#ffffff80] text-center"
                      style={{ 
                        fontSize: `${getScaledValue(14)}px`,
                        maxWidth: `${getScaledValue(280)}px`,
                      }}
                      variants={itemVariants}
                    >
                      {showForgotPassword
                        ? "Enter your email to receive a reset link"
                        : isSignUp
                        ? "Join thousands tracking their career"
                        : "Sign in to continue your journey"}
                    </motion.p>
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {!showForgotPassword && (
                      <motion.div
                        className="flex flex-col items-center relative w-full"
                        style={{ gap: `${getScaledValue(12)}px` }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                      >
                        {/* Social login buttons - Dynamically scaled */}
                        <motion.div
                          className="flex flex-col w-full"
                          style={{ gap: `${getScaledValue(8)}px` }}
                          variants={itemVariants}
                        >
                          <motion.div 
                            className="w-full"
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }}
                          >
                            <Button
                              variant="ghost"
                              className="flex w-full items-center justify-center relative bg-[#ffffff26] shadow-[0px_3px_14px_#0000001a] hover:bg-[#ffffff33] border border-[#ffffff15] backdrop-blur-sm transition-all duration-300"
                              style={{
                                height: `${getScaledValue(48)}px`,
                                gap: `${getScaledValue(8)}px`,
                                padding: `${getScaledValue(8)}px`,
                                borderRadius: `${getScaledValue(8)}px`,
                                fontSize: `${getScaledValue(14)}px`,
                              }}
                            >
                              <img
                                className="relative"
                                style={{
                                  width: `${getScaledValue(20)}px`,
                                  height: `${getScaledValue(20)}px`,
                                }}
                                alt="Google"
                                src="/flat-color-icons-google.svg"
                              />
                              <span className="relative w-fit font-medium text-white tracking-[-0.36px] leading-normal">
                                Continue with Google
                              </span>
                            </Button>
                          </motion.div>

                          <motion.div 
                            className="w-full"
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }}
                          >
                            <Button
                              variant="ghost"
                              className="flex w-full items-center justify-center relative bg-[#ffffff26] shadow-[0px_3px_14px_#0000001a] hover:bg-[#ffffff33] border border-[#ffffff15] backdrop-blur-sm transition-all duration-300"
                              style={{
                                height: `${getScaledValue(48)}px`,
                                gap: `${getScaledValue(8)}px`,
                                padding: `${getScaledValue(8)}px`,
                                borderRadius: `${getScaledValue(8)}px`,
                                fontSize: `${getScaledValue(14)}px`,
                              }}
                            >
                              <img
                                className="relative"
                                style={{
                                  width: `${getScaledValue(20)}px`,
                                  height: `${getScaledValue(20)}px`,
                                }}
                                alt="LinkedIn"
                                src="/logos-linkedin-icon.svg"
                              />
                              <span className="relative w-fit font-medium text-white tracking-[-0.36px] leading-normal">
                                Continue with LinkedIn
                              </span>
                            </Button>
                          </motion.div>
                        </motion.div>

                        {/* Divider - Dynamically scaled */}
                        <motion.div
                          className="relative w-full flex items-center"
                          style={{ height: `${getScaledValue(24)}px` }}
                          variants={itemVariants}
                        >
                          <Separator className="flex-1 bg-[#ffffff20]" />
                          <span 
                            className="font-medium text-[#ffffff80]"
                            style={{ 
                              padding: `0 ${getScaledValue(12)}px`,
                              fontSize: `${getScaledValue(12)}px`,
                            }}
                          >
                            or
                          </span>
                          <Separator className="flex-1 bg-[#ffffff20]" />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Form - Dynamically scaled */}
                  <motion.form
                    onSubmit={handleSubmit}
                    className="flex flex-col items-center relative w-full"
                    style={{ gap: `${getScaledValue(12)}px` }}
                    variants={itemVariants}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={showForgotPassword ? "forgot-form" : isSignUp ? "signup-form" : "signin-form"}
                        className="w-full"
                        style={{ gap: `${getScaledValue(8)}px` }}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                      >
                        {/* Email Field - Dynamically scaled */}
                        <motion.div
                          className="w-full"
                          style={{ marginBottom: `${getScaledValue(8)}px` }}
                          whileFocus={{ scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <div 
                            className="flex w-full items-center relative bg-[#ffffff26] border border-solid border-[#ffffff33] shadow-[0px_2px_14px_#0000000d] backdrop-blur-sm hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300"
                            style={{
                              height: `${getScaledValue(48)}px`,
                              gap: `${getScaledValue(12)}px`,
                              padding: `${getScaledValue(12)}px`,
                              borderRadius: `${getScaledValue(8)}px`,
                            }}
                          >
                            <MailIcon 
                              className="text-white flex-shrink-0"
                              style={{
                                width: `${getScaledValue(16)}px`,
                                height: `${getScaledValue(16)}px`,
                              }}
                            />
                            <Input
                              className="border-none bg-transparent text-white tracking-[-0.36px] placeholder:text-[#ffffff99] focus-visible:ring-0 p-0 h-auto"
                              style={{ fontSize: `${getScaledValue(14)}px` }}
                              type="email"
                              placeholder="Email address"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              required
                            />
                          </div>
                        </motion.div>

                        {/* Password Field - Dynamically scaled */}
                        {!showForgotPassword && (
                          <motion.div
                            className="w-full"
                            style={{ marginBottom: `${getScaledValue(8)}px` }}
                            whileFocus={{ scale: 1.01 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            <div 
                              className="flex w-full items-center relative bg-[#ffffff26] border border-solid border-[#ffffff33] shadow-[0px_2px_14px_#0000000d] backdrop-blur-sm hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300"
                              style={{
                                height: `${getScaledValue(48)}px`,
                                gap: `${getScaledValue(12)}px`,
                                padding: `${getScaledValue(12)}px`,
                                borderRadius: `${getScaledValue(8)}px`,
                              }}
                            >
                              <LockKeyholeIcon 
                                className="text-white flex-shrink-0"
                                style={{
                                  width: `${getScaledValue(16)}px`,
                                  height: `${getScaledValue(16)}px`,
                                }}
                              />
                              <Input
                                className="border-none bg-transparent text-white tracking-[-0.36px] placeholder:text-[#ffffff99] focus-visible:ring-0 p-0 h-auto flex-1"
                                style={{ fontSize: `${getScaledValue(14)}px` }}
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                              />
                              <motion.button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-[#ffffff80] hover:text-white transition-colors duration-200 flex-shrink-0"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                {showPassword ? (
                                  <EyeOff 
                                    style={{
                                      width: `${getScaledValue(14)}px`,
                                      height: `${getScaledValue(14)}px`,
                                    }}
                                  />
                                ) : (
                                  <Eye 
                                    style={{
                                      width: `${getScaledValue(14)}px`,
                                      height: `${getScaledValue(14)}px`,
                                    }}
                                  />
                                )}
                              </motion.button>
                            </div>
                          </motion.div>
                        )}

                        {/* Confirm Password Field (Sign Up Only) - Dynamically scaled */}
                        {isSignUp && !showForgotPassword && (
                          <motion.div
                            className="w-full"
                            style={{ marginBottom: `${getScaledValue(8)}px` }}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div 
                              className="flex w-full items-center relative bg-[#ffffff26] border border-solid border-[#ffffff33] shadow-[0px_2px_14px_#0000000d] backdrop-blur-sm hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300"
                              style={{
                                height: `${getScaledValue(48)}px`,
                                gap: `${getScaledValue(12)}px`,
                                padding: `${getScaledValue(12)}px`,
                                borderRadius: `${getScaledValue(8)}px`,
                              }}
                            >
                              <LockKeyholeIcon 
                                className="text-white flex-shrink-0"
                                style={{
                                  width: `${getScaledValue(16)}px`,
                                  height: `${getScaledValue(16)}px`,
                                }}
                              />
                              <Input
                                className="border-none bg-transparent text-white tracking-[-0.36px] placeholder:text-[#ffffff99] focus-visible:ring-0 p-0 h-auto"
                                style={{ fontSize: `${getScaledValue(14)}px` }}
                                type="password"
                                placeholder="Confirm Password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                required
                              />
                            </div>
                          </motion.div>
                        )}

                        {/* Forgot Password Link - Dynamically scaled */}
                        {!isSignUp && !showForgotPassword && (
                          <motion.div
                            className="text-right w-full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                          >
                            <Button
                              type="button"
                              variant="link"
                              onClick={() => setShowForgotPassword(true)}
                              className="text-[#1dff00] p-0 h-auto font-medium hover:text-[#1dff00]/80 transition-colors duration-200"
                              style={{ fontSize: `${getScaledValue(12)}px` }}
                            >
                              Forgot password?
                            </Button>
                          </motion.div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Submit Button - Dynamically scaled */}
                    <motion.div
                      className="w-full"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        type="submit"
                        className="w-full flex items-center justify-center relative shadow-[0px_3px_14px_#00000040] bg-[linear-gradient(270deg,rgba(29,255,0,1)_0%,rgba(10,130,70,1)_85%)] font-bold text-white hover:shadow-[0px_4px_22px_#00000060] transition-all duration-300"
                        style={{
                          height: `${getScaledValue(48)}px`,
                          gap: `${getScaledValue(8)}px`,
                          padding: `${getScaledValue(12)}px`,
                          borderRadius: `${getScaledValue(8)}px`,
                          fontSize: `${getScaledValue(14)}px`,
                        }}
                      >
                        {showForgotPassword
                          ? "Send Reset Link"
                          : isSignUp
                          ? "Create Account"
                          : "Sign In"}
                        <ArrowRight 
                          style={{
                            width: `${getScaledValue(14)}px`,
                            height: `${getScaledValue(14)}px`,
                          }}
                        />
                      </Button>
                    </motion.div>
                  </motion.form>

                  {/* Bottom Links - Dynamically scaled */}
                  <motion.div
                    className="relative w-full text-center font-medium"
                    style={{ 
                      fontSize: `${getScaledValue(12)}px`,
                      gap: `${getScaledValue(6)}px`,
                    }}
                    variants={itemVariants}
                  >
                    <AnimatePresence mode="wait">
                      {showForgotPassword ? (
                        <motion.div
                          key="back-to-signin"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          style={{ gap: `${getScaledValue(4)}px` }}
                        >
                          <Button
                            type="button"
                            variant="link"
                            onClick={() => setShowForgotPassword(false)}
                            className="text-[#ffffff80] p-0 h-auto font-medium hover:text-white transition-colors duration-200"
                            style={{ fontSize: `${getScaledValue(12)}px` }}
                          >
                            ← Back to sign in
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="auth-toggle"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          style={{ gap: `${getScaledValue(4)}px` }}
                        >
                          <div style={{ marginBottom: `${getScaledValue(4)}px` }}>
                            <span className="text-[#ffffffb2]">
                              {isSignUp ? "Already have an account?" : "Don't have an account?"}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="link"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-[#1dff00] p-0 h-auto font-medium hover:text-[#1dff00]/80 transition-colors duration-200"
                            style={{ fontSize: `${getScaledValue(12)}px` }}
                          >
                            {isSignUp ? "Sign in here" : "Create account"}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
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