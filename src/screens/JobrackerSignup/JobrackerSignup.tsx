import { LockKeyholeIcon, MailIcon, Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../../lib/supabaseClient";
import { ROUTES } from "../../routes";
import { validatePassword } from "../../utils/password";
import { useToast } from "../../components/ui/toast-provider";
import Modal from "../../components/ui/modal";

export const JobrackerSignup = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [isSignUp, setIsSignUp] = useState<boolean>(() => location.pathname !== ROUTES.SIGNIN);
  const [showPassword, setShowPassword] = useState(false);
  // Keep mode in sync when navigating between /signup and /signIn
  useEffect(() => {
    const shouldSignUp = location.pathname !== ROUTES.SIGNIN;
    setIsSignUp(shouldSignUp);
  }, [location.pathname]);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [resending, setResending] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const passwordCheck = useMemo(() => validatePassword(formData.password, formData.email), [formData.password, formData.email]);
  const emailValid = useMemo(() => {
    const v = (formData.email || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }, [formData.email]);

  const handleOAuth = useCallback(
    async (provider: "google" | "linkedin_oidc") => {
      try {
        setSubmitting(true);
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}${ROUTES.DASHBOARD}`,
          },
        });
        if (error) throw error;
      } catch (err: any) {
        console.error(`${provider} OAuth error:`, err);
    toastError("Sign in failed", err?.message || `Failed to sign in with ${provider}`);
      } finally {
        setSubmitting(false);
      }
    },
  [supabase, toastError]
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
        success("Reset link sent", "Please check your email to continue resetting your password.", 5000);
        setShowForgotPassword(false);
        return;
      }

      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          toastError("Passwords do not match", "Please confirm your password.");
          return;
        }
        if (!passwordCheck.valid) {
          toastError("Weak password", "Please meet all password requirements before continuing.");
          return;
        }

  const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
  emailRedirectTo: `${window.location.origin}${ROUTES.SIGNIN}`,
          },
        });
        if (error) throw error;
    // Always require email verification; route to login
  // Show centered success modal with actions
  success("Sign up successful", "We sent a verification link to your email.");
  setShowVerifyModal(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
  navigate(ROUTES.DASHBOARD);
      }
    } catch (error: any) {
      console.error("Supabase auth error:", error);
      toastError("Authentication failed", error?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setResending(true);
      const authAny = (supabase as any).auth;
      if (authAny && typeof authAny.resend === "function") {
        const { error } = await authAny.resend({
          type: "signup",
          email: formData.email,
          options: { emailRedirectTo: `${window.location.origin}/signIn` },
        });
        if (error) throw error;
      }
      success("Verification email resent");
    } catch (e: any) {
      toastError("Resend failed", e?.message || "Please try again later.");
    } finally {
      setResending(false);
    }
  };

  const openEmailApp = () => {
    const email = formData.email || "";
    const domain = email.split("@")[1]?.toLowerCase();
    const providerUrl = (() => {
      switch (domain) {
        case "gmail.com":
          return "https://mail.google.com/";
        case "outlook.com":
        case "hotmail.com":
        case "live.com":
        case "msn.com":
          return "https://outlook.live.com/mail/";
        case "yahoo.com":
          return "https://mail.yahoo.com/";
        case "icloud.com":
          return "https://www.icloud.com/mail/";
        case "proton.me":
        case "protonmail.com":
          return "https://mail.proton.me/";
        default:
          return null;
      }
    })();
    if (providerUrl) {
      window.open(providerUrl, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = "mailto:";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#0a0a0a] to-[#0d160d] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Enhanced background elements with mesh gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Radial gradient mesh */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(29,255,0,0.08)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(10,130,70,0.06)_0%,transparent_50%)]" />
        
        {/* Animated orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1dff00]/5 rounded-full blur-3xl"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#0a8246]/4 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, 50, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(29,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(29,255,0,0.03)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]" />
      </div>

      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl relative z-10">
        <motion.div
          className="w-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Main Card with glass morphism */}
          <Card className="w-full bg-black/40 backdrop-blur-2xl border border-[#1dff00]/10 relative overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(29,255,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.05)]">
            {/* Subtle animated border glow */}
            <motion.div 
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(29,255,0,0.1), transparent)',
              }}
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#1dff00]/40 to-transparent" />
            
            <CardContent className="relative z-10 p-6 sm:p-8 lg:p-10">
              <motion.div
                className="flex flex-col items-center justify-center relative space-y-6 sm:space-y-8"
                variants={itemVariants}
              >
                {/* Logo and Title - Modern minimal approach */}
                <motion.div
                  className="flex flex-col items-center space-y-4"
                  variants={itemVariants}
                >
                  {/* Refined logo with subtle animation */}
                  <motion.div
                    className="relative group"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <div className="absolute inset-0 bg-[#1dff00]/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300" />
                    <div className="relative bg-gradient-to-br from-[#1dff00]/90 via-[#1dff00] to-[#0a8246] rounded-2xl flex items-center justify-center shadow-lg w-14 h-14 sm:w-16 sm:h-16">
                      <Sparkles className="text-black w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.5} />
                    </div>
                  </motion.div>
                  
                  {/* Dynamic title with smooth transitions */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={showForgotPassword ? "forgot" : isSignUp ? "signup" : "signin"}
                      className="text-center space-y-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <h2 className="font-bold bg-gradient-to-br from-white via-white to-[#1dff00]/80 bg-clip-text text-transparent text-2xl sm:text-3xl tracking-tight">
                        {showForgotPassword
                          ? "Reset Password"
                          : isSignUp
                          ? "Create Account"
                          : "Welcome Back"}
                      </h2>
                      <p className="text-white/60 text-sm sm:text-base max-w-xs sm:max-w-sm leading-relaxed">
                        {showForgotPassword
                          ? "Enter your email to receive a reset link"
                          : isSignUp
                          ? "Start your journey to career success"
                          : "Continue your journey"}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>

                <AnimatePresence mode="wait">
                  {!showForgotPassword && (
                    <motion.div
                      className="flex flex-col items-center relative w-full space-y-4"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Modern social login buttons */}
                      <motion.div
                        className="flex flex-col w-full space-y-3"
                        variants={itemVariants}
                      >
                        <motion.div 
                          className="w-full"
                          whileHover={{ scale: 1.01 }} 
                          whileTap={{ scale: 0.99 }}
                        >
                          <Button
                            variant="ghost"
                            className="flex w-full items-center justify-center relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-[#1dff00]/30 backdrop-blur-sm transition-all duration-300 h-12 sm:h-13 text-sm rounded-xl group"
                            type="button"
                            disabled={submitting}
                            onClick={() => handleOAuth("google")}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1dff00]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                            <img
                              className="relative w-5 h-5 sm:w-5 sm:h-5"
                              alt="Google"
                              src="/flat-color-icons-google.svg"
                            />
                            <span className="relative w-fit font-medium text-white/90 group-hover:text-white tracking-wide leading-normal ml-3">
                              Continue with Google
                            </span>
                          </Button>
                        </motion.div>

                        <motion.div 
                          className="w-full"
                          whileHover={{ scale: 1.01 }} 
                          whileTap={{ scale: 0.99 }}
                        >
                          <Button
                            variant="ghost"
                            className="flex w-full items-center justify-center relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-[#1dff00]/30 backdrop-blur-sm transition-all duration-300 h-12 sm:h-13 text-sm rounded-xl group"
                            type="button"
                            disabled={submitting}
                            onClick={() => handleOAuth("linkedin_oidc")}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1dff00]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                            <img
                              className="relative w-5 h-5 sm:w-5 sm:h-5"
                              alt="LinkedIn"
                              src="/logos-linkedin-icon.svg"
                            />
                            <span className="relative w-fit font-medium text-white/90 group-hover:text-white tracking-wide leading-normal ml-3">
                              Continue with LinkedIn
                            </span>
                          </Button>
                        </motion.div>
                      </motion.div>

                      {/* Refined divider */}
                      <motion.div
                        className="relative w-full flex items-center py-2"
                        variants={itemVariants}
                      >
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="font-medium text-white/40 px-4 text-xs uppercase tracking-wider">
                          or
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form - Modern minimalist inputs */}
                <motion.form
                  onSubmit={handleSubmit}
                  className="flex flex-col items-center relative w-full space-y-4"
                  variants={itemVariants}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={showForgotPassword ? "forgot-form" : isSignUp ? "signup-form" : "signin-form"}
                      className="w-full space-y-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Email Field - Minimal glass design */}
                      <motion.div
                        className="w-full group"
                        whileHover={{ scale: 1.002 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <div className="flex w-full items-center relative bg-white/[0.02] border border-white/10 hover:border-[#1dff00]/30 focus-within:border-[#1dff00]/50 focus-within:bg-white/[0.04] backdrop-blur-sm transition-all duration-300 h-14 px-4 rounded-xl group">
                          <MailIcon className="text-white/40 group-hover:text-white/60 group-focus-within:text-[#1dff00]/80 transition-colors flex-shrink-0 w-5 h-5" />
                          <Input
                            variant="transparent"
                            inputSize="lg"
                            className="border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 p-0 h-auto ml-3"
                            type="email"
                            placeholder="Email address"
                            name="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            autoComplete="email"
                            inputMode="email"
                            aria-invalid={!emailValid && formData.email.length > 0}
                          />
                        </div>
                        {formData.email.length > 0 && !emailValid && (
                          <motion.div 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 text-xs text-red-400/90 flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Enter a valid email address
                          </motion.div>
                        )}
                      </motion.div>

                      {/* Password Field - Minimal glass design */}
                      {!showForgotPassword && (
                        <motion.div
                          className="w-full group"
                          whileHover={{ scale: 1.002 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <div className="flex w-full items-center relative bg-white/[0.02] border border-white/10 hover:border-[#1dff00]/30 focus-within:border-[#1dff00]/50 focus-within:bg-white/[0.04] backdrop-blur-sm transition-all duration-300 h-14 px-4 rounded-xl">
                            <LockKeyholeIcon className="text-white/40 group-hover:text-white/60 group-focus-within:text-[#1dff00]/80 transition-colors flex-shrink-0 w-5 h-5" />
                            <Input
                              variant="transparent"
                              inputSize="lg"
                              className="border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 p-0 h-auto flex-1 ml-3"
                              type={showPassword ? "text" : "password"}
                              placeholder="Password"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              required
                              autoComplete={isSignUp ? "new-password" : "current-password"}
                              aria-invalid={isSignUp && !showForgotPassword ? !passwordCheck.valid && formData.password.length > 0 ? true : false : false}
                              aria-describedby={isSignUp ? "password-strength" : undefined}
                              onKeyUp={(e) => {
                                const caps = (e as any).getModifierState?.("CapsLock");
                                if (typeof caps === "boolean") setCapsLockOn(caps);
                              }}
                            />
                            <motion.button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-white/40 hover:text-white/80 transition-colors duration-200 flex-shrink-0 ml-2"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? (
                                <EyeOff className="w-4.5 h-4.5" />
                              ) : (
                                <Eye className="w-4.5 h-4.5" />
                              )}
                            </motion.button>
                          </div>
                          {capsLockOn && (
                            <motion.div 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-2 text-xs text-yellow-400/90 flex items-center gap-1.5"
                            >
                              ⚠️ Caps Lock is on
                            </motion.div>
                          )}
                        </motion.div>
                      )}

                      {/* Confirm Password Field (Sign Up Only) - Modern design */}
                      {isSignUp && !showForgotPassword && (
                        <motion.div
                          className="w-full group"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex w-full items-center relative bg-white/[0.02] border border-white/10 hover:border-[#1dff00]/30 focus-within:border-[#1dff00]/50 focus-within:bg-white/[0.04] backdrop-blur-sm transition-all duration-300 h-14 px-4 rounded-xl">
                            <LockKeyholeIcon className="text-white/40 group-hover:text-white/60 group-focus-within:text-[#1dff00]/80 transition-colors flex-shrink-0 w-5 h-5" />
                            <Input
                              variant="transparent"
                              inputSize="lg"
                              className="border-0 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 p-0 h-auto ml-3"
                              type="password"
                              placeholder="Confirm Password"
                              name="confirmPassword"
                              value={formData.confirmPassword}
                              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                              required
                              autoComplete="new-password"
                              aria-invalid={isSignUp && formData.confirmPassword.length > 0 ? formData.confirmPassword !== formData.password : false}
                            />
                          </div>
                          {/* Enhanced password strength indicator */}
                          {formData.password.length > 0 && (
                            <motion.div 
                              className="mt-4 space-y-3 p-4 rounded-xl bg-black/20 border border-white/5"
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              id="password-strength"
                            >
                              {/* Refined strength meter */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-white/60">Password Strength</span>
                                  <span className={`font-semibold ${passwordCheck.score >= 4 ? "text-[#1dff00]" : passwordCheck.score >= 3 ? "text-yellow-400" : "text-red-400"}`}>
                                    {passwordCheck.strength}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                                  <motion.div
                                    className={`h-full transition-all duration-500 ${
                                      passwordCheck.score >= 4 
                                        ? 'bg-gradient-to-r from-[#1dff00] to-[#0a8246]'
                                        : passwordCheck.score >= 3
                                        ? 'bg-yellow-400'
                                        : 'bg-red-400'
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(passwordCheck.score / 5) * 100}%` }}
                                  />
                                </div>
                              </div>
                              
                              {/* Requirements checklist - Clean grid */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {[
                                  { ok: passwordCheck.lengthOk, label: "8+ characters" },
                                  { ok: passwordCheck.hasUpper, label: "Uppercase" },
                                  { ok: passwordCheck.hasLower, label: "Lowercase" },
                                  { ok: passwordCheck.hasNumber, label: "Number" },
                                  { ok: passwordCheck.hasSymbol, label: "Symbol" },
                                  { ok: passwordCheck.noSpaces, label: "No spaces" },
                                ].map((r, i) => (
                                  <motion.div 
                                    key={i} 
                                    className="flex items-center gap-2"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                  >
                                    {r.ok ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1dff00]" />
                                    ) : (
                                      <div className="w-3.5 h-3.5 rounded-full border border-white/20" />
                                    )}
                                    <span className={r.ok ? "text-white/80" : "text-white/40"}>{r.label}</span>
                                  </motion.div>
                                ))}
                              </div>
                              
                              {!passwordCheck.notEmail && formData.email && (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="flex items-center gap-2 text-xs text-red-400/90 pt-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Don't use your email in your password</span>
                                </motion.div>
                              )}
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                      
                      {/* Forgot Password Link - Minimal design */}
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
                            className="text-[#1dff00] p-0 h-auto font-medium hover:text-[#1dff00]/80 transition-colors duration-200 text-sm"
                          >
                            Forgot password?
                          </Button>
                        </motion.div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Submit Button - Refined design */}
                  <motion.div
                    className="w-full"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button
                      type="submit"
                      aria-busy={submitting}
                      className="w-full flex items-center justify-center gap-2.5 relative h-14 text-base rounded-xl font-semibold bg-gradient-to-r from-[#1dff00] to-[#0a8246] hover:from-[#1dff00] hover:to-[#1dff00] text-black shadow-[0_0_20px_rgba(29,255,0,0.15)] hover:shadow-[0_0_30px_rgba(29,255,0,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={submitting || !emailValid || (isSignUp && !showForgotPassword && !passwordCheck.valid)}
                    >
                      {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
                      <span>
                        {showForgotPassword
                          ? "Send Reset Link"
                          : isSignUp
                          ? "Create Account"
                          : "Sign In"}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </motion.div>
                </motion.form>

                {/* Bottom Links - Minimal design */}
                <motion.div
                  className="relative w-full text-center font-medium text-sm"
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
                          className="text-white/60 p-0 h-auto font-medium hover:text-white/90 transition-colors duration-200"
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
                        className="flex items-center justify-center gap-2"
                      >
                        <span className="text-white/60">
                          {isSignUp ? "Already have an account?" : "Don't have an account?"}
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setIsSignUp(!isSignUp)}
                          className="text-[#1dff00] p-0 h-auto font-semibold hover:text-[#1dff00]/80 transition-colors duration-200"
                        >
                          {isSignUp ? "Sign in" : "Create account"}
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

      {/* Signup Verify Modal */}
      <Modal
        open={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        title="Verify your email"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-white/80 text-sm">
            We sent a verification link to <span className="text-white font-medium">{formData.email || "your email"}</span>.
            Please check your inbox and click the link to activate your account.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              className="flex-1 bg-white/10 hover:bg-white/20 text-white"
              onClick={openEmailApp}
            >
              Open email app
            </Button>
            <Button
              variant="ghost"
              className="flex-1 border border-[#1dff00]/30 hover:bg-white/10 text-white"
              disabled={resending}
              onClick={handleResendVerification}
            >
              {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resending ? "Resending..." : "Resend link"}
            </Button>
          </div>
          <div className="pt-2">
            <Button
              className="w-full bg-[linear-gradient(270deg,rgba(29,255,0,1)_0%,rgba(10,130,70,1)_85%)] text-white"
              onClick={() => {
                setShowVerifyModal(false);
                navigate(ROUTES.SIGNIN);
              }}
            >
              Go to login
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};