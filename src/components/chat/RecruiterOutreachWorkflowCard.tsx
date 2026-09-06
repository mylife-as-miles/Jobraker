import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Zap,
  Sparkles,
  Mail,
  CheckCircle2,
  X,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Edit3,
  Copy,
  Check,
  Send,
  Loader2,
  Building2,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import {
  type TargetOutreachJob,
  type OutreachJobState,
  type OutreachTone,
  fetchTopUncontactedJobs,
  loadCandidateEvidence,
  scoutRecruiterForJob,
  craftOutreachPitch,
  deliverOutreachEmail,
} from "@/services/presets/recruiterOutreachService";

interface RecruiterOutreachWorkflowCardProps {
  userId?: string;
  onClose?: () => void;
  onComplete?: (summary: { total: number; drafted: number; sent: number }) => void;
  className?: string;
}

export const RecruiterOutreachWorkflowCard: React.FC<RecruiterOutreachWorkflowCardProps> = ({
  userId,
  onClose,
  onComplete,
  className = "",
}) => {
  const supabase = useMemo(() => createClient(), []);

  // Workflow Stages: 1 = scout, 2 = craft, 3 = deliver, 4 = done
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [jobStates, setJobStates] = useState<OutreachJobState[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [candidateEvidence, setCandidateEvidence] = useState("");

  // Tone & UI states
  const [selectedTone, setSelectedTone] = useState<OutreachTone>("casual");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Job selection modal / search drawer state
  const [showAddJobDrawer, setShowAddJobDrawer] = useState(false);
  const [instantJobInput, setInstantJobInput] = useState({ company: "", title: "" });
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [allAvailableJobs, setAllAvailableJobs] = useState<TargetOutreachJob[]>([]);

  // Action busy states
  const [isScoutingBatch, setIsScoutingBatch] = useState(false);
  const [isCraftingBatch, setIsCraftingBatch] = useState(false);
  const [isDeliveringBatch, setIsDeliveringBatch] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"draft" | "send">("draft");

  // Global error banner
  const [globalError, setGlobalError] = useState<string | null>(null);

  // 1. Initial Load: Pre-select top 3 uncontacted jobs (Zero-effort start!)
  useEffect(() => {
    let isMounted = true;
    async function init() {
      setLoadingInitial(true);
      try {
        let activeUserId = userId;
        if (!activeUserId) {
          const { data: authData } = await supabase.auth.getUser();
          activeUserId = authData.user?.id;
        }

        if (activeUserId) {
          const [topJobs, evidence] = await Promise.all([
            fetchTopUncontactedJobs(supabase, activeUserId, 5),
            loadCandidateEvidence(supabase, activeUserId),
          ]);

          if (isMounted) {
            setCandidateEvidence(evidence);
            setAllAvailableJobs(topJobs);

            // Pre-select the top 3 jobs automatically
            const initialStates: OutreachJobState[] = topJobs.map((job, index) => ({
              job,
              selected: index < 3,
            }));
            setJobStates(initialStates);
          }
        }
      } catch (err) {
        console.error("Failed to initialize outreach workflow", err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [supabase, userId]);

  const selectedJobStates = useMemo(
    () => jobStates.filter((js) => js.selected),
    [jobStates],
  );

  const toggleJobSelection = (id: string) => {
    setJobStates((prev) =>
      prev.map((js) => (js.job.id === id ? { ...js, selected: !js.selected } : js)),
    );
  };

  const removeJob = (id: string) => {
    setJobStates((prev) => prev.filter((js) => js.job.id !== id));
  };

  const addInstantJob = () => {
    if (!instantJobInput.company.trim() || !instantJobInput.title.trim()) return;
    const newJob: TargetOutreachJob = {
      id: `instant-${Date.now()}`,
      jobId: null,
      company: instantJobInput.company.trim(),
      title: instantJobInput.title.trim(),
      source: "instant",
      matchScore: 90,
    };

    setJobStates((prev) => [{ job: newJob, selected: true }, ...prev]);
    setInstantJobInput({ company: "", title: "" });
    setShowAddJobDrawer(false);
  };

  // ACTION 1: 1-Click Pull Recruiter Emails
  const handlePullRecruiterEmails = async () => {
    setGlobalError(null);
    setIsScoutingBatch(true);

    const activeStates = selectedJobStates;
    if (activeStates.length === 0) {
      setGlobalError("Please select at least 1 job to scout.");
      setIsScoutingBatch(false);
      return;
    }

    // Set loading on selected jobs
    setJobStates((prev) =>
      prev.map((js) =>
        js.selected ? { ...js, contactLoading: true, contactError: undefined } : js,
      ),
    );

    // Scout concurrently
    const updated = await Promise.all(
      activeStates.map(async (js) => {
        try {
          const contact = await scoutRecruiterForJob(supabase, js.job);
          return { id: js.job.id, contact, contactLoading: false };
        } catch (err: any) {
          return {
            id: js.job.id,
            contactError: err?.message || "Scouting failed",
            contactLoading: false,
          };
        }
      }),
    );

    setJobStates((prev) =>
      prev.map((js) => {
        const res = updated.find((u) => u.id === js.job.id);
        if (!res) return js;
        return {
          ...js,
          contact: res.contact || js.contact,
          contactLoading: false,
          contactError: res.contactError,
        };
      }),
    );

    setIsScoutingBatch(false);
    setCurrentStep(2);
  };

  // ACTION 2: 1-Click Craft Outreach Pitches
  const handleCraftOutreachPitches = async (overrideTone?: OutreachTone) => {
    setGlobalError(null);
    setIsCraftingBatch(true);
    const toneToUse = overrideTone || selectedTone;

    const activeStates = selectedJobStates;
    setJobStates((prev) =>
      prev.map((js) =>
        js.selected ? { ...js, pitchLoading: true, pitchError: undefined } : js,
      ),
    );

    const updated = await Promise.all(
      activeStates.map(async (js) => {
        if (!js.contact) {
          return { id: js.job.id, pitchLoading: false };
        }
        try {
          const pitch = await craftOutreachPitch(
            supabase,
            js.job,
            js.contact,
            candidateEvidence,
            toneToUse,
          );
          return { id: js.job.id, pitch, pitchLoading: false };
        } catch (err: any) {
          return {
            id: js.job.id,
            pitchError: err?.message || "Pitch generation failed",
            pitchLoading: false,
          };
        }
      }),
    );

    setJobStates((prev) =>
      prev.map((js) => {
        const res = updated.find((u) => u.id === js.job.id);
        if (!res) return js;
        return {
          ...js,
          pitch: res.pitch || js.pitch,
          pitchLoading: false,
          pitchError: res.pitchError,
        };
      }),
    );

    setIsCraftingBatch(false);
    setCurrentStep(3);
  };

  // ACTION 3: 1-Click Deliver to Gmail
  const handleDeliverToGmail = async (mode: "draft" | "send" = "draft") => {
    setGlobalError(null);
    setIsDeliveringBatch(true);
    setDeliveryMode(mode);

    let activeUserId = userId;
    if (!activeUserId) {
      const { data: authData } = await supabase.auth.getUser();
      activeUserId = authData.user?.id;
    }

    if (!activeUserId) {
      setGlobalError("User authentication session required to sync with Gmail.");
      setIsDeliveringBatch(false);
      return;
    }

    const activeStates = selectedJobStates;
    setJobStates((prev) =>
      prev.map((js) =>
        js.selected ? { ...js, deliveryLoading: true } : js,
      ),
    );

    const results: Array<{ id: string; delivery: any }> = [];

    // Execute staggered delivery (to be respectful of email transport)
    for (const js of activeStates) {
      if (!js.contact?.email || !js.pitch) {
        results.push({
          id: js.job.id,
          delivery: {
            status: "skipped",
            error: "No email address found or pitch missing.",
          },
        });
        continue;
      }

      try {
        const delivery = await deliverOutreachEmail(
          supabase,
          activeUserId,
          js.job,
          js.contact,
          js.pitch,
          mode,
        );
        results.push({ id: js.job.id, delivery });
      } catch (err: any) {
        results.push({
          id: js.job.id,
          delivery: {
            status: "failed",
            error: err?.message || "Delivery failed",
          },
        });
      }

      // Small delay between requests to preserve rate limits
      if (activeStates.length > 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    setJobStates((prev) =>
      prev.map((js) => {
        const res = results.find((r) => r.id === js.job.id);
        if (!res) return js;
        return {
          ...js,
          delivery: res.delivery,
          deliveryLoading: false,
        };
      }),
    );

    setIsDeliveringBatch(false);
    setCurrentStep(4);

    const draftedCount = results.filter((r) => r.delivery.status === "drafted").length;
    const sentCount = results.filter((r) => r.delivery.status === "sent").length;
    onComplete?.({
      total: results.length,
      drafted: draftedCount,
      sent: sentCount,
    });
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePitchContentChange = (
    jobId: string,
    field: "subject" | "body",
    value: string,
  ) => {
    setJobStates((prev) =>
      prev.map((js) => {
        if (js.job.id !== jobId || !js.pitch) return js;
        return {
          ...js,
          pitch: {
            ...js.pitch,
            [field]: value,
            customized: true,
          },
        };
      }),
    );
  };

  if (loadingInitial) {
    return (
      <div className="w-full p-6 rounded-2xl border border-brand/30 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">
          Pre-selecting your top uncontacted job matches...
        </p>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl border border-brand/30 bg-card/98 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-background/50">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-brand/15 text-brand border border-brand/30">
            <Zap className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                1-Click Recruiter Cold Outreach
              </span>
              <span className="text-[10px] bg-brand/20 text-brand px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Preset Recipe
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pull contacts &rarr; Craft messages &rarr; Gmail delivery in 3 single clicks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            className="p-1 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            title={isMinimized ? "Expand Canvas" : "Minimize Canvas"}
          >
            {isMinimized ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              title="Close Workflow"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Workflow Stepper Indicator */}
      {!isMinimized && (
        <div className="px-4 py-2 border-b border-border/40 bg-muted/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 font-medium ${
                currentStep >= 1 ? "text-brand" : "text-muted-foreground"
              }`}
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold">
                1
              </span>
              Pull Emails
            </span>
            <span className="text-muted-foreground/40">&rarr;</span>
            <span
              className={`flex items-center gap-1.5 font-medium ${
                currentStep >= 2 ? "text-brand" : "text-muted-foreground"
              }`}
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold">
                2
              </span>
              Review Pitches
            </span>
            <span className="text-muted-foreground/40">&rarr;</span>
            <span
              className={`flex items-center gap-1.5 font-medium ${
                currentStep >= 3 ? "text-brand" : "text-muted-foreground"
              }`}
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold">
                3
              </span>
              Gmail Delivery
            </span>
          </div>

          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Batch size: <strong className="text-foreground">{selectedJobStates.length}</strong> jobs
          </span>
        </div>
      )}

      {/* 2. Main Content Body */}
      {!isMinimized && (
        <div className="p-4 space-y-4">
          {globalError && (
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{globalError}</span>
            </div>
          )}

          {/* STEP 0: Zero-Click Pre-Selected Jobs Pill Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                Target Companies ({selectedJobStates.length} selected):
              </span>
              <button
                type="button"
                onClick={() => setShowAddJobDrawer((prev) => !prev)}
                className="text-[11px] text-brand hover:underline flex items-center gap-1 font-semibold"
              >
                <Plus className="size-3" />
                <span>{showAddJobDrawer ? "Hide Job Picker" : "Change / Add Jobs"}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {jobStates.map((js) => (
                <div
                  key={js.job.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs transition-all border ${
                    js.selected
                      ? "bg-brand/10 border-brand/40 text-foreground font-medium"
                      : "bg-muted/40 border-border/60 text-muted-foreground hover:border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleJobSelection(js.job.id)}
                    className="flex items-center gap-1.5 hover:text-brand"
                  >
                    <Building2 className="size-3 text-brand" />
                    <span>{js.job.company}</span>
                    {js.job.matchScore && (
                      <span className="text-[10px] text-muted-foreground">
                        {js.job.matchScore}%
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeJob(js.job.id)}
                    className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                    title="Remove job"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}

              {jobStates.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No jobs in active batch. Click &ldquo;Change / Add Jobs&rdquo; to add one.
                </p>
              )}
            </div>

            {/* Expandable Add Job Drawer */}
            {showAddJobDrawer && (
              <div className="mt-2 p-3 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <div className="text-xs font-semibold text-foreground">
                  Quick Add a Job or Search:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Company Name (e.g. Anthropic)"
                    value={instantJobInput.company}
                    onChange={(e) =>
                      setInstantJobInput((prev) => ({ ...prev, company: e.target.value }))
                    }
                    className="px-3 py-1.5 rounded-lg text-xs bg-background border border-border text-foreground outline-none focus:border-brand"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Role Title (e.g. Senior Frontend Eng)"
                      value={instantJobInput.title}
                      onChange={(e) =>
                        setInstantJobInput((prev) => ({ ...prev, title: e.target.value }))
                      }
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-background border border-border text-foreground outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={addInstantJob}
                      className="px-3 py-1.5 rounded-lg bg-brand text-black text-xs font-bold hover:bg-brand/90 transition-colors shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STAGE 1: Pull Recruiter Contacts */}
          {currentStep === 1 && (
            <div className="pt-2 space-y-3">
              <div className="p-3 rounded-xl bg-brand/5 border border-brand/20 flex items-start gap-3">
                <ShieldCheck className="size-5 text-brand shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <p className="text-foreground font-semibold mb-0.5">
                    1-Click Verified Recruiter Scout
                  </p>
                  JobRaker will scout decision makers across{" "}
                  <strong className="text-foreground">{selectedJobStates.length} companies</strong>{" "}
                  using our 4-tier verification waterfall (Talent Lead &rarr; Hiring Manager &rarr;
                  Talent Team &rarr; LinkedIn Connect fallback).
                </div>
              </div>

              <button
                type="button"
                disabled={isScoutingBatch || selectedJobStates.length === 0}
                onClick={handlePullRecruiterEmails}
                className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand/90 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50 cursor-pointer"
              >
                {isScoutingBatch ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Scouting Decision Makers across {selectedJobStates.length} Companies...</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-4 fill-current" />
                    <span>
                      ⚡ 1-Click: Pull Recruiter Contacts ({selectedJobStates.length} Jobs)
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STAGE 2: Review Contacts & Pitches */}
          {currentStep >= 2 && currentStep < 4 && (
            <div className="space-y-3">
              {/* Tone Switcher Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-border/40">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-brand" />
                  Outreach Pitch Tone:
                </span>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: "casual", label: "Startup Casual" },
                      { id: "bold", label: "Executive Bold" },
                      { id: "punchy", label: "Short & Punchy" },
                    ] as const
                  ).map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => {
                        setSelectedTone(tone.id);
                        if (currentStep === 3) {
                          handleCraftOutreachPitches(tone.id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        selectedTone === tone.id
                          ? "bg-brand text-black font-bold shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Ledger: 1-Row Summary Per Job */}
              <div className="space-y-2">
                {selectedJobStates.map((js) => {
                  const isExpanded = expandedJobId === js.job.id;
                  const contact = js.contact;
                  const pitch = js.pitch;

                  return (
                    <div
                      key={js.job.id}
                      className="rounded-xl border border-border/80 bg-background/60 overflow-hidden text-xs transition-all hover:border-border"
                    >
                      {/* Summary Row */}
                      <div className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-foreground font-bold text-xs shrink-0 border border-border">
                            {js.job.company.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground truncate">
                                {js.job.company}
                              </span>
                              <span className="text-muted-foreground text-[11px] truncate">
                                • {js.job.title}
                              </span>
                            </div>

                            {contact ? (
                              <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                                {contact.status === "found" ? (
                                  <>
                                    <span className="text-brand font-medium flex items-center gap-1">
                                      <UserCheck className="size-3" />
                                      {contact.fullName} ({contact.title})
                                    </span>
                                    <span className="text-muted-foreground font-mono text-[10px]">
                                      &lt;{contact.email}&gt;
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-amber-400 font-medium">
                                    {contact.tierLabel}
                                  </span>
                                )}
                              </div>
                            ) : js.contactLoading ? (
                              <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                                <Loader2 className="size-3 animate-spin" /> Scouting...
                              </span>
                            ) : null}

                            {/* 1-Line Hook Preview */}
                            {pitch && !isExpanded && (
                              <p className="text-[11px] text-muted-foreground/90 italic truncate mt-1">
                                &ldquo;{pitch.previewHook}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {contact?.status === "no_email" && contact.linkedinUrl && (
                            <a
                              href={contact.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                            >
                              <span>LinkedIn</span>
                              <ExternalLink className="size-2.5" />
                            </a>
                          )}

                          {pitch && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedJobId((prev) =>
                                  prev === js.job.id ? null : js.job.id,
                                )
                              }
                              className="px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1 transition-colors"
                            >
                              <Edit3 className="size-3" />
                              <span>{isExpanded ? "Collapse" : "Preview / Edit"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Preview / Edit Drawer */}
                      {isExpanded && pitch && (
                        <div className="p-3 border-t border-border/60 bg-muted/10 space-y-2.5">
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                              Subject Line:
                            </label>
                            <input
                              type="text"
                              value={pitch.subject}
                              onChange={(e) =>
                                handlePitchContentChange(js.job.id, "subject", e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs outline-none focus:border-brand"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Personalized Pitch Body:
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(pitch.body, `pitch-${js.job.id}`)
                                }
                                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                {copiedId === `pitch-${js.job.id}` ? (
                                  <>
                                    <Check className="size-3 text-brand" />
                                    <span className="text-brand">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3" />
                                    <span>Copy Text</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <textarea
                              rows={5}
                              value={pitch.body}
                              onChange={(e) =>
                                handlePitchContentChange(js.job.id, "body", e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-foreground text-xs outline-none focus:border-brand font-sans leading-relaxed"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons for Step 2 and Step 3 */}
              {currentStep === 2 && (
                <button
                  type="button"
                  disabled={isCraftingBatch}
                  onClick={() => handleCraftOutreachPitches()}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand/90 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50 cursor-pointer"
                >
                  {isCraftingBatch ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-black" />
                      <span className="text-black">Crafting Tailored Pitches with Evidence...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 text-black" />
                      <span className="text-black">✨ 1-Click: Craft Outreach Pitches ({selectedJobStates.length} Jobs)</span>
                    </>
                  )}
                </button>
              )}

              {currentStep === 3 && (
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isDeliveringBatch}
                    onClick={() => handleDeliverToGmail("draft")}
                    className="py-2.5 px-4 rounded-xl bg-brand hover:bg-brand/90 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isDeliveringBatch && deliveryMode === "draft" ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-black" />
                        <span className="text-black">Creating Gmail Drafts...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="size-4 text-black" />
                        <span className="text-black">★ 1-Click: Create in Gmail Drafts</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isDeliveringBatch}
                    onClick={() => handleDeliverToGmail("send")}
                    className="py-2.5 px-4 rounded-xl bg-card hover:bg-muted border border-border/80 text-foreground font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isDeliveringBatch && deliveryMode === "send" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Sending via Safe Jitter...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        <span>Send Now via Gmail (Safe Jitter)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STAGE 4: Success & Verification Screen */}
          {currentStep === 4 && (
            <div className="py-4 px-3 rounded-xl bg-brand/5 border border-brand/30 space-y-4 text-center">
              <div className="flex size-12 rounded-full bg-brand/20 text-brand items-center justify-center mx-auto border border-brand/30">
                <CheckCircle2 className="size-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-foreground">
                  Outreach Flow Completed Successfully!
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  {deliveryMode === "draft"
                    ? "Your tailored cold outreach drafts are now saved in your connected Gmail account and synced to your Application Tracker."
                    : "Your tailored cold outreach emails have been scheduled and sent via Gmail with safe delivery jitter."}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand/90 text-black font-bold text-xs transition-all inline-flex items-center gap-1.5 shadow-md shadow-brand/20"
                >
                  <Mail className="size-3.5 text-black" />
                  <span className="text-black">Open in Gmail ↗</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(1);
                    setJobStates((prev) =>
                      prev.map((js) => ({
                        ...js,
                        contact: undefined,
                        pitch: undefined,
                        delivery: undefined,
                      })),
                    );
                  }}
                  className="px-4 py-2 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-semibold text-xs transition-colors"
                >
                  Start Another Batch
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
