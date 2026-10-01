import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResumeAreaTabs } from "@/components/ResumeAreaTabs";
import { WORKABLE_FROM_OPTIONS } from "@/lib/atsReadiness";
import {
  loadApplicationProfile,
  loadProfilePrefill,
  missingRequiredKeys,
  saveApplicationProfile,
  type ProfileAnswers,
} from "@/services/profile/applicationProfile";

const COUNTRIES = WORKABLE_FROM_OPTIONS.filter((o) => o.code.length === 2);
const DECLINE = "Decline to self-identify";
const REQUIRED_LABELS: Record<string, string> = {
  country_residence: "Country you live in",
  work_authorization: "Countries you can work in",
  sponsorship: "Sponsorship needs",
  expected_salary: "Expected salary",
  current_salary: "Current salary",
  notice_period: "Notice period",
};

const inputClass =
  "w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm focus:outline-none focus:border-brand/40";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className='product-section-card p-4 sm:p-6'>
      <h2 className='text-base font-semibold'>{title}</h2>
      {hint ? <p className='mt-1 text-sm text-muted-foreground'>{hint}</p> : null}
      <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>{children}</div>
    </Card>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className='font-medium'>{label}</span>
      {children}
    </label>
  );
}

function YesNo({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className='flex gap-2' role='radiogroup'>
      {[true, false].map((option) => (
        <Button
          key={String(option)}
          type='button'
          size='sm'
          role='radio'
          aria-checked={value === option}
          variant={value === option ? "default" : "outline"}
          className='min-w-[64px]'
          onClick={() => onChange(option)}
        >
          {option ? "Yes" : "No"}
        </Button>
      ))}
    </div>
  );
}

function CountryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className='flex flex-wrap gap-2'>
      {COUNTRIES.map((c) => {
        const on = value.includes(c.code);
        return (
          <button
            key={c.code}
            type='button'
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c.code) : [...value, c.code])}
            className={`rounded-full border px-3 py-1 text-xs ${on ? "border-brand bg-brand/15 text-brand" : "border-foreground/15 text-foreground/70"}`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// Phase 3: answers to common application questions, given once and reused by
// auto-apply on every form (docs/PHASE3_APPLICATION_PROFILE_PLAN.md).
export function ApplicationProfilePage() {
  const [answers, setAnswers] = useState<ProfileAnswers>({});
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadApplicationProfile(), loadProfilePrefill()])
      .then(([saved, prefill]) => {
        if (cancelled) return;
        const savedAnswers = saved ?? {};
        const suggested = Object.keys(prefill).filter((k) => !(k in savedAnswers));
        setAnswers({ ...prefill, ...savedAnswers });
        setPrefilled(new Set(suggested));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const set = (key: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setPrefilled((prev) => { const next = new Set(prev); next.delete(key); return next; });
    setStatus(null);
  };
  const txt = (key: string) => (answers[key]?.text as string | undefined) ?? "";
  const setTxt = (key: string, v: string) => set(key, v.trim() ? { text: v } : null);
  const missing = useMemo(() => missingRequiredKeys(answers), [answers]);
  const requiredDone = 6 - missing.length;

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await saveApplicationProfile(answers);
      setPrefilled(new Set());
      setStatus({ kind: "ok", text: "Saved. Auto-apply will use these answers on every application." });
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Could not save your profile." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center gap-2 p-6 text-sm text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin' aria-hidden /> Loading your application profile...
      </div>
    );
  }

  const demo = answers.demographics ?? {};
  const perms = answers.permissions ?? {};

  return (
    <div className='mx-auto flex max-w-4xl flex-col gap-6 p-4 pb-24 sm:p-6'>
      <ResumeAreaTabs />
      <div>
        <h1 className='product-page-title text-2xl font-bold'>Application profile</h1>
        <p className='product-page-subtitle mt-1 text-sm'>
          Answer the questions employers ask most, once. Auto-apply uses them on every application, adjusted for each job's country and company.
        </p>
      </div>

      <Card className='product-section-card p-4 sm:p-6'>
        <div className='flex items-center justify-between gap-4'>
          <span className='text-sm font-medium'>Required for auto-apply: {requiredDone} of 6</span>
          <span className='text-xs text-muted-foreground'>{missing.length ? "Still needed below" : "All set"}</span>
        </div>
        <div className='mt-2 h-2 w-full rounded-full bg-foreground/10'>
          <div className='h-2 rounded-full bg-brand transition-all' style={{ width: `${(requiredDone / 6) * 100}%` }} />
        </div>
        {missing.length ? (
          <p className='mt-2 text-xs text-amber-400'>Missing: {missing.map((k) => REQUIRED_LABELS[k] ?? k).join(", ")}</p>
        ) : null}
        {prefilled.size ? (
          <p className='mt-2 text-xs text-muted-foreground'>
            {prefilled.size} answers were suggested from your profile and resume. Check them, then save.
          </p>
        ) : null}
      </Card>

      <Section title='1. Identity and contact' hint='Name, email and phone come from your account settings.'>
        <Field label='Country you live in (required)'>
          <select className={inputClass} value={answers.country_residence?.country ?? ""} onChange={(e) => set("country_residence", e.target.value ? { country: e.target.value } : null)}>
            <option value=''>Select a country</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label='Preferred name'>
          <input className={inputClass} value={txt("preferred_name")} onChange={(e) => setTxt("preferred_name", e.target.value)} />
        </Field>
        <Field label='Pronouns'>
          <input className={inputClass} placeholder='For example: she/her' value={txt("pronouns")} onChange={(e) => setTxt("pronouns", e.target.value)} />
        </Field>
      </Section>

      <Section title='2. Links' hint='LinkedIn, GitHub and portfolio links come from your profile settings and resume.'>
        <p className='text-sm text-muted-foreground sm:col-span-2'>Update them in Settings, Profile.</p>
      </Section>

      <Section title='3. Work eligibility' hint='Answered per job: we say Yes to "authorized to work" only for jobs in countries you select.'>
        <Field label='Countries you are legally authorized to work in (required)' wide>
          <CountryPicker
            value={answers.work_authorization?.countries ?? []}
            onChange={(v) => set("work_authorization", { countries: v })}
          />
        </Field>
        <Field label='Countries where you would need visa sponsorship' wide>
          <CountryPicker
            value={answers.sponsorship?.countries ?? []}
            onChange={(v) => set("sponsorship", { countries: v })}
          />
        </Field>
        <Field label='Willing to relocate if required?'>
          <YesNo value={answers.relocation?.willing} onChange={(v) => set("relocation", { willing: v })} />
        </Field>
        <Field label='Open to on-site or hybrid work?'>
          <YesNo value={answers.onsite_hybrid?.willing} onChange={(v) => set("onsite_hybrid", { willing: v })} />
        </Field>
        <Field label='Active security clearance?'>
          <YesNo value={answers.security_clearance?.has} onChange={(v) => set("security_clearance", { has: v })} />
        </Field>
      </Section>

      <Section title='4. Salary and availability'>
        <Field label='Current salary (required)'>
          <input className={inputClass} placeholder='For example: 40000 USD per year' value={txt("current_salary")} onChange={(e) => setTxt("current_salary", e.target.value)} />
        </Field>
        <Field label='Expected salary (required)'>
          <input className={inputClass} placeholder='For example: 60000 USD per year' value={txt("expected_salary")} onChange={(e) => setTxt("expected_salary", e.target.value)} />
        </Field>
        <Field label='Notice period in days (required)'>
          <input
            type='number'
            min={0}
            className={inputClass}
            value={answers.notice_period?.days ?? ""}
            onChange={(e) => set("notice_period", e.target.value === "" ? null : { days: Number(e.target.value), negotiable: Boolean(answers.notice_period?.negotiable) })}
          />
        </Field>
        <Field label='Is your notice period negotiable?'>
          <YesNo
            value={answers.notice_period ? Boolean(answers.notice_period.negotiable) : undefined}
            onChange={(v) => set("notice_period", { days: answers.notice_period?.days ?? 0, negotiable: v })}
          />
        </Field>
      </Section>

      <Section title='5. Background'>
        <Field label='Current or most recent employer'>
          <input className={inputClass} value={txt("employer_current")} onChange={(e) => setTxt("employer_current", e.target.value)} />
        </Field>
        <Field label='Current or most recent job title'>
          <input className={inputClass} value={txt("title_current")} onChange={(e) => setTxt("title_current", e.target.value)} />
        </Field>
        <Field label='Years of relevant experience'>
          <input
            type='number'
            min={0}
            className={inputClass}
            value={answers.years_experience?.years ?? ""}
            onChange={(e) => set("years_experience", e.target.value === "" ? null : { years: Number(e.target.value) })}
          />
        </Field>
        <Field label='Highest education'>
          <input className={inputClass} placeholder='For example: BEng Electrical Engineering, UNN' value={txt("education")} onChange={(e) => setTxt("education", e.target.value)} />
        </Field>
        <Field label='Languages and level' wide>
          <input className={inputClass} placeholder='For example: English (fluent), French (basic)' value={txt("language")} onChange={(e) => setTxt("language", e.target.value)} />
        </Field>
        <Field label='All past employers (used for "worked here before?")' wide>
          <input
            className={inputClass}
            placeholder='Comma separated'
            value={(answers.past_employers?.items ?? []).join(", ")}
            onChange={(e) => set("past_employers", { items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </Field>
      </Section>

      <Section title='6. Standard declarations'>
        <Field label='How did you hear about jobs (default answer)'>
          <input className={inputClass} placeholder='For example: Online job board' value={txt("how_heard")} onChange={(e) => setTxt("how_heard", e.target.value)} />
        </Field>
        <Field label='Accommodation needs for interviews'>
          <input className={inputClass} placeholder='For example: None' value={txt("accommodation")} onChange={(e) => setTxt("accommodation", e.target.value)} />
        </Field>
        <Field label='Bound by a non-compete agreement?'>
          <YesNo value={answers.non_compete?.bound} onChange={(v) => set("non_compete", { bound: v })} />
        </Field>
        <Field label='Consent to a background check?'>
          <YesNo value={answers.background_check?.consent} onChange={(v) => set("background_check", { consent: v })} />
        </Field>
        <Field label='At least 18 years old?'>
          <YesNo value={answers.age_18?.over18} onChange={(v) => set("age_18", { over18: v })} />
        </Field>
        <Field label='Government or public official?'>
          <YesNo value={answers.government_official?.is} onChange={(v) => set("government_official", { is: v })} />
        </Field>
        <Field label='Close relationship with an employee of companies you apply to?'>
          <YesNo value={answers.employee_relationship?.has} onChange={(v) => set("employee_relationship", { has: v })} />
        </Field>
      </Section>

      <Section title='7. Voluntary self-identification' hint='Optional. Used only when a form asks, and "decline" is always accepted.'>
        {(["gender", "race", "veteran", "disability"] as const).map((field) => (
          <Field key={field} label={field === "race" ? "Race / ethnicity" : field[0].toUpperCase() + field.slice(1)}>
            <input
              className={inputClass}
              placeholder={DECLINE}
              value={demo[field] ?? ""}
              onChange={(e) => set("demographics", { ...demo, [field]: e.target.value || undefined })}
            />
          </Field>
        ))}
      </Section>

      <Section title='8. Auto-apply permissions'>
        <label className='flex items-start gap-3 text-sm sm:col-span-2'>
          <input type='checkbox' className='mt-1' checked={perms.consent === true} onChange={(e) => set("permissions", { ...perms, consent: e.target.checked })} />
          <span>
            Tick standard privacy / data processing consent and "the information I provided is true" boxes for me.
            I understand applications are submitted in my name and I am responsible for the answers in this profile.
          </span>
        </label>
        <label className='flex items-start gap-3 text-sm sm:col-span-2'>
          <input type='checkbox' className='mt-1' checked={perms.ai_motivation === true} onChange={(e) => set("permissions", { ...perms, ai_motivation: e.target.checked })} />
          <span>Let AI write short "why this company" answers from my resume and the job description, without asking me first.</span>
        </label>
        <label className='flex items-start gap-3 text-sm sm:col-span-2'>
          <input type='checkbox' className='mt-1' checked={perms.future_openings === true} onChange={(e) => set("permissions", { ...perms, future_openings: e.target.checked })} />
          <span>Answer "yes" when employers ask to contact me about future openings.</span>
        </label>
      </Section>

      <div className='sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-foreground/10 bg-background/95 p-3 backdrop-blur'>
        {status ? (
          <span className={`text-sm ${status.kind === "ok" ? "text-brand" : "text-destructive"}`} role='status'>{status.text}</span>
        ) : null}
        <Button type='button' onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden /> : null}
          Save profile
        </Button>
      </div>
    </div>
  );
}
