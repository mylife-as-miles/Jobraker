import { LockKeyholeIcon, MailIcon, Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../../lib/supabaseClient";
import { ROUTES } from "../../routes";
import { validatePassword } from "../../utils/password";
import { useToast } from "../../components/ui/toast-provider";
import Modal from "../../components/ui/modal";
import { SelfSolvingCube } from "./components/SelfSolvingCube";

export const JobrackerSignup = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [isSignUp, setIsSignUp] = useState<boolean>(() => location.pathname !== ROUTES.SIGNIN);
  const [showPassword, setShowPassword] = useState(false);
  const [lastUsedProvider, setLastUsedProvider] = useState<string | null>(null);

  useEffect(() => {
    const savedProvider = localStorage.getItem("lastUsedProvider");
    if (savedProvider) {
      setLastUsedProvider(savedProvider);
    }
  }, []);

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
        localStorage.setItem("lastUsedProvider", provider);
        setLastUsedProvider(provider);
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
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;

        // Track session and enforce security settings
        if (signInData.session && signInData.user) {
          const { createActiveSession, enforceMaxSessions, logSecurityEvent, checkSecuritySettings } = await import('../../utils/sessionManagement');

          // Check security settings
          const securityCheck = await checkSecuritySettings(signInData.user.id);
          if (!securityCheck.allowed) {
            await supabase.auth.signOut();
            toastError('Login blocked', securityCheck.reason || 'Security policy violation');
            return;
          }

          // Create active session
          const expiresAt = signInData.session.expires_at
            ? new Date(signInData.session.expires_at * 1000)
            : undefined;
          await createActiveSession(signInData.user.id, signInData.session.access_token, expiresAt);

          // Enforce max concurrent sessions
          const { data: settings } = await supabase
            .from('security_settings')
            .select('max_concurrent_sessions')
            .eq('id', signInData.user.id)
            .maybeSingle();
          const maxSessions = settings?.max_concurrent_sessions || 5;
          await enforceMaxSessions(signInData.user.id, maxSessions);

          // Log login event
          await logSecurityEvent(
            signInData.user.id,
            'login',
            `User logged in from ${navigator.userAgent}`,
            'low'
          );
        }

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

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <div className="h-screen w-full flex bg-black overflow-hidden relative">

      {/* LEFT SIDE: Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col relative z-20 bg-black/80 backdrop-blur-sm lg:backdrop-blur-none border-r border-white/5 h-full">
        <div className="flex-1 flex flex-col justify-center overflow-y-auto py-6 px-4 sm:px-8 no-scrollbar">
          <div className="max-w-[320px] w-full mx-auto space-y-5">
            {/* Header / Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex items-center justify-center w-7 h-7 bg-[#1dff00] rounded-md shadow-[0_0_10px_rgba(29,255,0,0.4)]">
                  <Sparkles className="text-black w-3.5 h-3.5" strokeWidth={2.5} />
                </div>
                <span className="text-base font-bold tracking-tight text-white font-mono">JOBRAKER</span>
              </div>

              <h1 className="text-2xl font-bold text-white tracking-tight">
                {showForgotPassword ? "Reset Password" : isSignUp ? "Create Account" : "Welcome Back"}
              </h1>
              <p className="text-gray-400 text-xs">
                {showForgotPassword
                  ? "Enter your email to receive a reset link"
                  : isSignUp
                    ? "Start your autonomous job hunt today."
                    : "Login to manage your AI agent."}
              </p>
            </motion.div>

            {/* Social Login Buttons */}
            {!showForgotPassword && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="grid grid-cols-2 gap-2"
              >
                <Button
                  variant="ghost"
                  className="flex items-center justify-center h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all duration-300 group text-xs"
                  type="button"
                  disabled={submitting}
                  onClick={() => handleOAuth("google")}
                >
                  <img className="w-3.5 h-3.5 mr-2" alt="Google" src="/flat-color-icons-google.svg" />
                  <span className="text-white/80 group-hover:text-white font-medium">Google</span>
                </Button>

                <Button
                  variant="ghost"
                  className="flex items-center justify-center h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all duration-300 group text-xs"
                  type="button"
                  disabled={submitting}
                  onClick={() => handleOAuth("linkedin_oidc")}
                >
                  <img className="w-3.5 h-3.5 mr-2" alt="LinkedIn" src="/logos-linkedin-icon.svg" />
                  <span className="text-white/80 group-hover:text-white font-medium">LinkedIn</span>
                </Button>
              </motion.div>
            )}

            {/* Divider */}
            {!showForgotPassword && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative flex items-center py-1"
              >
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-3 text-gray-500 text-[10px] uppercase tracking-wider">Or continue with</span>
                <div className="flex-grow border-t border-white/10"></div>
              </motion.div>
            )}

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onSubmit={handleSubmit}
              className="space-y-3"
            >
              {/* Email */}
              <div className="space-y-0.5">
                <div className="relative group">
                  <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#1dff00] transition-colors w-3.5 h-3.5" />
                  <Input
                    inputSize="sm"
                    className="pl-11 h-9 bg-white/5 border-white/10 focus:border-[#1dff00]/50 focus:ring-0 text-white rounded-lg placeholder:text-gray-500 text-xs"
                    placeholder="name@example.com"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                {formData.email.length > 0 && !emailValid && (
                  <p className="text-[10px] text-red-400 pl-1 mt-0.5">Invalid email address</p>
                )}
              </div>

              {/* Password */}
              {!showForgotPassword && (
                <div className="space-y-0.5">
                  <div className="relative group">
                    <LockKeyholeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#1dff00] transition-colors w-3.5 h-3.5" />
                    <Input
                      inputSize="sm"
                      className="pl-11 pr-9 h-9 bg-white/5 border-white/10 focus:border-[#1dff00]/50 focus:ring-0 text-white rounded-lg placeholder:text-gray-500 text-xs"
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="bg-transparent absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password (Sign Up) */}
              {isSignUp && !showForgotPassword && (
                <div className="space-y-0.5">
                  <div className="relative group">
                    <LockKeyholeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#1dff00] transition-colors w-3.5 h-3.5" />
                    <Input
                      inputSize="sm"
                      className="pl-11 h-9 bg-white/5 border-white/10 focus:border-[#1dff00]/50 focus:ring-0 text-white rounded-lg placeholder:text-gray-500 text-xs"
                      placeholder="Confirm Password"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                  {/* Minimal Password Strength Indicator for Sign Up */}
                  {formData.password.length > 0 && (
                    <div className="pt-1.5 flex items-center gap-1.5 text-[10px]">
                      <div className={`flex-1 h-0.5 rounded-full ${passwordCheck.score >= 1 ? "bg-red-500" : "bg-white/10"}`} />
                      <div className={`flex-1 h-0.5 rounded-full ${passwordCheck.score >= 3 ? "bg-yellow-500" : "bg-white/10"}`} />
                      <div className={`flex-1 h-0.5 rounded-full ${passwordCheck.score >= 4 ? "bg-[#1dff00]" : "bg-white/10"}`} />
                      <span className="text-gray-400 ml-1">{passwordCheck.strength}</span>
                    </div>
                  )}
                </div>
              )}

              {!isSignUp && !showForgotPassword && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-gray-400 hover:text-[#1dff00] text-[10px] p-0 h-auto"
                  >
                    Forgot password?
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || (isSignUp && !showForgotPassword && !passwordCheck.valid)}
                className="w-full h-9 bg-[#1dff00] hover:bg-[#1dff00]/90 text-black font-semibold rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(29,255,0,0.2)] hover:shadow-[0_0_20px_rgba(29,255,0,0.3)] mt-1"
              >
                {submitting ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : (
                  <div className="flex items-center justify-center gap-1.5">
                    <span>{showForgotPassword ? "Send Reset Link" : isSignUp ? "Create Account" : "Sign In"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </Button>
            </motion.form>

            {/* Footer Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center pt-1"
            >
              {showForgotPassword ? (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowForgotPassword(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  ← Back to sign in
                </Button>
              ) : (
                <p className="text-gray-400 text-[11px] sm:text-xs">
                  {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="bg-transparent text-[#1dff00] hover:underline font-medium"
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </button>
                </p>
              )}
            </motion.div>
          </div>

          <div className="mt-8 text-center text-gray-600 text-[10px]">
            © 2024 JobRaker AI. All rights reserved.
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Immersive Visual */}
      <div className="hidden lg:block lg:w-1/2 relative bg-[#050505] overflow-hidden h-full">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(29,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(29,255,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />

        {/* 3D Self-Solving Cube */}
        <div className="absolute inset-0 flex items-center justify-center scale-110 translate-x-12 pointer-events-none">
          <SelfSolvingCube />
        </div>

        {/* Overlay Text */}
        <div className="absolute bottom-12 left-12 right-12 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#1dff00]/10 flex items-center justify-center border border-[#1dff00]/20 flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#1dff00]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Autonomous Applications</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  "JobRaker has completely transformed my job search. The AI agent applies to jobs while I sleep, ensuring I never miss an opportunity."
                </p>
              </div>
            </div>
          </motion.div>
        </div>
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
