import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BULK_MAX_PER_EMPLOYER_30D, BULK_MIN_MATCH_SCORE, type BulkPlan, type BulkPlanItem } from "@/lib/bulkApplyPlan";
import type { ProfileAnswers } from "../../backend/supabase/shared/application-profile";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: BulkPlan | null;
  onConfirm: (jobIds: string[]) => void;
  // Saves answers to common questions into the application profile.
  onSaveProfile: (patch: ProfileAnswers) => Promise<void>;
  // Answers to job-specific questions: jobId -> question label -> answer.
  customAnswers: Record<string, Record<string, string>>;
  onCustomAnswerChange: (jobId: string, label: string, answer: string) => void;
};

// How each common question is answered inline. Country-based questions are
// edited on the profile page instead.
type Editor =
  | { kind: "text"; placeholder?: string; toValue: (v: string) => unknown }
  | { kind: "number"; toValue: (v: string) => unknown }
  | { kind: "yesno"; toValue: (v: boolean) => unknown }
  | { kind: "permission"; field: "consent" | "ai_motivation" | "future_openings"; text: string }
  | { kind: "profile" };

const textKey = (placeholder?: string): Editor => ({ kind: "text", placeholder, toValue: (v) => ({ text: v }) });
const yesNo = (field: string): Editor => ({ kind: "yesno", toValue: (v) => ({ [field]: v }) });

const EDITORS: Record<string, Editor> = {
  current_salary: textKey("For example: 40000 USD per year"),
  expected_salary: textKey("For example: 60000 USD per year"),
  how_heard: textKey("For example: Online job board"),
  education: textKey(),
  language: textKey("For example: English (fluent)"),
  employer_current: textKey(),
  title_current: textKey(),
  preferred_name: textKey(),
  pronouns: textKey(),
  accommodation: textKey("For example: None"),
  notice_period: { kind: "number", toValue: (v) => ({ days: Number(v), negotiable: false }) },
  years_experience: { kind: "number", toValue: (v) => ({ years: Number(v) }) },
  relocation: yesNo("willing"),
  onsite_hybrid: yesNo("willing"),
  security_clearance: yesNo("has"),
  non_compete: yesNo("bound"),
  background_check: yesNo("consent"),
  age_18: yesNo("over18"),
  government_official: yesNo("is"),
  employee_relationship: yesNo("has"),
  previously_employed: { kind: "text", placeholder: "All past employers, comma separated", toValue: (v) => ({ items: v.split(",").map((s) => s.trim()).filter(Boolean) }) },
  privacy_consent: { kind: "permission", field: "consent", text: "Tick standard privacy consent and \"information is true\" boxes for me" },
  truth_certification: { kind: "permission", field: "consent", text: "Tick standard privacy consent and \"information is true\" boxes for me" },
  why_company: { kind: "permission", field: "ai_motivation", text: "Let AI write short \"why this company\" answers from my resume" },
  future_openings_optin: { kind: "permission", field: "future_openings", text: "Say yes when employers ask to contact me about future openings" },
};
// Keys stored under a different profile key than the question key.
const PROFILE_KEY: Record<string, string> = { previously_employed: "past_employers" };

const inputClass =
  "w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:outline-none focus:border-brand/40";

function Row({ item, checked, onToggle }: { item: BulkPlanItem; checked: boolean; onToggle: () => void }) {
  return (
    <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-foreground/10 p-3 hover:border-brand/30'>
      <input type='checkbox' className='mt-1' checked={checked} onChange={onToggle} />
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-medium'>{item.title}</span>
        <span className='block truncate text-xs text-muted-foreground'>
          {item.company}
          {item.location ? ` · ${item.location}` : ""}
          {item.matchScore !== null ? ` · ${item.matchScore}% match` : ""}
        </span>
        <span className='mt-1 block text-xs'>
          {item.readiness === "ready" ? (
            <span className='text-brand'>Ready: no questions expected</span>
          ) : item.readiness === "needs" ? (
            <span className='text-amber-400' title={(item.missing ?? []).join(", ")}>
              Will ask {item.missing?.length ?? 0} {item.missing?.length === 1 ? "question" : "questions"}: {(item.missing ?? []).slice(0, 2).join(", ")}
              {(item.missing?.length ?? 0) > 2 ? "…" : ""}
            </span>
          ) : (
            <span className='text-muted-foreground'>Questions not published by this employer</span>
          )}
        </span>
        {item.reason ? <span className='mt-1 block text-xs text-amber-400'>{item.reason}</span> : null}
      </span>
    </label>
  );
}

// Shown before a bulk auto-apply: what will be submitted, what was skipped
// and why, and any questions to answer first so runs do not stop midway.
// Nothing is sent until the user confirms.
export function BulkApplyConfirmDialog({
  open,
  onOpenChange,
  plan,
  onConfirm,
  onSaveProfile,
  customAnswers,
  onCustomAnswerChange,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showSkipped, setShowSkipped] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset only when the dialog opens; the plan also changes as answers are saved.
  useEffect(() => {
    if (open && plan) {
      setChecked(new Set(plan.selected.map((j) => j.id)));
      setShowSkipped(false);
      setDrafts({});
      setSaveError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const all = useMemo(() => (plan ? [...plan.selected, ...plan.skipped] : []), [plan]);
  const chosen = all.filter((j) => checked.has(j.id));
  const companies = new Set(chosen.map((j) => j.company.toLowerCase())).size;

  // Common questions across the chosen jobs, and job-specific ones.
  const common = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const job of chosen) {
      for (const item of job.items ?? []) {
        if (!item.key) continue;
        const entry = map.get(item.key) ?? { label: item.label, count: 0 };
        entry.count += 1;
        map.set(item.key, entry);
      }
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v }));
  }, [chosen]);
  const specific = chosen.flatMap((job) => (job.items ?? []).filter((i) => !i.key).map((i) => ({ job, label: i.label })));
  const ready = chosen.filter((j) => j.readiness === "ready").length;

  const saveCommon = async () => {
    const patch: ProfileAnswers = {};
    const permissions: Record<string, boolean> = {};
    for (const { key } of common) {
      const editor = EDITORS[key];
      const draft = drafts[key];
      if (!editor || draft === undefined || draft === "") continue;
      if (editor.kind === "permission") {
        if (draft === true) permissions[editor.field] = true;
      } else if (editor.kind === "yesno" && typeof draft === "boolean") {
        patch[PROFILE_KEY[key] ?? key] = editor.toValue(draft);
      } else if ((editor.kind === "text" || editor.kind === "number") && typeof draft === "string" && draft.trim()) {
        if (editor.kind === "number" && !Number.isFinite(Number(draft))) continue;
        patch[PROFILE_KEY[key] ?? key] = editor.toValue(draft.trim());
      }
    }
    if (Object.keys(permissions).length) patch.permissions = permissions;
    if (!Object.keys(patch).length) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveProfile(patch);
      setDrafts({});
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save your answers.");
    } finally {
      setSaving(false);
    }
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName='z-[10000]' className='z-[10000] w-[calc(100vw-1rem)] max-w-[680px] max-h-[calc(100dvh-1rem)] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            Ready to apply to {chosen.length} {chosen.length === 1 ? "job" : "jobs"} at {companies} {companies === 1 ? "company" : "companies"}
          </DialogTitle>
          <DialogDescription>
            Applications are submitted in your name. Bulk runs include jobs with at least {BULK_MIN_MATCH_SCORE}% fit
            that you can work from your country, and at most {BULK_MAX_PER_EMPLOYER_30D} per employer each month.
            {chosen.length ? ` ${ready} of ${chosen.length} are ready now.` : ""}
          </DialogDescription>
        </DialogHeader>

        {common.length > 0 ? (
          <section className='flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3'>
            <div>
              <h3 className='text-sm font-semibold'>Answer once for all jobs</h3>
              <p className='text-xs text-muted-foreground'>Saved to your application profile, so these jobs will not stop to ask.</p>
            </div>
            {common.map(({ key, label, count }) => {
              const editor = EDITORS[key] ?? { kind: "profile" as const };
              const draft = drafts[key];
              const heading = `${label} (${count} ${count === 1 ? "job" : "jobs"})`;
              if (editor.kind === "profile") {
                return (
                  <div key={key} className='text-sm'>
                    <span className='font-medium'>{heading}: </span>
                    <Link to='/dashboard/resume/profile' className='text-brand hover:underline'>set in your application profile</Link>
                  </div>
                );
              }
              if (editor.kind === "permission") {
                return (
                  <label key={key} className='flex items-start gap-2 text-sm'>
                    <input type='checkbox' className='mt-1' checked={draft === true} onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.checked }))} />
                    <span><span className='font-medium'>{heading}: </span>{editor.text}</span>
                  </label>
                );
              }
              if (editor.kind === "yesno") {
                return (
                  <div key={key} className='flex flex-wrap items-center gap-2 text-sm'>
                    <span className='font-medium'>{heading}</span>
                    {[true, false].map((option) => (
                      <Button key={String(option)} type='button' size='sm' variant={draft === option ? "default" : "outline"} onClick={() => setDrafts((d) => ({ ...d, [key]: option }))}>
                        {option ? "Yes" : "No"}
                      </Button>
                    ))}
                  </div>
                );
              }
              return (
                <label key={key} className='flex flex-col gap-1 text-sm'>
                  <span className='font-medium'>{heading}{key === "notice_period" ? " in days" : ""}</span>
                  <input
                    type={editor.kind === "number" ? "number" : "text"}
                    min={editor.kind === "number" ? 0 : undefined}
                    className={inputClass}
                    placeholder={editor.kind === "text" ? editor.placeholder : undefined}
                    value={typeof draft === "string" ? draft : ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </label>
              );
            })}
            {saveError ? <p className='text-sm text-destructive' role='alert'>{saveError}</p> : null}
            <div>
              <Button type='button' size='sm' onClick={() => void saveCommon()} disabled={saving}>
                {saving ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden /> : null}
                Save answers
              </Button>
            </div>
          </section>
        ) : null}

        {specific.length > 0 ? (
          <section className='flex flex-col gap-3 rounded-lg border border-foreground/10 p-3'>
            <div>
              <h3 className='text-sm font-semibold'>Questions for one job</h3>
              <p className='text-xs text-muted-foreground'>Used only for that application. Leave blank to answer later if the run asks.</p>
            </div>
            {specific.map(({ job, label }) => (
              <label key={`${job.id}:${label}`} className='flex flex-col gap-1 text-sm'>
                <span className='font-medium'>{job.company}: {label}</span>
                <textarea
                  rows={2}
                  maxLength={2000}
                  className={inputClass}
                  value={customAnswers[job.id]?.[label] ?? ""}
                  onChange={(e) => onCustomAnswerChange(job.id, label, e.target.value)}
                />
              </label>
            ))}
          </section>
        ) : null}

        {plan.selected.some((j) => j.readiness === "ready") ? (
          <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
            <span>Jobs that will not stop to ask go first.</span>
            <button
              type='button'
              className='font-medium text-brand hover:underline'
              onClick={() => setChecked(new Set(plan.selected.filter((j) => j.readiness === "ready").map((j) => j.id)))}
            >
              Only jobs ready now
            </button>
          </div>
        ) : null}

        <div className='flex flex-col gap-2'>
          {plan.selected.length === 0 ? (
            <p className='text-sm text-muted-foreground'>No job passed the checks. Tick a skipped job below to include it anyway.</p>
          ) : (
            plan.selected.map((item) => <Row key={item.id} item={item} checked={checked.has(item.id)} onToggle={() => toggle(item.id)} />)
          )}
        </div>

        {plan.skipped.length > 0 ? (
          <div className='flex flex-col gap-2'>
            <button type='button' className='self-start text-sm font-medium text-brand hover:underline' onClick={() => setShowSkipped((v) => !v)}>
              {showSkipped ? "Hide" : "Show"} skipped ({plan.skipped.length})
            </button>
            {showSkipped
              ? plan.skipped.map((item) => <Row key={item.id} item={item} checked={checked.has(item.id)} onToggle={() => toggle(item.id)} />)
              : null}
          </div>
        ) : null}

        <DialogFooter className='flex-col-reverse gap-2 sm:flex-row'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type='button' disabled={chosen.length === 0} onClick={() => onConfirm(chosen.map((j) => j.id))}>
            Apply to {chosen.length} {chosen.length === 1 ? "job" : "jobs"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
