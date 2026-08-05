import {
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Key,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

function SixDigitOtpInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = useMemo(() => {
    const chars = value.split("");
    return Array.from({ length: 6 }, (_, i) => chars[i] || "");
  }, [value]);

  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const next = digits.slice();
      next[index] = "";
      const updated = next.join("");
      onChange(updated);
      return;
    }

    if (clean.length > 1) {
      const pasted = clean.slice(0, 6);
      onChange(pasted);
      if (pasted.length === 6) {
        inputsRef.current[5]?.focus();
        if (onComplete) onComplete(pasted);
      } else {
        inputsRef.current[pasted.length]?.focus();
      }
      return;
    }

    const next = digits.slice();
    next[index] = clean;
    const updated = next.join("");
    onChange(updated);

    if (index < 5 && clean) {
      inputsRef.current[index + 1]?.focus();
    }
    if (updated.length === 6 && onComplete) {
      onComplete(updated);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      inputsRef.current[Math.min(pasted.length, 5)]?.focus();
      if (pasted.length === 6 && onComplete) {
        onComplete(pasted);
      }
    }
  };

  return (
    <div className='flex justify-center gap-2 sm:gap-3 py-2'>
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          maxLength={6}
          disabled={disabled}
          value={digits[idx]}
          onChange={(e) => handleDigitChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all outline-none bg-card text-foreground shadow-sm",
            digits[idx]
              ? "border-brand bg-brand/5 shadow-brand/10"
              : "border-border/60 focus:border-brand/70 focus:ring-2 focus:ring-brand/20",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        />
      ))}
    </div>
  );
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

  // 2FA Challenge Modal State
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [pendingAuthSession, setPendingAuthSession] = useState<{
    userId: string;
    session: any;
  } | null>(null);

  const requiresMfaChallenge = useCallback(async () => {
    const { data, error } = await (supabase as any).auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data?.currentLevel !== "aal2" && data?.nextLevel === "aal2";
  }, [supabase]);

  const beginMfaChallenge = useCallback(async (userId: string, session: any) => {
    const { data: mfaFactors, error } = await (supabase as any).auth.mfa.listFactors();
    if (error) throw error;
    const verifiedTotp = ((mfaFactors?.totp ?? []) as Array<{ id: string; status: string }>).find(
      (factor) => factor.status === "verified",
    );
    if (!verifiedTotp) {
      await supabase.auth.signOut();
      throw new Error("Two-factor authentication is enabled, but no verified authenticator was found. Please contact support.");
    }
    setMfaFactorId(verifiedTotp.id);
    setPendingAuthSession({ userId, session });
    setShowMfaModal(true);
  }, [supabase]);

  const handleVerifyMfaChallenge = async (codeToVerify?: string) => {
    const code = (useBackupCode ? backupCodeInput : (codeToVerify || mfaCode)).trim();
    if (!code || !pendingAuthSession) return;
    setMfaVerifying(true);
    setMfaError(null);
    try {
      if (useBackupCode) {
        const encoder = new TextEncoder();
        const buf = await crypto.subtle.digest("SHA-256", encoder.encode(code.toUpperCase()));
        const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

        const { data: codeMatch, error: matchError } = await (supabase as any)
          .from("security_backup_codes")
          .select("id, used")
          .eq("user_id", pendingAuthSession.userId)
          .eq("code_hash", hex)
          .eq("used", false)
          .maybeSingle();

        if (matchError || !codeMatch) {
          throw new Error("Invalid or previously used emergency backup code.");
        }

        await (supabase as any)
          .from("security_backup_codes")
          .update({ used: true, used_at: new Date().toISOString() })
          .eq("id", codeMatch.id);
      } else {
        if (!mfaFactorId) {
          throw new Error("2FA Factor ID missing. Please sign in again.");
        }
        const { error } = await (supabase as any).auth.mfa.challengeAndVerify({
          factorId: mfaFactorId,
          code,
        });
        if (error) throw error;
      }

      const {
        data: { session: elevatedSession },
      } = await supabase.auth.getSession();
      const verifiedSession = elevatedSession ?? pendingAuthSession.session;
      if (!verifiedSession?.access_token) {
        throw new Error("Your verified session could not be refreshed. Please sign in again.");
      }

      const {
        createActiveSession,
        enforceMaxSessions,
        logSecurityEvent,
      } = await import("../../utils/sessionManagement");

      const expiresAt = verifiedSession?.expires_at
        ? new Date(verifiedSession.expires_at * 1000)
        : undefined;

      await createActiveSession(
        pendingAuthSession.userId,
        verifiedSession.access_token,
        expiresAt,
      );

      const { data: settings } = await supabase
        .from("security_settings")
        .select("max_concurrent_sessions")
        .eq("id", pendingAuthSession.userId)
        .maybeSingle();
      const maxSessions = settings?.max_concurrent_sessions || 5;
      await enforceMaxSessions(pendingAuthSession.userId, maxSessions);

      await logSecurityEvent(
        pendingAuthSession.userId,
        "login",
        `User logged in via 2FA/MFA verification from ${navigator.userAgent}`,
        "low",
      );

      setShowMfaModal(false);
      navigate(getPostSignInPath());
    } catch (err: any) {
      console.error("MFA challenge verification error:", err);
      setMfaError(err?.message || "Verification failed. Check your 2FA code.");
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleCancelMfa = async () => {
    setShowMfaModal(false);
    setPendingAuthSession(null);
    setMfaCode("");
    setMfaError(null);
    setUseBackupCode(false);
    setBackupCodeInput("");
    try {
      await supabase.auth.signOut();
    } catch {}
  };
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

          if (await requiresMfaChallenge()) {
            await beginMfaChallenge(signInData.user.id, signInData.session);
            setSubmitting(false);
            return; // Intercept sign-in with 2FA Challenge Modal
          }

          // Create active session if 2FA not required/active
          const {
            createActiveSession,
            enforceMaxSessions,
          } = await import("../../utils/sessionManagement");

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
    if (!ensureCaptchaToken()) {
      return;
    }

    try {
      setResending(true);
      const sanitizedEmail = sanitizeTextValue(formData.email).value.trim();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: sanitizedEmail,
        options: {
          emailRedirectTo: AUTH_REDIRECTS.signIn(),
          captchaToken: captchaToken ?? undefined,
        },
      });
      if (error) throw error;
      success("Verification email resent");
    } catch (e: any) {
      const rawMessage = e?.message || String(e);
      let userFriendlyMessage = "Failed to resend verification link. Please try again.";
      if (rawMessage.includes("rate limit") || rawMessage.includes("too many requests")) {
        userFriendlyMessage = "Too many requests. Please wait a few minutes before requesting another link.";
      } else if (rawMessage.includes("CAPTCHA") || rawMessage.includes("captcha")) {
        userFriendlyMessage = "Security verification expired. Please complete the CAPTCHA again.";
      } else if (rawMessage.length < 80) {
        userFriendlyMessage = rawMessage;
      }
      toastError("Resend failed", userFriendlyMessage);
    } finally {
      setResending(false);
      if (turnstileEnabled) {
        resetCaptcha();
      }
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
    <div className='min-h-svh w-full grid grid-cols-1 bg-background text-foreground lg:grid-cols-[minmax(440px,1fr)_1.2fr]'>
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
      <div className='relative z-20 flex min-h-svh items-center justify-center bg-background px-6 py-12 lg:px-12'>
        <div className='w-full max-w-sm space-y-6'>
            {/* Header / Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className='space-y-1'
            >
              <div className='mb-12 flex items-center gap-2'>
                <div className='relative flex h-7 w-7 items-center justify-center overflow-clip rounded-md ring-1 ring-foreground/10'>
                  <img
                    src='/logo/logo.jpeg'
                    alt='logo'
                    className='object-cover'
                  />
                </div>
                <span className='font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground'>
                  JobRaker
                </span>
              </div>

              <h1 className='text-3xl font-semibold tracking-tight text-foreground'>
                {showForgotPassword
                  ? "Reset Password"
                  : isSignUp
                    ? "Create Account"
                    : "Sign in"}
              </h1>
              <p className='mt-2 text-sm text-muted-foreground'>
                {showForgotPassword
                  ? "Enter your email to receive a reset link"
                  : isSignUp
                    ? "Start your autonomous job hunt today."
                    : "Welcome back. Continue where you left off."}
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
                className='grid grid-cols-2 gap-3'
              >
                <Button
                  variant='ghost'
                  className='flex h-11 items-center justify-center rounded-md border border-border/60 bg-background text-sm font-medium text-foreground transition-[background-color,border-color,transform] hover:bg-foreground/[0.04] active:scale-[0.98]'
                  type='button'
                  disabled={submitting || (turnstileEnabled && !captchaToken)}
                  onClick={() => handleOAuth("google")}
                >
                  <img
                    className='mr-2 h-4 w-4 dark:invert-0'
                    alt='Google'
                    src='/flat-color-icons-google.svg'
                  />
                  <span>
                    Google
                  </span>
                </Button>

                <Button
                  variant='ghost'
                  className='flex h-11 items-center justify-center rounded-md border border-border/60 bg-background text-sm font-medium text-foreground transition-[background-color,border-color,transform] hover:bg-foreground/[0.04] active:scale-[0.98]'
                  type='button'
                  disabled={submitting || (turnstileEnabled && !captchaToken)}
                  onClick={() => handleOAuth("linkedin_oidc")}
                >
                  <img
                    className='mr-2 h-4 w-4 dark:invert-0'
                    alt='LinkedIn'
                    src='/logos-linkedin-icon.svg'
                  />
                  <span>
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
                className='flex items-center gap-3 py-1'
              >
                <div className='flex-1 border-t border-border/60' />
                <span className='shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground'>
                  Or continue with
                </span>
                <div className='flex-1 border-t border-border/60' />
              </motion.div>
            )}

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onSubmit={handleSubmit}
              className='space-y-4'
            >
              {/* Email */}
              <div className='space-y-1.5'>
                <label htmlFor='auth-email' className='text-sm font-medium text-foreground'>
                  Email
                </label>
                <div className='relative'>
                  <Input
                    id='auth-email'
                    className='h-11 rounded-md border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/60 focus:ring-2 focus:ring-brand/15'
                    error={formData.email.length > 0 && !emailValid}
                    placeholder='you@example.com'
                    type='email'
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                {formData.email.length > 0 && !emailValid && (
                  <p key={formData.email} className='text-[10px] text-[#FF5C5C] font-semibold pl-1 mt-0.5 error-text-shake animate-shake-x'>
                    Please enter a valid email.
                  </p>
                )}
              </div>

              {/* Password */}
              {!showForgotPassword && (
                <div className='space-y-1.5'>
                  <label htmlFor='auth-password' className='text-sm font-medium text-foreground'>
                    Password
                  </label>
                  <div className='relative'>
                    <Input
                      id='auth-password'
                      className='h-11 rounded-md border-border/60 bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/60 focus:ring-2 focus:ring-brand/15'
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
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className='absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'
                    >
                      {showPassword ? (
                        <EyeOff className='h-4 w-4' />
                      ) : (
                        <Eye className='h-4 w-4' />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password (Sign Up) */}
              {isSignUp && !showForgotPassword && (
                <div className='space-y-1.5'>
                  <label htmlFor='auth-confirm-password' className='text-sm font-medium text-foreground'>
                    Confirm password
                  </label>
                  <div className='relative'>
                    <Input
                      id='auth-confirm-password'
                      className='h-11 rounded-md border-border/60 bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/60 focus:ring-2 focus:ring-brand/15'
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
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className='absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60'
                    >
                      {showPassword ? (
                        <EyeOff className='h-4 w-4' />
                      ) : (
                        <Eye className='h-4 w-4' />
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

              <Button
                type='submit'
                disabled={
                  submitting ||
                  (turnstileEnabled && !captchaToken) ||
                  (isSignUp &&
                    (!passwordCheck.valid ||
                      formData.password !== formData.confirmPassword))
                }
                className='mt-1 h-11 w-full rounded-md bg-brand text-sm font-semibold text-background shadow-[0_0_15px_rgba(47,217,104,0.2)] transition-[background-color,box-shadow,transform] hover:bg-brand/90 hover:shadow-[0_0_20px_rgba(47,217,104,0.3)] active:scale-[0.98]'
              >
                {submitting ? (
                  <Loader2 className='animate-spin w-3.5 h-3.5' />
                ) : (
                  <div className='flex items-center justify-center gap-1.5'>
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
              {!isSignUp && !showForgotPassword && (
                <div className='flex justify-center pt-1'>
                  <Button
                    type='button'
                    variant='link'
                    onClick={() => setShowForgotPassword(true)}
                    className='h-auto p-0 text-xs text-muted-foreground hover:text-brand'
                  >
                    Forgot password?
                  </Button>
                </div>
              )}
            </motion.form>

            {/* Footer Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className='pt-1 text-center'
            >
              {showForgotPassword ? (
                <Button
                  type='button'
                  variant='link'
                  onClick={() => setShowForgotPassword(false)}
                  className='text-xs text-muted-foreground hover:text-foreground'
                >
                  ← Back to sign in
                </Button>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  {isSignUp
                    ? "Already have an account?"
                    : "Don't have an account?"}{" "}
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className='bg-transparent font-medium text-brand hover:underline'
                  >
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </button>
                </p>
              )}
            </motion.div>

          <div className='pt-2 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground'>
            © 2026 JobRaker AI. All rights reserved.
          </div>
          </div>
        </div>

      {/* RIGHT SIDE: Immersive Visual */}
      <div className='relative hidden min-h-svh overflow-hidden border-l border-border/60 bg-background lg:block'>
        {/* Background Grid */}
        <div className='absolute inset-0 bg-[linear-gradient(rgba(47,217,104,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(47,217,104,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,background_40%,transparent_80%)]' />

        {/* 3D Self-Solving Cube */}
        <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
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
              disabled={resending || (turnstileEnabled && !captchaToken)}
              onClick={handleResendVerification}
            >
              {resending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {resending ? "Resending..." : "Resend link"}
            </Button>
          </div>
          <div className='pt-2'>
            <Button
              className='w-full bg-[linear-gradient(270deg,rgba(47,217,104,1)_0%,rgba(47,217,104,1)_85%)] text-foreground'
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

      {/* 2FA Verification Challenge Modal */}
      <Modal
        open={showMfaModal}
        onClose={handleCancelMfa}
        title='Two-Factor Authentication Required'
        size='md'
        side='center'
      >
        <div className='space-y-5 py-1'>
          <div className='flex items-center gap-3 p-3 rounded-xl border border-brand/30 bg-brand/5'>
            <ShieldCheck className='w-6 h-6 shrink-0 text-brand' aria-hidden />
            <div>
              <p className='text-sm font-semibold text-foreground'>
                Account Protected with 2FA
              </p>
              <p className='text-xs text-muted-foreground'>
                {useBackupCode
                  ? "Enter one of your emergency recovery backup codes."
                  : "Enter the 6-digit verification code from your authenticator app."}
              </p>
            </div>
          </div>

          {!useBackupCode ? (
            <SixDigitOtpInput
              value={mfaCode}
              onChange={(val) => {
                setMfaCode(val);
                setMfaError(null);
              }}
              onComplete={(code) => void handleVerifyMfaChallenge(code)}
              disabled={mfaVerifying}
            />
          ) : (
            <div className='space-y-2'>
              <label className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                Emergency Backup Code
              </label>
              <Input
                placeholder='e.g. A1B2C3D4'
                autoFocus
                value={backupCodeInput}
                onChange={(e) => {
                  setBackupCodeInput(e.target.value.toUpperCase().trim());
                  setMfaError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleVerifyMfaChallenge();
                }}
                className='h-12 rounded-xl border-border/60 bg-card font-mono text-center text-lg font-bold tracking-widest text-foreground focus:border-brand/70'
              />
            </div>
          )}

          {mfaError ? (
            <div className='flex items-center justify-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-center'>
              <AlertTriangle className='w-4 h-4 shrink-0' aria-hidden />
              <p className='text-xs font-medium'>{mfaError}</p>
            </div>
          ) : null}

          <div className='flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40'>
            <Button
              type='button'
              variant='link'
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setMfaError(null);
              }}
              className='text-xs text-brand hover:underline p-0 h-auto font-medium'
            >
              {useBackupCode
                ? "← Use Authenticator App Code"
                : "Use emergency backup code"}
            </Button>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                className='border-border/40 text-muted-foreground hover:text-foreground'
                onClick={() => void handleCancelMfa()}
                disabled={mfaVerifying}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleVerifyMfaChallenge()}
                disabled={
                  mfaVerifying ||
                  (useBackupCode
                    ? backupCodeInput.length < 6
                    : mfaCode.length < 6)
                }
                className='bg-brand text-black font-medium hover:bg-brand/90 shadow-md shadow-brand/10 disabled:opacity-50'
              >
                {mfaVerifying ? (
                  <RefreshCw className='w-4 h-4 mr-2 animate-spin' aria-hidden />
                ) : null}
                Verify & Sign In
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
