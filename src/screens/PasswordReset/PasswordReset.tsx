import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../../lib/supabaseClient";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { motion } from "framer-motion";
import { validatePassword } from "../../utils/password";
import { CheckCircle2, XCircle } from "lucide-react";

const PasswordReset = () => {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const check = useMemo(() => validatePassword(password), [password]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setHasSession(!!session);
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!check.valid) {
      alert("Please choose a stronger password that meets all requirements.");
      return;
    }
    if (password !== confirm) {
      alert("Passwords do not match");
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      alert("Password updated. You are now signed in.");
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Password update error:", err);
      alert(err?.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen bg-background flex items-center justify-center px-4'>
      <div className='w-full max-w-sm sm:max-w-md lg:max-w-lg'>
        <div className='relative'>
          <div className='absolute inset-0 bg-gradient-to-r from-brand/20 via-transparent to-brand/20 opacity-50 rounded-xl sm:rounded-2xl' />
          <Card className='relative bg-foreground/5 border border-foreground/10 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-[18px]'>
            <CardContent className='p-4 sm:p-6 lg:p-8'>
              {loading ? (
                <p className='text-foreground/80 text-center'>
                  Preparing reset…
                </p>
              ) : hasSession ? (
                <form onSubmit={handleUpdate} className='space-y-4'>
                  <h2 className='text-foreground font-bold text-lg sm:text-xl'>
                    Set a new password
                  </h2>
                  <div className='space-y-3'>
                    <div className='border border-foreground/20 rounded-xl px-4 py-3'>
                      <Input
                        type='password'
                        placeholder='New password'
                        variant='transparent'
                        inputSize='lg'
                        className='bg-transparent text-foreground placeholder:text-foreground/70 border-0 focus-visible:ring-0'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className='border border-foreground/20 rounded-xl px-4 py-3'>
                      <Input
                        type='password'
                        placeholder='Confirm new password'
                        variant='transparent'
                        inputSize='lg'
                        className='bg-transparent text-foreground placeholder:text-foreground/70 border-0 focus-visible:ring-0'
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                    </div>
                    <div className='space-y-2 text-xs sm:text-sm'>
                      <div className='flex items-center justify-between'>
                        <span className='text-foreground/80'>Strength</span>
                        <span
                          className={`font-semibold ${check.score >= 4 ? "text-brand" : check.score >= 3 ? "text-brand" : "text-brand"}`}
                        >
                          {check.strength}
                        </span>
                      </div>
                      <div className='grid grid-cols-2 gap-2 text-foreground/80'>
                        {[
                          { ok: check.lengthOk, label: "8+ characters" },
                          { ok: check.hasUpper, label: "Uppercase letter" },
                          { ok: check.hasLower, label: "Lowercase letter" },
                          { ok: check.hasNumber, label: "Number" },
                          { ok: check.hasSymbol, label: "Symbol" },
                          { ok: check.noSpaces, label: "No spaces" },
                        ].map((r, i) => (
                          <div key={i} className='flex items-center gap-2'>
                            {r.ok ? (
                              <CheckCircle2 className='w-4 h-4 text-brand' />
                            ) : (
                              <XCircle className='w-4 h-4 text-brand' />
                            )}
                            <span
                              className={
                                r.ok
                                  ? "text-foreground/90"
                                  : "text-foreground/60"
                              }
                            >
                              {r.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type='submit'
                      disabled={
                        submitting || !check.valid || password !== confirm
                      }
                      className='w-full shadow-[0px_3px_14px_#00000040] bg-[linear-gradient(270deg,rgba(29,255,0,1)_0%,rgba(29,255,0,1)_85%)] text-foreground font-bold rounded-xl disabled:opacity-60'
                    >
                      Update Password
                    </Button>
                  </motion.div>
                </form>
              ) : (
                <div className='space-y-4 text-center'>
                  <h2 className='text-foreground font-bold text-lg sm:text-xl'>
                    Reset link expired or invalid
                  </h2>
                  <p className='text-foreground/70'>
                    Request a new reset link and try again.
                  </p>
                  <Button
                    onClick={() => navigate("/login")}
                    className='bg-foreground/15 hover:bg-foreground/25 text-foreground rounded-xl'
                  >
                    Go to Login
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PasswordReset;
