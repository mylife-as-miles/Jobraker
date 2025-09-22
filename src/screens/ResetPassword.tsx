import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../lib/supabaseClient";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useToast } from "../components/ui/toast-provider";

export const ResetPassword: React.FC = () => {
  const supabase = useMemo(() => createClient(), []);
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    if (!password || password !== confirm) {
      toastError("Invalid password", "Passwords must match.");
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
      toastError("Reset failed", err?.message || "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-black px-4">
      <Card className="w-full max-w-md bg-[#ffffff0d] border border-[#ffffff15] backdrop-blur-md rounded-xl">
        <CardContent className="p-6 space-y-4">
          <h1 className="text-white text-xl font-semibold">Reset password</h1>
          <p className="text-white/70 text-sm">Enter and confirm your new password.</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              variant="transparent"
              inputSize="lg"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              variant="transparent"
              inputSize="lg"
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <Button type="submit" disabled={submitting} className="w-full bg-[linear-gradient(270deg,rgba(29,255,0,1)_0%,rgba(10,130,70,1)_85%)] text-white">
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
