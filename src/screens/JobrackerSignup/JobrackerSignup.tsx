import { LockKeyholeIcon, MailIcon, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../../lib/supabaseClient";

export const JobrackerSignup = (): JSX.Element => {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleOAuth = useCallback(
    async (provider: "google" | "linkedin_oidc") => {
      try {
        setSubmitting(true);
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
      } catch (err: any) {
        console.error(`${provider} OAuth error:`, err);
        alert(err?.message || `Failed to sign in with ${provider}`);
      } finally {
        setSubmitting(false);
      }
    },
    [supabase]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (showForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        alert("Password reset link sent to your email.");
        setShowForgotPassword(false);
        return;
      }

      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          alert("Passwords do not match!");
          return;
        }

  const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
      emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw error;
    // Always require email verification; route to login
    alert("Sign up successful. Please check your email to verify your account, then sign in.");
    navigate("/login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Supabase auth error:", error);
      alert(error?.message || "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
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
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl">
        {/* Animated background elements - responsive */}
        <motion.div
          className="absolute top-4 sm:top-8 md:top-12 lg:top-16 left-2 sm:left-4 md:left-8 lg:left-12 xl:left-16 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-lg sm:blur-xl md:blur-2xl w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 lg:w-16 lg:h-16"
          variants={floatingVariants}
          animate="animate"
        />
        <motion.div
          className="absolute bottom-4 sm:bottom-8 md:bottom-12 lg:bottom-16 right-2 sm:right-4 md:right-8 lg:right-12 xl:right-16 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-lg sm:blur-xl md:blur-2xl w-8 h-8 sm:w-10 sm:h-10 md:w-16 md:h-16 lg:w-20 lg:h-20"
          variants={floatingVariants}
          animate="animate"
          transition={{ delay: 2 }}
        />
        <motion.div
          className="absolute top-1/2 left-1 sm:left-2 md:left-4 lg:left-6 xl:left-8 bg-gradient-to-r from-[#1dff00]/15 to-[#0a8246]/15 rounded-full blur-md sm:blur-lg md:blur-xl w-4 h-4 sm:w-6 sm:h-6 md:w-8 md:h-8 lg:w-12 lg:h-12"
          variants={floatingVariants}
          animate="animate"
          transition={{ delay: 4 }}
        />

        {/* Main Card - Fully responsive */}
        <motion.div
          className="w-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="w-full bg-[#ffffff0d] backdrop-blur-[18px] backdrop-brightness-[100%] [-webkit-backdrop-filter:blur(18px)_brightness(100%)] border border-[#ffffff15] relative overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl">
            {/* Animated border glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 via-transparent to-[#1dff00]/20 opacity-50 animate-pulse rounded-xl sm:rounded-2xl" />
            
            <CardContent className="relative z-10 p-4 sm:p-6 lg:p-8">
              <motion.div
                className="flex flex-col items-center justify-center relative space-y-4 sm:space-y-6"
                variants={itemVariants}
              >
                {/* Logo and Title - Responsive sizing */}
                <motion.div
                  className="flex flex-col items-center space-y-2 sm:space-y-3"
                  variants={itemVariants}
                >
                  <motion.div
                    className="bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center shadow-lg w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Sparkles className="text-white w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                  </motion.div>
                  
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={showForgotPassword ? "forgot" : isSignUp ? "signup" : "signin"}
                      className="font-bold text-white text-center tracking-[0] leading-normal text-lg sm:text-xl lg:text-2xl"
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
                  </AnimatePresence>
                  
                  <motion.p
                    className="text-[#ffffff80] text-center text-xs sm:text-sm lg:text-base max-w-xs sm:max-w-sm lg:max-w-md"
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
                      className="flex flex-col items-center relative w-full space-y-3 sm:space-y-4"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Social login buttons - Responsive */}
                      <motion.div
                        className="flex flex-col w-full space-y-2 sm:space-y-3"
                        variants={itemVariants}
                      >
                        <motion.div 
                          className="w-full"
                          whileHover={{ scale: 1.02 }} 
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button
                            variant="ghost"
                            className="flex w-full items-center justify-center relative bg-[#ffffff26] shadow-[0px_3px_14px_#0000001a] hover:bg-[#ffffff33] border border-[#ffffff15] backdrop-blur-sm transition-all duration-300 h-10 sm:h-12 lg:h-14 text-xs sm:text-sm lg:text-base rounded-lg sm:rounded-xl"
                            type="button"
                            disabled={submitting}
                            onClick={() => handleOAuth("google")}
                          >
                            <img
                              className="relative w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6"
                              alt="Google"
                              src="/flat-color-icons-google.svg"
                            />
                            <span className="relative w-fit font-medium text-white tracking-[-0.36px] leading-normal ml-2 sm:ml-3">
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
                            className="flex w-full items-center justify-center relative bg-[#ffffff26] shadow-[0px_3px_14px_#0000001a] hover:bg-[#ffffff33] border border-[#ffffff15] backdrop-blur-sm transition-all duration-300 h-10 sm:h-12 lg:h-14 text-xs sm:text-sm lg:text-base rounded-lg sm:rounded-xl"
                            type="button"
                            disabled={submitting}
                            onClick={() => handleOAuth("linkedin_oidc")}
                          >
                            <img
                              className="relative w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6"
                              alt="LinkedIn"
                              src="/logos-linkedin-icon.svg"
                            />
                            <span className="relative w-fit font-medium text-white tracking-[-0.36px] leading-normal ml-2 sm:ml-3">
                              Continue with LinkedIn
                            </span>
                          </Button>
                        </motion.div>
                      </motion.div>

                      {/* Divider - Responsive */}
                      <motion.div
                        className="relative w-full flex items-center h-6 sm:h-8"
                        variants={itemVariants}
                      >
                        <Separator className="flex-1 bg-[#ffffff20]" />
                        <span className="font-medium text-[#ffffff80] px-3 sm:px-4 text-xs sm:text-sm">
                          or
                        </span>
                        <Separator className="flex-1 bg-[#ffffff20]" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form - Responsive */}
                <motion.form
                  onSubmit={handleSubmit}
                  className="flex flex-col items-center relative w-full space-y-3 sm:space-y-4"
                  variants={itemVariants}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={showForgotPassword ? "forgot-form" : isSignUp ? "signup-form" : "signin-form"}
                      className="w-full space-y-3 sm:space-y-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Email Field - Responsive */
                      // Standardize using transparent variant and lg size for consistency
                      }
                      <motion.div
                        className="w-full"
                        whileFocus={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <div className="flex w-full items-center relative bg-transparent border border-solid border-[#ffffff33] shadow-[0px_2px_14px_#0000000d] backdrop-blur-sm hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 h-12 sm:h-14 md:h-16 lg:h-18 px-4 sm:px-5 md:px-6 rounded-lg sm:rounded-xl">
                          <MailIcon className="text-white flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5" />
                          <Input
                            variant="transparent"
                            inputSize="lg"
                            className="border-0 bg-transparent text-white tracking-wide placeholder:text-white/70 focus-visible:ring-0 p-0 h-auto ml-3 sm:ml-4"
                            type="email"
                            placeholder="Email address"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                        </div>
                      </motion.div>

                      {/* Password Field - Responsive */}
                      {!showForgotPassword && (
                        <motion.div
                          className="w-full"
                          whileFocus={{ scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <div className="flex w-full items-center relative bg-transparent border border-solid border-[#ffffff33] shadow-[0px_2px_14px_#0000000d] backdrop-blur-sm hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 h-12 sm:h-14 md:h-16 lg:h-18 px-4 sm:px-5 md:px-6 rounded-lg sm:rounded-xl">
                            <LockKeyholeIcon className="text-white flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5" />
                            <Input
                              variant="transparent"
                              inputSize="lg"
                              className="border-0 bg-transparent text-white tracking-wide placeholder:text-white/70 focus-visible:ring-0 p-0 h-auto flex-1 ml-3 sm:ml-4"
                              type={showPassword ? "text" : "password"}
                              placeholder="Password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              required
                            />
                            <motion.button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-[#ffffff80] hover:text-white transition-colors duration-200 flex-shrink-0 ml-2"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              {showPassword ? (
                                <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" />
                              ) : (
                                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                              )}
                            </motion.button>
                          </div>
                        </motion.div>
                      )}

                      {/* Confirm Password Field (Sign Up Only) - Responsive */}
                      {isSignUp && !showForgotPassword && (
                        <motion.div
                          className="w-full"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex w-full items-center relative bg-transparent border border-solid border-[#ffffff33] shadow-[0px_2px_14px_#0000000d] backdrop-blur-sm hover:border-[#ffffff4d] focus-within:border-[#1dff00] transition-all duration-300 h-12 sm:h-14 md:h-16 lg:h-18 px-4 sm:px-5 md:px-6 rounded-lg sm:rounded-xl">
                            <LockKeyholeIcon className="text-white flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5" />
                            <Input
                              variant="transparent"
                              inputSize="lg"
                              className="border-0 bg-transparent text-white tracking-wide placeholder:text-white/70 focus-visible:ring-0 p-0 h-auto ml-3 sm:ml-4"
                              type="password"
                              placeholder="Confirm Password"
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                              required
                            />
                          </div>
                        </motion.div>
                      )}

                      {/* Forgot Password Link - Responsive */}
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
                            className="text-[#1dff00] p-0 h-auto font-medium hover:text-[#1dff00]/80 transition-colors duration-200 text-xs sm:text-sm"
                          >
                            Forgot password?
                          </Button>
                        </motion.div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Submit Button - Responsive */}
                  <motion.div
                    className="w-full"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="submit"
                      className="w-full flex items-center justify-center relative shadow-[0px_3px_14px_#00000040] bg-[linear-gradient(270deg,rgba(29,255,0,1)_0%,rgba(10,130,70,1)_85%)] font-bold text-white hover:shadow-[0px_4px_22px_#00000060] transition-all duration-300 h-10 sm:h-12 lg:h-14 text-xs sm:text-sm lg:text-base rounded-lg sm:rounded-xl disabled:opacity-60"
                    disabled={submitting}
                    >
                      {showForgotPassword
                        ? "Send Reset Link"
                        : isSignUp
                        ? "Create Account"
                        : "Sign In"}
                      <ArrowRight className="ml-2 w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </motion.div>
                </motion.form>

                {/* Bottom Links - Responsive */}
                <motion.div
                  className="relative w-full text-center font-medium text-xs sm:text-sm"
                  variants={itemVariants}
                >
                  <AnimatePresence mode="wait">
                    {showForgotPassword ? (
                      <motion.div
                        key="back-to-signin"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setShowForgotPassword(false)}
                          className="text-[#ffffff80] p-0 h-auto font-medium hover:text-white transition-colors duration-200 text-xs sm:text-sm"
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
                        className="space-y-1 sm:space-y-2"
                      >
                        <div>
                          <span className="text-[#ffffffb2]">
                            {isSignUp ? "Already have an account?" : "Don't have an account?"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setIsSignUp(!isSignUp)}
                          className="text-[#1dff00] p-0 h-auto font-medium hover:text-[#1dff00]/80 transition-colors duration-200 text-xs sm:text-sm"
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
  );
};