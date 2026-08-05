import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  FileText,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabaseClient";

type OnboardingProfile = {
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  location?: string | null;
} | null;

type OnboardingChecklistProps = {
  profile: OnboardingProfile;
  skillsCount: number;
  onNavigate: (path: string) => void;
};

type ChecklistTask = {
  id: "profile" | "skills" | "resume" | "matches" | "application";
  title: string;
  description: string;
  action: string;
  path: string;
  Icon: typeof UserRound;
  complete: boolean;
};

const storageKey = (userId: string, suffix: string) =>
  `jobraker:onboarding-checklist:${userId}:${suffix}`;

function readStoredBoolean(key: string) {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeStoredBoolean(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Local persistence is a convenience; the checklist still works without it.
  }
}

export function OnboardingChecklist({
  profile,
  skillsCount,
  onNavigate,
}: OnboardingChecklistProps) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [hasApplication, setHasApplication] = useState(false);
  const [hasViewedMatches, setHasViewedMatches] = useState(false);
  const [ready, setReady] = useState(false);

  const refreshProgress = useCallback(async (id: string) => {
    const [resumeResult, applicationResult] = await Promise.all([
      supabase.from("resumes").select("id").eq("user_id", id).limit(1),
      supabase.from("applications").select("id").eq("user_id", id).limit(1),
    ]);

    setHasResume((resumeResult.data?.length ?? 0) > 0);
    setHasApplication((applicationResult.data?.length ?? 0) > 0);
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const initialise = async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      if (!active) return;

      setUserId(id);
      if (!id) {
        setReady(true);
        return;
      }

      setCollapsed(readStoredBoolean(storageKey(id, "collapsed")));
      setDismissed(readStoredBoolean(storageKey(id, "dismissed")));
      setHasViewedMatches(readStoredBoolean(storageKey(id, "matches-viewed")));
      await refreshProgress(id);
      if (active) setReady(true);
    };

    void initialise();
    return () => {
      active = false;
    };
  }, [refreshProgress, supabase]);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => void refreshProgress(userId);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refreshProgress, userId]);

  const tasks = useMemo<ChecklistTask[]>(() => {
    const profileComplete = Boolean(
      profile?.first_name?.trim() &&
        profile?.last_name?.trim() &&
        profile?.job_title?.trim() &&
        profile?.location?.trim(),
    );

    return [
      {
        id: "profile",
        title: "Complete your profile",
        description: "Add your target role and location so Jobraker can personalise your search.",
        action: "Open profile",
        path: "/dashboard/profile",
        Icon: UserRound,
        complete: profileComplete,
      },
      {
        id: "skills",
        title: "Add your top skills",
        description: "Give every job match the experience it needs to assess your fit.",
        action: "Add skills",
        path: "/dashboard/profile?section=skills",
        Icon: Sparkles,
        complete: skillsCount > 0,
      },
      {
        id: "resume",
        title: "Upload your resume",
        description: "Use your strongest resume when you are ready to tailor an application.",
        action: "Add resume",
        path: "/dashboard/resume",
        Icon: FileText,
        complete: hasResume,
      },
      {
        id: "matches",
        title: "Review your job matches",
        description: "See roles aligned with your profile and save the ones worth pursuing.",
        action: "Find jobs",
        path: "/dashboard/jobs",
        Icon: BriefcaseBusiness,
        complete: hasViewedMatches,
      },
      {
        id: "application",
        title: "Track your first application",
        description: "Keep your job search organised from application to interview.",
        action: "View applications",
        path: "/dashboard/application",
        Icon: Send,
        complete: hasApplication,
      },
    ];
  }, [hasApplication, hasResume, hasViewedMatches, profile, skillsCount]);

  const completed = tasks.filter((task) => task.complete).length;
  const progress = Math.round((completed / tasks.length) * 100);

  const updateCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (userId) writeStoredBoolean(storageKey(userId, "collapsed"), next);
  };

  const dismiss = () => {
    setDismissed(true);
    if (userId) writeStoredBoolean(storageKey(userId, "dismissed"), true);
  };

  const handleTask = (task: ChecklistTask) => {
    if (task.id === "matches" && userId) {
      setHasViewedMatches(true);
      writeStoredBoolean(storageKey(userId, "matches-viewed"), true);
    }
    onNavigate(task.path);
  };

  if (!ready || dismissed || !userId) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="fixed bottom-24 left-3 right-3 z-40 sm:left-auto sm:right-6 sm:w-[360px]"
      aria-label="Jobraker setup checklist"
    >
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-[0_18px_48px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </div>
          <button
            type="button"
            onClick={updateCollapsed}
            className="min-w-0 flex-1 text-left"
            aria-expanded={!collapsed}
          >
            <p className="text-sm font-semibold text-foreground">Set up Jobraker</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {completed} of {tasks.length} steps complete
            </p>
          </button>
          <div className="relative h-10 w-10 shrink-0" aria-label={`${progress}% complete`}>
            <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" className="stroke-foreground/10" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                className="stroke-brand transition-[stroke-dasharray] duration-300"
                strokeWidth="3"
                strokeDasharray={`${(progress / 100) * 88} 88`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-foreground">
              {progress}%
            </span>
          </div>
          <button
            type="button"
            onClick={updateCollapsed}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            aria-label={collapsed ? "Expand setup checklist" : "Collapse setup checklist"}
          >
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <ul className="border-t border-border/50">
                {tasks.map((task) => (
                  <li key={task.id} className="border-b border-border/40 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => handleTask(task)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.025]"
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          task.complete
                            ? "bg-brand/15 text-brand"
                            : "border border-foreground/25 text-transparent"
                        }`}
                      >
                        {task.complete ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <Circle className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-medium ${task.complete ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {task.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {task.complete ? "Complete" : task.description}
                        </span>
                        {!task.complete && (
                          <span className="mt-1.5 inline-block text-xs font-medium text-brand">
                            {task.action}
                          </span>
                        )}
                      </span>
                      <task.Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/70" strokeWidth={1.8} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-foreground/[0.015] px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {completed === tasks.length ? "You are ready to go." : "Finish these when it suits you."}
                </p>
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Hide
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
