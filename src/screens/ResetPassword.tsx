import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../lib/supabaseClient";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useToast } from "../components/ui/toast-provider";
import { ErrorShake } from "../components/ui/ErrorShake";

export const ResetPassword: React.FC = () => {
  const supabase = useMemo(() => createClient(), []);
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // If the user is already authenticated (link consumed), consider redirect
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
    };
    check();
  }, [supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!password || password !== confirm) {
      const err = "Passwords must match.";
      setFormError(err);
      toastError("Invalid password", err);
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      success("Password updated", "You can now sign in with your new password.");
      navigate("/signIn", { replace: true });
    } catch (err: any) {
      console.error("Reset password error:", err);
      const errMsg = err?.message || "Please try again.";
      setFormError(errMsg);
      toastError("Reset failed", errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const hasMismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <Card className="w-full max-w-md bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl">
        <CardContent className="p-6 space-y-4">
          <h1 className="text-foreground text-xl font-semibold">Reset password</h1>
          <p className="text-foreground/70 text-sm">Enter and confirm your new password.</p>

          {formError && (
            <ErrorShake errorKey={formError} className="p-3 rounded-lg bg-red-500/10 border border-[#FF5C5C]/40">
              {formError}
            </ErrorShake>
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              variant="transparent"
              inputSize="lg"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFormError(null);
              }}
              error={hasMismatch || !!formError}
              required
            />
            <Input
              variant="transparent"
              inputSize="lg"
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setFormError(null);
              }}
              error={hasMismatch || !!formError}
              required
            />

            {hasMismatch && (
              <ErrorShake errorKey={confirm} as="p" className="pl-1">
                Passwords must match.
              </ErrorShake>
            )}

            <Button type="submit" disabled={submitting} className="w-full bg-[linear-gradient(270deg,rgba(47,217,104,1)_0%,rgba(47,217,104,1)_85%)] text-foreground">
              {submitting ? "Updating..." : "Update password"}
            </Button>
            <div className="text-center">
              <Button type="button" variant="link" onClick={() => navigate("/signIn")}>Back to sign in</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
