import { useMemo, useState } from "react";
import { X, CheckCircle2, ArrowRight, Loader2, ShieldCheck, Building2, Users, BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Modal from "@/components/ui/modal";
import { supabase } from "@/lib/supabaseClient";
import { captureClientEvent } from "@/lib/analytics";

type EnterpriseSalesContactProps = {
  location?: string;
};

const PARTNER_SEGMENTS = [
  "Career Services",
  "Recruiting Ops",
  "Talent Programs",
  "Bootcamps",
  "Staffing Teams",
];

const TEAM_SIZE_OPTIONS = [
  "1-10 seats",
  "11-50 seats",
  "51-200 seats",
  "200+ seats",
];

const TIMELINE_OPTIONS = [
  "Immediately",
  "This quarter",
  "Next quarter",
  "Exploring",
];

export function EnterpriseSalesContact({
  location = "landing_pricing",
}: EnterpriseSalesContactProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTrackedStart, setHasTrackedStart] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    jobTitle: "",
    businessEmail: "",
    website: "",
    teamSize: "",
    monthlyHiringVolume: "",
    rolloutTimeline: "",
    useCase: "",
  });

  const canContinue = useMemo(
    () =>
      Boolean(
        formData.firstName.trim() &&
          formData.lastName.trim() &&
          formData.companyName.trim() &&
          formData.jobTitle.trim() &&
          formData.businessEmail.trim(),
      ),
    [formData],
  );

  const canSubmit = useMemo(
    () =>
      Boolean(
        canContinue &&
          formData.teamSize.trim() &&
          formData.rolloutTimeline.trim() &&
          formData.useCase.trim(),
      ),
    [canContinue, formData],
  );

  const openModal = () => {
    resetForm();
    setOpen(true);
    captureClientEvent("enterprise_sales_opened", { location });
  };

  const closeModal = () => {
    if (loading) return;
    setOpen(false);
  };

  const resetForm = () => {
    setStep(1);
    setSuccess(false);
    setError(null);
    setHasTrackedStart(false);
    setFormData({
      firstName: "",
      lastName: "",
      companyName: "",
      jobTitle: "",
      businessEmail: "",
      website: "",
      teamSize: "",
      monthlyHiringVolume: "",
      rolloutTimeline: "",
      useCase: "",
    });
  };

  const handleChange =
    (field: keyof typeof formData) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const value = event.target.value;
      if (!hasTrackedStart && value.trim().length > 0) {
        setHasTrackedStart(true);
        captureClientEvent("enterprise_sales_started", { location });
      }
      setFormData((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const { error: invokeError } = await supabase.functions.invoke(
        "request-enterprise-sales",
        {
          body: formData,
        },
      );

      if (invokeError) throw invokeError;

      captureClientEvent("enterprise_sales_submitted", {
        location,
        team_size: formData.teamSize,
        rollout_timeline: formData.rolloutTimeline,
      });
      setSuccess(true);
    } catch (submitError: any) {
      console.error("Enterprise sales request failed", submitError);
      captureClientEvent("enterprise_sales_failed", { location });
      setError(
        submitError?.message ||
          "We could not send your request. Please try again or email support@jobraker.io.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className='mt-10 rounded-[28px] border border-brand/20 bg-[linear-gradient(180deg,rgba(14,17,22,0.98),rgba(8,10,14,0.98))] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.35)] lg:p-8'>
        <div className='grid gap-8 lg:grid-cols-[1.35fr_0.9fr] lg:items-end'>
          <div className='space-y-5'>
            <div className='inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand/80'>
              <ShieldCheck className='h-3.5 w-3.5' />
              Enterprise rollout
            </div>
            <div className='space-y-3'>
              <h3 className='max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl'>
                Need governed AI workflows for a larger hiring or career team?
              </h3>
              <p className='max-w-2xl text-sm leading-7 text-foreground/58 sm:text-base'>
                JobRaker helps multi-seat teams run evaluation, drafting, review,
                and follow-up workflows with clearer controls, faster onboarding,
                and a rollout plan shaped to your operating model.
              </p>
            </div>

            <div className='grid gap-3 sm:grid-cols-2'>
              {[
                "Multi-seat recruiting or coaching workflows",
                "Governed AI drafting, review, and follow-up support",
                "Security review, onboarding, and rollout guidance",
                "Custom usage limits, reporting, and workspace controls",
              ].map((item) => (
                <div
                  key={item}
                  className='rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-foreground/72'
                >
                  <div className='flex items-start gap-3'>
                    <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-brand' />
                    <span>{item}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className='space-y-3 pt-2'>
              <p className='text-xs uppercase tracking-[0.24em] text-foreground/35'>
                Best fit for
              </p>
              <div className='flex flex-wrap gap-3'>
                {PARTNER_SEGMENTS.map((segment) => (
                  <div
                    key={segment}
                    className='rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] px-4 py-3 text-sm font-medium text-foreground/60'
                  >
                    {segment}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className='rounded-[24px] border border-brand/16 bg-white/[0.02] p-5 lg:p-6'>
            <div className='space-y-4'>
              <div className='flex items-start gap-3'>
                <div className='rounded-2xl border border-brand/20 bg-brand/10 p-3 text-brand'>
                  <Building2 className='h-5 w-5' />
                </div>
                <div className='space-y-1'>
                  <h4 className='text-lg font-semibold text-foreground'>
                    Contact enterprise sales
                  </h4>
                  <p className='text-sm leading-6 text-foreground/55'>
                    Tell us about your team and we’ll shape the right rollout,
                    controls, and support plan.
                  </p>
                </div>
              </div>

              <div className='grid gap-3 text-sm text-foreground/62'>
                <div className='flex items-center gap-2'>
                  <Users className='h-4 w-4 text-brand' />
                  Multi-seat access and onboarding
                </div>
                <div className='flex items-center gap-2'>
                  <BriefcaseBusiness className='h-4 w-4 text-brand' />
                  Workflow fit review for your operating model
                </div>
              </div>

              <Button
                onClick={openModal}
                className='h-12 w-full bg-brand text-black hover:bg-brand/95'
              >
                Talk to sales
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={open} onClose={closeModal} size='xl'>
        <div className='relative -mx-5 -my-4 overflow-hidden rounded-2xl border border-white/8 bg-[#111315] text-foreground'>
          <button
            type='button'
            onClick={closeModal}
            className='absolute right-5 top-5 z-10 rounded-full border border-white/10 bg-white/[0.04] p-2 text-foreground/65 transition-colors hover:bg-white/[0.08] hover:text-foreground'
            aria-label='Close enterprise sales form'
          >
            <X className='h-5 w-5' />
          </button>

          <div className='grid min-h-[680px] lg:grid-cols-[1.08fr_1fr]'>
            <div className='flex flex-col justify-between border-b border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(29,255,0,0.12),transparent_28%),linear-gradient(180deg,#111315_0%,#0d0f12_100%)] p-8 lg:border-b-0 lg:border-r lg:p-10'>
              <div className='space-y-8'>
                <div className='flex items-center gap-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-bold text-black'>
                    JR
                  </div>
                  <div className='text-xl font-semibold tracking-tight text-foreground'>
                    Jobraker
                  </div>
                </div>

                <div className='space-y-5'>
                  <h2 className='max-w-md text-4xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-5xl'>
                    Contact our enterprise team
                  </h2>
                  <p className='max-w-lg text-base leading-8 text-foreground/56'>
                    Bring Jobraker into a larger recruiting, talent, or career
                    support workflow with rollout guidance shaped to your team.
                  </p>
                </div>

                <div className='space-y-4'>
                  {[
                    "Unlimited team seats for shared review workflows",
                    "Governed AI drafting and application operations support",
                    "Security, onboarding, and rollout planning with our team",
                    "Priority help for custom limits and enterprise setup",
                  ].map((item) => (
                    <div key={item} className='flex items-start gap-3 text-sm text-foreground/62'>
                      <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-brand' />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className='space-y-3 pt-8'>
                <p className='text-sm text-foreground/45'>
                  Supporting teams that run high-volume job search, coaching, and guided hiring workflows.
                </p>
                <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                  {PARTNER_SEGMENTS.map((segment) => (
                    <div
                      key={segment}
                      className='rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-center text-sm font-medium text-foreground/48'
                    >
                      {segment}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className='bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-8 lg:p-10'>
              {success ? (
                <div className='flex h-full flex-col justify-center space-y-6'>
                  <div className='flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand'>
                    <CheckCircle2 className='h-8 w-8' />
                  </div>
                  <div className='space-y-3'>
                    <h3 className='text-3xl font-semibold tracking-tight text-foreground'>
                      Request received
                    </h3>
                    <p className='max-w-md text-sm leading-7 text-foreground/58'>
                      We have your details and will follow up with the right next
                      step for your team.
                    </p>
                  </div>
                  <div className='flex gap-3'>
                    <Button
                      className='bg-brand text-black hover:bg-brand/95'
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      variant='outline'
                      className='border-white/12 bg-transparent text-foreground/72 hover:bg-white/[0.03]'
                      onClick={resetForm}
                    >
                      Submit another request
                    </Button>
                  </div>
                </div>
              ) : (
                <form className='space-y-6' onSubmit={handleSubmit}>
                  <div className='space-y-2'>
                    <h3 className='text-3xl font-semibold tracking-tight text-foreground'>
                      Contact sales
                    </h3>
                    <p className='text-sm leading-7 text-foreground/52'>
                      Tell us about your team and we’ll get back to you. Step {step} of 2.
                    </p>
                  </div>

                  {step === 1 ? (
                    <div className='space-y-5'>
                      <div className='grid gap-4 sm:grid-cols-2'>
                        <Field label='First name'>
                          <Input
                            value={formData.firstName}
                            onChange={handleChange("firstName")}
                            placeholder='Jordan'
                            inputSize='md'
                            className='h-12 border-white/10 bg-[#17191c] px-4 text-base font-normal tracking-normal placeholder:text-foreground/25'
                          />
                        </Field>
                        <Field label='Last name'>
                          <Input
                            value={formData.lastName}
                            onChange={handleChange("lastName")}
                            placeholder='Adebayo'
                            inputSize='md'
                            className='h-12 border-white/10 bg-[#17191c] px-4 text-base font-normal tracking-normal placeholder:text-foreground/25'
                          />
                        </Field>
                        <Field label='Company name'>
                          <Input
                            value={formData.companyName}
                            onChange={handleChange("companyName")}
                            placeholder='Northstar Talent'
                            inputSize='md'
                            className='h-12 border-white/10 bg-[#17191c] px-4 text-base font-normal tracking-normal placeholder:text-foreground/25'
                          />
                        </Field>
                        <Field label='Job title'>
                          <Input
                            value={formData.jobTitle}
                            onChange={handleChange("jobTitle")}
                            placeholder='Director of Career Services'
                            inputSize='md'
                            className='h-12 border-white/10 bg-[#17191c] px-4 text-base font-normal tracking-normal placeholder:text-foreground/25'
                          />
                        </Field>
                        <Field label='Business email'>
                          <Input
                            type='email'
                            value={formData.businessEmail}
                            onChange={handleChange("businessEmail")}
                            placeholder='team@company.com'
                            inputSize='md'
                            className='h-12 border-white/10 bg-[#17191c] px-4 text-base font-normal tracking-normal placeholder:text-foreground/25'
                          />
                        </Field>
                        <Field label='Website'>
                          <Input
                            value={formData.website}
                            onChange={handleChange("website")}
                            placeholder='www.company.com'
                            inputSize='md'
                            className='h-12 border-white/10 bg-[#17191c] px-4 text-base font-normal tracking-normal placeholder:text-foreground/25'
                          />
                        </Field>
                      </div>

                      <Button
                        type='button'
                        disabled={!canContinue}
                        onClick={() => setStep(2)}
                        className='h-12 w-full bg-brand text-base font-semibold text-black hover:bg-brand/95'
                      >
                        Continue
                      </Button>
                    </div>
                  ) : (
                    <div className='space-y-5'>
                      <div className='grid gap-4 sm:grid-cols-2'>
                        <Field label='Team size'>
                          <select
                            value={formData.teamSize}
                            onChange={handleChange("teamSize")}
                            className='h-12 w-full rounded-xl border border-white/10 bg-[#17191c] px-4 text-base text-foreground outline-none transition-colors hover:border-white/15 focus:border-brand'
                          >
                            <option value=''>Select team size</option>
                            {TEAM_SIZE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label='Rollout timeline'>
                          <select
                            value={formData.rolloutTimeline}
                            onChange={handleChange("rolloutTimeline")}
                            className='h-12 w-full rounded-xl border border-white/10 bg-[#17191c] px-4 text-base text-foreground outline-none transition-colors hover:border-white/15 focus:border-brand'
                          >
                            <option value=''>Select timeline</option>
                            {TIMELINE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <Field label='Monthly hiring or candidate volume'>
                        <Input
                          value={formData.monthlyHiringVolume}
                          onChange={handleChange("monthlyHiringVolume")}
                          placeholder='e.g. 120 candidate reviews / month'
                          inputSize='md'
                          className='h-12 border-white/10 bg-[#17191c] px-4 text-base font-normal tracking-normal placeholder:text-foreground/25'
                        />
                      </Field>

                      <Field label='What do you want Jobraker to help your team accomplish?'>
                        <Textarea
                          rows={5}
                          value={formData.useCase}
                          onChange={handleChange("useCase")}
                          placeholder='Describe your workflow, team structure, and what a successful rollout would look like.'
                          className='min-h-[148px] rounded-xl border-white/10 bg-[#17191c] px-4 py-3 text-base text-foreground placeholder:text-foreground/25 focus:ring-brand/50'
                        />
                      </Field>

                      {error ? (
                        <div className='rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-300'>
                          {error}
                        </div>
                      ) : null}

                      <div className='flex flex-col gap-3 sm:flex-row'>
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() => setStep(1)}
                          className='h-12 flex-1 border-white/10 bg-transparent text-foreground/72 hover:bg-white/[0.03]'
                        >
                          Back
                        </Button>
                        <Button
                          type='submit'
                          disabled={!canSubmit || loading}
                          className='h-12 flex-1 bg-brand text-base font-semibold text-black hover:bg-brand/95'
                        >
                          {loading ? (
                            <Loader2 className='h-5 w-5 animate-spin' />
                          ) : (
                            <>
                              Submit request
                              <ArrowRight className='ml-2 h-4 w-4' />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className='block space-y-2'>
      <span className='text-sm font-medium text-foreground/62'>{label}</span>
      {children}
    </label>
  );
}

export default EnterpriseSalesContact;
