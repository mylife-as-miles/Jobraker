import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabaseClient";

type Pending = {
  id: string;
  job_title: string | null;
  company: string | null;
  app_url: string | null;
  failure_reason: string | null;
  questions: Array<{ key?: string; query?: string }> | null;
};

const DISMISS_KEY = "jobraker.pendingQuestions.dismissedAt";
const DISMISS_MS = 6 * 60 * 60 * 1000;
const POLL_MS = 60_000;

const questionsOf = (p: Pending): string[] => {
  const fromProvider = (Array.isArray(p.questions) ? p.questions : [])
    .map((q) => String(q?.query ?? "").trim())
    .filter(Boolean);
  if (fromProvider.length) return fromProvider;
  const reason = String(p.failure_reason ?? "").replace(/^Action required:\s*/i, "").trim();
  return reason && !/^[a-z_]+$/.test(reason) ? [reason] : [];
};

// Pops up when auto-apply runs stopped to ask the user something. Answers are
// saved to the Answer bank and the application runs again with them.
export function PendingQuestionsPrompt() {
  const supabase = createClient();
  const [pending, setPending] = useState<Pending[]>([]);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "answer" | "skip">(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await (supabase as any)
      .from("applications")
      .select("id, job_title, company, app_url, failure_reason, questions:provider_run_output->rtrvr_result->inputRequest->questions")
      .eq("provider_status", "waiting_for_user")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (loadError) return;
    const rows = ((data ?? []) as Pending[]).filter((p) => questionsOf(p).length > 0);
    setPending(rows);
    let dismissedAt = 0;
    try { dismissedAt = Number(sessionStorage.getItem(DISMISS_KEY) || 0); } catch { /* ignore */ }
    if (rows.length && Date.now() - dismissedAt > DISMISS_MS) setOpen(true);
    if (!rows.length) setOpen(false);
  }, [supabase]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const current = pending[0];
  const questions = current ? questionsOf(current) : [];

  useEffect(() => {
    setAnswers({});
    setError(null);
  }, [current?.id]);

  const submit = async (action: "answer" | "skip") => {
    if (!current) return;
    setBusy(action);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("answer-application-questions", {
        body: action === "skip"
          ? { applicationId: current.id, action: "skip" }
          : {
            applicationId: current.id,
            answers: questions.map((q) => ({ question: q, answer: answers[q] ?? "" })),
          },
      });
      if (invokeError || (data as any)?.error) {
        throw new Error((data as any)?.error || invokeError?.message || "Could not save your answer.");
      }
      setPending((prev) => prev.slice(1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your answer.");
    } finally {
      setBusy(null);
    }
  };

  const later = () => {
    try { sessionStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!current) return null;
  const allAnswered = questions.every((q) => (answers[q] ?? "").trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : later())}>
      <DialogContent overlayClassName='z-[10000]' className='z-[10000] w-[calc(100vw-1rem)] max-w-[560px] max-h-[calc(100dvh-1rem)] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {pending.length === 1 ? "An application needs your answer" : `${pending.length} applications need your answer`}
          </DialogTitle>
          <DialogDescription>
            <span className='font-medium text-foreground'>{current.job_title || "Application"}</span>
            {current.company ? ` at ${current.company}` : ""}. The employer asks something we do not have yet.
            Your answer is saved for future applications and this one runs again.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4 py-1'>
          {questions.map((q) => (
            <div key={q} className='flex flex-col gap-2'>
              <label className='text-sm font-medium' htmlFor={`pq-${current.id}-${q.slice(0, 24)}`}>{q}</label>
              <textarea
                id={`pq-${current.id}-${q.slice(0, 24)}`}
                rows={3}
                maxLength={2000}
                value={answers[q] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                className='w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:outline-none focus:border-brand/40'
              />
            </div>
          ))}
          {current.app_url ? (
            <a href={current.app_url} target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-1 text-xs text-brand hover:underline'>
              <ExternalLink className='h-3 w-3' aria-hidden /> Open the application page
            </a>
          ) : null}
          {error ? <p className='text-sm text-destructive' role='alert'>{error}</p> : null}
        </div>

        <DialogFooter className='flex-col-reverse gap-2 sm:flex-row'>
          <Button type='button' variant='ghost' onClick={later} disabled={busy !== null}>Later</Button>
          <Button type='button' variant='outline' onClick={() => void submit("skip")} disabled={busy !== null}>
            {busy === "skip" ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden /> : null}
            Skip this job
          </Button>
          <Button type='button' onClick={() => void submit("answer")} disabled={busy !== null || !allAnswered}>
            {busy === "answer" ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden /> : null}
            Save and apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
