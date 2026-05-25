import {
  LockKeyholeIcon,
  MailIcon,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { motion } from "framer-motion";
import { createClient } from "../../lib/supabaseClient";
import { captureClientEvent } from "../../lib/analytics";
import { Seo } from "@/components/seo/Seo";
import { ROUTES } from "../../routes";
import { AUTH_REDIRECTS } from "../../lib/authRedirects";
import { capturePendingReferralCodeFromSearch } from "../../lib/referralAttribution";
import { persistAttributionFromSearch } from "../../lib/utmAttribution";
import { validatePassword } from "../../utils/password";
import { useToast } from "../../components/ui/toast-provider";
import Modal from "../../components/ui/modal";
import { SelfSolvingCube } from "./components/SelfSolvingCube";
import { sanitizeTextValue } from "@/lib/inputSecurity";
import { logSecurityEvent } from "../../utils/sessionManagement";

function isAdminHost() {
  return window.location.hostname.startsWith("admin.");
}

function getPostSignInPath() {
  return isAdminHost() ? "/admin" : ROUTES.DASHBOARD;
}

function getOAuthRedirectUrl() {
  return isAdminHost()
    ? `${window.location.origin}/admin`
    : AUTH_REDIRECTS.dashboard();
}

export const JobrackerSignup = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = useMemo(() => createClient(), []);
  const turnstileSiteKey =
    import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
  const turnstileEnabled = turnstileSiteKey.length > 0;
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const { success, error: toastError } = useToast();
  const [isSignUp, setIsSignUp] = useState<boolean>(
    () => location.pathname !== ROUTES.SIGNIN,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [_lastUsedProvider, setLastUsedProvider] = useState<string | null>(
    null,
  );
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const selectedPlan = searchParams.get("plan")?.trim().toLowerCase() || null;
  const selectedBilling =
    searchParams.get("billing")?.trim().toLowerCase() || null;

  useEffect(() => {
    if (selectedPlan) {
      localStorage.setItem("selectedPlan", selectedPlan);
    }
    if (selectedBilling) {
      localStorage.setItem("selectedBilling", selectedBilling);
    }
  }, [selectedPlan, selectedBilling]);

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

  useEffect(() => {
    capturePendingReferralCodeFromSearch(location.search || "");
    persistAttributionFromSearch(location.search || "", location.pathname);
  }, [location.pathname, location.search]);

  useEffect(() => {
    captureClientEvent("signup_viewed", {
      auth_mode: isSignUp ? "signup" : "signin",
      signup_surface: "jobracker_signup",
      selected_plan: selectedPlan,
      billing_interval: selectedBilling,
    });
  }, [isSignUp, selectedBilling, selectedPlan]);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [resending, setResending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const passwordCheck = useMemo(
    () => validatePassword(formData.password, formData.email),
    [formData.password, formData.email],
  );
  const emailValid = useMemo(() => {
    const v = (formData.email || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }, [formData.email]);
  const captchaAction = showForgotPassword
    ? "password_reset"
    : isSignUp
      ? "sign_up"
      : "sign_in";

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  }, []);

  const ensureCaptchaToken = useCallback(() => {
    if (!turnstileEnabled || captchaToken) {
      return true;
    }

    toastError(
      "Complete the security check",
      "Please complete the CAPTCHA before continuing.",
    );
    return false;
  }, [captchaToken, toastError, turnstileEnabled]);

  useEffect(() => {
    setCaptchaToken(null);
  }, [captchaAction]);

  const handleOAuth = useCallback(
    async (provider: "google" | "linkedin_oidc") => {
      if (!ensureCaptchaToken()) {
        return;
      }

      try {
        setSubmitting(true);
        if (isSignUp) {
          captureClientEvent("signup_started", { auth_method: provider });
        }
        localStorage.setItem("lastUsedProvider", provider);
        setLastUsedProvider(provider);
        const authApi = (supabase as any).auth;
        const { error } = await authApi.signInWithOAuth({
          provider,
          options: {
            redirectTo: getOAuthRedirectUrl(),
            captchaToken,
          },
        });
        if (error) throw error;
      } catch (err: any) {
        console.error(`${provider} OAuth error:`, err);
        toastError(
          "Sign in failed",
          err?.message || `Failed to sign in with ${provider}`,
        );
      } finally {
        setSubmitting(false);
        resetCaptcha();
      }
    },
    [captchaToken, ensureCaptchaToken, resetCaptcha, supabase, toastError],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const sanitizedEmail = sanitizeTextValue(formData.email).value.trim();

      if (showForgotPassword) {
        if (!ensureCaptchaToken()) {
          return;
        }

        setSubmitting(true);
        const { error } = await supabase.auth.resetPasswordForEmail(
          sanitizedEmail,
          {
            redirectTo: AUTH_REDIRECTS.resetPassword(),
            captchaToken: captchaToken ?? undefined,
          },
        );
        if (error) throw error;
        success(
          "Reset link sent",
          "Please check your email to continue resetting your password.",
          5000,
        );
        setShowForgotPassword(false);
        return;
      }

      if (isSignUp) {
        if (formData.password !== formData.confirmPassword) {
          toastError("Passwords do not match", "Please confirm your password.");
          return;
        }
        if (!passwordCheck.valid) {
          toastError(
            "Weak password",
            "Please meet all password requirements before continuing.",
          );
          return;
        }

        if (!ensureCaptchaToken()) {
          return;
        }

        setSubmitting(true);
        captureClientEvent("signup_started", {
          auth_method: "email",
          signup_surface: "jobracker_signup",
          selected_plan: selectedPlan,
          billing_interval: selectedBilling,
        });
        const { error } = await supabase.auth.signUp({
          email: sanitizedEmail,
          password: formData.password,
          options: {
            emailRedirectTo: AUTH_REDIRECTS.signIn(),
            captchaToken: captchaToken ?? undefined,
          },
        });
        if (error) throw error;
        captureClientEvent("user_signed_up", {
          auth_method: "email",
          signup_surface: "jobracker_signup",
          selected_plan: selectedPlan,
          billing_interval: selectedBilling,
        });
        // Always require email verification; route to login
        // Show centered success modal with actions
        success(
          "Sign up successful",
          "We sent a verification link to your email.",
        );
        setShowVerifyModal(true);
      } else {
        if (!ensureCaptchaToken()) {
          return;
        }

        setSubmitting(true);
        const { data: signInData, error } =
          await supabase.auth.signInWithPassword({
            email: sanitizedEmail,
            password: formData.password,
            options: {
              captchaToken: captchaToken ?? undefined,
            },
          });
        if (error) throw error;
        captureClientEvent("user_signed_in", {
          auth_method: "email",
          signup_surface: "jobracker_signup",
        });

        // Track session and enforce security settings
        if (signInData.session && signInData.user) {
          const {
            createActiveSession,
            enforceMaxSessions,
            logSecurityEvent,
            checkSecuritySettings,
          } = await import("../../utils/sessionManagement");

          // Check security settings
          const securityCheck = await checkSecuritySettings(signInData.user.id);
          if (!securityCheck.allowed) {
            await logSecurityEvent(
              signInData.user.id,
              "login_blocked",
              `Login blocked: ${securityCheck.reason || "Security policy violation"}`,
              "medium"
            );
            await supabase.auth.signOut();
            toastError(
              "Login blocked",
              securityCheck.reason || "Security policy violation",
            );
            return;
          }

          // Create active session
          const expiresAt = signInData.session.expires_at
            ? new Date(signInData.session.expires_at * 1000)
            : undefined;
          await createActiveSession(
            signInData.user.id,
            signInData.session.access_token,
            expiresAt,
          );

          // Enforce max concurrent sessions
          const { data: settings } = await supabase
            .from("security_settings")
            .select("max_concurrent_sessions")
            .eq("id", signInData.user.id)
            .maybeSingle();
          const maxSessions = settings?.max_concurrent_sessions || 5;
          await enforceMaxSessions(signInData.user.id, maxSessions);

          // Log login event
          await logSecurityEvent(
            signInData.user.id,
            "login",
            `User logged in from ${navigator.userAgent}`,
            "low",
          );
        }

        navigate(getPostSignInPath());
      }
    } catch (error: any) {
      console.error("Supabase auth error:", error);
      const rawMessage = error?.message || String(error);
      let userFriendlyMessage = "An unexpected error occurred. Please try again.";

      if (rawMessage.includes("User already registered") || rawMessage.includes("already exists")) {
        userFriendlyMessage = "This email is already registered. Please sign in instead.";
      } else if (rawMessage.includes("Invalid login credentials") || rawMessage.includes("invalid claim") || rawMessage.includes("Invalid credentials")) {
        userFriendlyMessage = "Incorrect email or password. Please verify your credentials.";
      } else if (rawMessage.includes("Email not confirmed") || rawMessage.includes("Email verification required")) {
        userFriendlyMessage = "Please verify your email address before signing in. Check your inbox for the link.";
      } else if (rawMessage.includes("rate limit") || rawMessage.includes("too many requests")) {
        userFriendlyMessage = "Too many attempts. Please wait a few minutes before trying again.";
      } else if (rawMessage.includes("CAPTCHA") || rawMessage.includes("captcha")) {
        userFriendlyMessage = "Security verification failed. Please complete the CAPTCHA again.";
      } else if (rawMessage.length < 80) {
        userFriendlyMessage = rawMessage;
      }

      toastError(
        showForgotPassword ? "Reset failed" : "Authentication failed",
        userFriendlyMessage,
      );
    } finally {
      setSubmitting(false);
      if (turnstileEnabled) {
        resetCaptcha();
      }
    }
  };

  const handleResendVerification = async () => {
    try {
      setResending(true);
      const sanitizedEmail = sanitizeTextValue(formData.email).value.trim();
      const authAny = (supabase as any).auth;
      if (authAny && typeof authAny.resend === "function") {
        const { error } = await authAny.resend({
          type: "signup",
          email: sanitizedEmail,
          options: { emailRedirectTo: AUTH_REDIRECTS.signIn() },
        });
        if (error) throw error;
      }
      success("Verification email resent");
    } catch (e: any) {
      const rawMessage = e?.message || String(e);
      let userFriendlyMessage = "Failed to resend verification link. Please try again.";
      if (rawMessage.includes("rate limit") || rawMessage.includes("too many requests")) {
        userFriendlyMessage = "Too many requests. Please wait a few minutes before requesting another link.";
      } else if (rawMessage.length < 80) {
        userFriendlyMessage = rawMessage;
      }
      toastError("Resend failed", userFriendlyMessage);
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

  return (
    <div className='h-screen w-full flex bg-background overflow-hidden relative'>
      <Seo
        title={isSignUp ? "Create Your JobRaker Account" : "Sign In to JobRaker"}
        description={
          isSignUp
            ? "Create your JobRaker account to organize your search, draft tailored applications, and unlock guided scouting."
            : "Sign in to JobRaker to manage your search workflow, applications, and AI-assisted job materials."
        }
        path={isSignUp ? "/signup" : "/signIn"}
        noindex
      />
      {/* LEFT SIDE: Login Form */}
      <div className='w-full lg:w-1/2 flex flex-col relative z-20 bg-background/80 backdrop-blur-sm lg:backdrop-blur-none border-r border-foreground/5 h-full'>
        <div className='flex-1 flex flex-col justify-center overflow-y-auto py-6 px-4 sm:px-8 no-scrollbar'>
          <div className='max-w-[320px] w-full mx-auto space-y-5'>
            {/* Header / Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className='space-y-1'
            >
              <div className='flex items-center gap-2 mb-4'>
                <div className='relative flex items-center justify-center w-9 h-9 overflow-clip  rounded-md'>
                  <img
                    src='/logo/logo.jpeg'
                    alt='logo'
                    className='object-cover'
                  />
                </div>
                <span className='text-base font-bold tracking-tight text-foreground font-mono'>
                  JOBRAKER
                </span>
              </div>

              <h1 className='text-2xl font-bold text-foreground tracking-tight'>
                {showForgotPassword
                  ? "Reset Password"
                  : isSignUp
                    ? "Create Account"
                    : "Welcome Back"}
              </h1>
              <p className='text-foreground/80 text-xs'>
                {showForgotPassword
                  ? "Enter your email to receive a reset link"
                  : isSignUp
                    ? "Start your autonomous job hunt today."
                    : "Login to manage your AI agent."}
              </p>
            </motion.div>

            {isSignUp && selectedPlan && !showForgotPassword && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand/10 border border-brand/20 rounded-xl p-3 text-xs space-y-1 relative overflow-hidden"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Selected Plan:</span>
                  <span className="text-brand font-mono font-bold capitalize">{selectedPlan}</span>
                </div>
                <div className="text-foreground/75 text-[11px]">
                  {selectedPlan === "pro" && "1,200 credits/mo • Full AI Tailoring • On Autopilot"}
                  {selectedPlan === "basics" && "250 credits/mo • Tailoring & Drafts • 15 Auto-Applies"}
                  {selectedPlan === "ultimate" && "3,500 credits/mo • Scout Mode • Infinite Power"}
                  {selectedPlan === "free" && "10 credits/mo • Track Active Pipeline"}
                </div>
                <div className="text-[10px] text-foreground/50 border-t border-foreground/5 pt-1.5 mt-1">
                  14-day free trial • Cancel anytime • Zero risk
                </div>
              </motion.div>
            )}

            {isSignUp && !selectedPlan && !showForgotPassword && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-foreground/[0.02] border border-foreground/5 rounded-xl p-3 text-[11px] text-foreground/70 flex items-center justify-between"
              >
                <span>Recommended tier: <strong className="text-brand">Pro Plan</strong> (1,200 credits)</span>
                <button
                  type="button"
                  onClick={() => navigate("/pricing")}
                  className="text-brand hover:underline font-medium text-[10px]"
                >
                  View Plans
                </button>
              </motion.div>
            )}

            {turnstileEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.45 }}
                className='space-y-2'
              >
                <div className='rounded-xl border border-foreground/10 bg-foreground/5 p-3'>
                  <p className='text-[10px] uppercase tracking-[0.22em] text-gray-500'>
                    Security check
                  </p>
                  <div className='mt-2'>
                    <Turnstile
                      key={captchaAction}
                      ref={turnstileRef}
                      siteKey={turnstileSiteKey}
                      options={{
                        action: captchaAction,
                        size: "flexible",
                        theme: "dark",
                      }}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => {
                        setCaptchaToken(null);
                        toastError(
                          "Security check failed",
                          "We couldn't verify the CAPTCHA. Please try again.",
                        );
                      }}
                    />
                  </div>
                </div>
                <p className='text-[10px] text-foreground/50'>
                  Complete the CAPTCHA before signing in, signing up, or
                  requesting a password reset.
                </p>
              </motion.div>
            )}

            {/* Social Login Buttons */}
            {!showForgotPassword && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className='grid grid-cols-2 gap-2'
              >
                <Button
                  variant='ghost'
                  className='flex items-center justify-center h-9 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-lg transition-all duration-300 group text-xs'
                  type='button'
                  disabled={submitting || (turnstileEnabled && !captchaToken)}
                  onClick={() => handleOAuth("google")}
                >
                  <img
                    className='w-3.5 h-3.5 mr-2 invert dark:invert-0'
                    alt='Google'
                    src='/flat-color-icons-google.svg'
                  />
                  <span className='text-foreground/80 group-hover:text-foreground font-medium'>
                    Google
                  </span>
                </Button>

                <Button
                  variant='ghost'
                  className='flex items-center justify-center h-9 bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-lg transition-all duration-300 group text-xs'
                  type='button'
                  disabled={submitting || (turnstileEnabled && !captchaToken)}
                  onClick={() => handleOAuth("linkedin_oidc")}
                >
                  <img
                    className='w-3.5 h-3.5 mr-2 invert dark:invert-0'
                    alt='LinkedIn'
                    src='/logos-linkedin-icon.svg'
                  />
                  <span className='text-foreground/80 group-hover:text-foreground font-medium'>
                    LinkedIn
                  </span>
                </Button>
              </motion.div>
            )}

            {/* Divider */}
            {!showForgotPassword && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className='relative flex items-center py-1'
              >
                <div className='flex-grow border-t border-foreground/10'></div>
                <span className='flex-shrink-0 mx-3 text-gray-500 text-[10px] uppercase tracking-wider'>
                  Or continue with
                </span>
                <div className='flex-grow border-t border-foreground/10'></div>
              </motion.div>
            )}

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onSubmit={handleSubmit}
              className='space-y-3'
            >
              {/* Email */}
              <div className='space-y-0.5'>
                <div className='relative group'>
                  <MailIcon className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand transition-colors w-3.5 h-3.5' />
                  <Input
                    inputSize='sm'
                    className='pl-11 h-9 bg-foreground/5 border-foreground/10 focus:border-brand/50 focus:ring-0 text-foreground rounded-lg placeholder:text-gray-500 text-xs'
                    placeholder='name@example.com'
                    type='email'
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                {formData.email.length > 0 && !emailValid && (
                  <p className='text-[10px] text-brand pl-1 mt-0.5'>
                    Invalid email address
                  </p>
                )}
              </div>

              {/* Password */}
              {!showForgotPassword && (
                <div className='space-y-0.5'>
                  <div className='relative group'>
                    <LockKeyholeIcon className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand transition-colors w-3.5 h-3.5' />
                    <Input
                      inputSize='sm'
                      className='pl-11 pr-9 h-9 bg-foreground/5 border-foreground/10 focus:border-brand/50 focus:ring-0 text-foreground rounded-lg placeholder:text-gray-500 text-xs'
                      placeholder='Password'
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='bg-transparent absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-foreground transition-colors'
                    >
                      {showPassword ? (
                        <EyeOff className='w-3.5 h-3.5' />
                      ) : (
                        <Eye className='w-3.5 h-3.5' />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password (Sign Up) */}
              {isSignUp && !showForgotPassword && (
                <div className='space-y-0.5'>
                  <div className='relative group'>
                    <LockKeyholeIcon className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand transition-colors w-3.5 h-3.5' />
                    <Input
                      inputSize='sm'
                      className='pl-11 h-9 bg-foreground/5 border-foreground/10 focus:border-brand/50 focus:ring-0 text-foreground rounded-lg placeholder:text-gray-500 text-xs'
                      placeholder='Confirm Password'
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='bg-transparent absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-foreground transition-colors'
                    >
                      {showPassword ? (
                        <EyeOff className='w-3.5 h-3.5' />
                      ) : (
                        <Eye className='w-3.5 h-3.5' />
                      )}
                    </button>
                  </div>
                  {/* Upgraded Password Strength & Requirement Checklist */}
                  {formData.password.length > 0 && (
                    <div className="pt-2 space-y-1 bg-foreground/[0.02] border border-foreground/5 rounded-lg p-2.5">
                      <div className='flex items-center justify-between text-[10px] text-gray-400'>
                        <span>Password Strength: <strong>{passwordCheck.strength}</strong></span>
                        <span>{passwordCheck.score}/5</span>
                      </div>
                      <div className='flex items-center gap-1'>
                        <div className={`flex-1 h-1 rounded-full ${passwordCheck.score >= 1 ? "bg-brand" : "bg-foreground/10"}`} />
                        <div className={`flex-1 h-1 rounded-full ${passwordCheck.score >= 3 ? "bg-brand" : "bg-foreground/10"}`} />
                        <div className={`flex-1 h-1 rounded-full ${passwordCheck.score >= 4 ? "bg-brand" : "bg-foreground/10"}`} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] pt-1.5 border-t border-foreground/5 mt-1.5">
                        <div className={`flex items-center gap-1 ${passwordCheck.lengthOk ? "text-brand" : "text-foreground/45"}`}>
                          <span>{passwordCheck.lengthOk ? "✓" : "○"}</span> 8+ characters
                        </div>
                        <div className={`flex items-center gap-1 ${passwordCheck.hasUpper ? "text-brand" : "text-foreground/45"}`}>
                          <span>{passwordCheck.hasUpper ? "✓" : "○"}</span> Uppercase letter
                        </div>
                        <div className={`flex items-center gap-1 ${passwordCheck.hasNumber ? "text-brand" : "text-foreground/45"}`}>
                          <span>{passwordCheck.hasNumber ? "✓" : "○"}</span> One number
                        </div>
                        <div className={`flex items-center gap-1 ${passwordCheck.hasSymbol ? "text-brand" : "text-foreground/45"}`}>
                          <span>{passwordCheck.hasSymbol ? "✓" : "○"}</span> One symbol
                        </div>
                        <div className={`flex items-center gap-1 ${formData.password === formData.confirmPassword && formData.confirmPassword ? "text-brand" : "text-foreground/45"}`}>
                          <span>{formData.password === formData.confirmPassword && formData.confirmPassword ? "✓" : "○"}</span> Passwords match
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isSignUp && !showForgotPassword && (
                <div className='flex justify-end'>
                  <Button
                    type='button'
                    variant='link'
                    onClick={() => setShowForgotPassword(true)}
                    className='text-gray-400 hover:text-brand text-[10px] p-0 h-auto'
                  >
                    Forgot password?
                  </Button>
                </div>
              )}

              <Button
                type='submit'
                disabled={
                  submitting ||
                  (turnstileEnabled && !captchaToken) ||
                  (isSignUp &&
                    (!passwordCheck.valid ||
                      formData.password !== formData.confirmPassword))
                }
                className='w-full h-9 bg-brand hover:bg-brand/90 text-background font-semibold rounded-lg text-xs transition-all shadow-[0_0_15px_rgba(29,255,0,0.2)] hover:shadow-[0_0_20px_rgba(29,255,0,0.3)] mt-1'
              >
                {submitting ? (
                  <Loader2 className='animate-spin w-3.5 h-3.5' />
                ) : (
                  <div className='flex items-center text-foreground justify-center gap-1.5'>
                    <span>
                      {showForgotPassword
                        ? "Send Reset Link"
                        : isSignUp
                          ? "Create Account"
                          : "Sign In"}
                    </span>
                    <ArrowRight className='w-3.5 h-3.5' />
                  </div>
                )}
              </Button>
            </motion.form>

            {/* Footer Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className='text-center pt-1'
            >
              {showForgotPassword ? (
                <Button
                  type='button'
                  variant='link'
                  onClick={() => setShowForgotPassword(false)}
                  className='text-gray-400 hover:text-foreground text-xs'
                >
                  ← Back to sign in
                </Button>
              ) : (
                <p className='text-gray-400 text-[11px] sm:text-xs'>
                  {isSignUp
                    ? "Already have an account?"
                    : "Don't have an account?"}{" "}
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className='bg-transparent text-brand hover:underline font-medium'
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </button>
                </p>
              )}
            </motion.div>
          </div>

          <div className='mt-8 text-center text-gray-600 text-[10px]'>
            © 2026 JobRaker AI. All rights reserved.
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Immersive Visual */}
      <div className='hidden lg:block lg:w-1/2 relative bg-background overflow-hidden h-full'>
        {/* Background Grid */}
        <div className='absolute inset-0 bg-[linear-gradient(rgba(29,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(29,255,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,background_40%,transparent_80%)]' />

        {/* 3D Self-Solving Cube */}
        <div className='absolute inset-0 flex items-center justify-center scale-110 translate-x-12 pointer-events-none'>
          <SelfSolvingCube />
        </div>

        {/* Overlay Text */}
        <div className='absolute bottom-12 left-12 right-12 z-10'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className='bg-background/40 backdrop-blur-md border border-foreground/10 p-6 rounded-2xl'
          >
            <div className='flex items-start gap-4'>
              <div className='w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center border border-brand/20 flex-shrink-0'>
                <CheckCircle2 className='w-5 h-5 text-brand' />
              </div>
              <div>
                <h3 className='text-foreground font-bold text-lg mb-1'>
                  Autonomous Applications
                </h3>
                <p className='text-gray-400 text-sm leading-relaxed'>
                  "JobRaker has completely transformed my job search. The AI
                  agent applies to jobs while I sleep, ensuring I never miss an
                  opportunity."
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
        title='Verify your email'
        size='sm'
      >
        <div className='space-y-4'>
          <p className='text-foreground/80 text-sm'>
            We sent a verification link to{" "}
            <span className='text-foreground font-medium'>
              {formData.email || "your email"}
            </span>
            . Please check your inbox and click the link to activate your
            account.
          </p>
          <div className='flex flex-col sm:flex-row gap-2 sm:gap-3'>
            <Button
              className='flex-1 bg-foreground/10 hover:bg-foreground/20 text-foreground'
              onClick={openEmailApp}
            >
              Open email app
            </Button>
            <Button
              variant='ghost'
              className='flex-1 border border-brand/30 hover:bg-foreground/10 text-foreground'
              disabled={resending}
              onClick={handleResendVerification}
            >
              {resending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {resending ? "Resending..." : "Resend link"}
            </Button>
          </div>
          <div className='pt-2'>
            <Button
              className='w-full bg-[linear-gradient(270deg,rgba(29,255,0,1)_0%,rgba(29,255,0,1)_85%)] text-foreground'
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
