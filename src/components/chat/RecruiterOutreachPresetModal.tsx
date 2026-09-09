import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Zap,
  Building2,
  CheckSquare,
  Square,
  Plus,
  Sparkles,
  RefreshCw,
  X,
  ArrowRight,
  Search,
  Briefcase,
  History,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { ACTION_RECIPES, type ActionRecipe } from "@/lib/presets/actionRecipes";
import { useComposioIntegrations } from "@/hooks/useComposioIntegrations";
import { GMAIL_INTEGRATION } from "@/lib/composioIntegrations";
import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import type { ColdMailQuota } from "@/lib/chatSkills/types";

export interface PresetJobItem {
  id: string;
  company: string;
  title: string;
  source: "searched" | "applied" | "custom";
  matchScore?: number;
  location?: string;
  appliedDate?: string;
  selected: boolean;
}

interface RecruiterOutreachPresetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId?: string;
  userId?: string;
  onLaunchPrompt: (
    compiledPrompt: string,
    context?: {
      presetId: "recruiter_cold_outreach";
      jobId: string;
      companyName: string;
      jobTitle: string;
      clientRunId: string;
    },
  ) => void;
}

export const RecruiterOutreachPresetModal: React.FC<RecruiterOutreachPresetModalProps> = ({
  open,
  onOpenChange,
  recipeId = "recruiter_cold_outreach",
  userId,
  onLaunchPrompt,
}) => {
  const supabase = useMemo(() => createClient(), []);

  const activeRecipe: ActionRecipe = useMemo(() => {
    return (
      ACTION_RECIPES[recipeId] ||
      ACTION_RECIPES.recruiter_cold_outreach
    );
  }, [recipeId]);
  const isColdMailPreset = activeRecipe.id === "recruiter_cold_outreach";
  const coldMailGmail = useComposioIntegrations({
    enabled: open && isColdMailPreset,
    purpose: "recruiter_cold_outreach",
  });
  const gmailStatus = coldMailGmail.getStatus("gmail");
  const gmailConnected = gmailStatus?.state === "active";

  const [activeTab, setActiveTab] = useState<"searched" | "applied">(
    recipeId === "followup_bump" ? "applied" : "searched",
  );
  const [loading, setLoading] = useState(false);
  const [searchedJobs, setSearchedJobs] = useState<PresetJobItem[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<PresetJobItem[]>([]);
  const [customJobs, setCustomJobs] = useState<PresetJobItem[]>([]);

  // Search filter
  const [searchFilter, setSearchFilter] = useState("");

  // Add custom job inputs
  const [customCompany, setCustomCompany] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Outreach tone / strategy
  const [tone, setTone] = useState<string>("casual");
  const [coldMailQuota, setColdMailQuota] = useState<ColdMailQuota | null>(null);

  useEffect(() => {
    if (!open || !isColdMailPreset) {
      setColdMailQuota(null);
      return;
    }
    let active = true;
    void invokeProtectedFunction<{
      success: boolean;
      quota?: ColdMailQuota | null;
    }>("cold-mail", { body: { action: "quota_status" } })
      .then((response) => {
        if (active) setColdMailQuota(response.quota || null);
      })
      .catch(() => {
        if (active) setColdMailQuota(null);
      });
    return () => {
      active = false;
    };
  }, [isColdMailPreset, open]);

  // Sync tab and tone defaults when recipe or open changes
  useEffect(() => {
    if (open) {
      if (recipeId === "followup_bump") {
        setActiveTab("applied");
        setTone("friendly");
      } else if (recipeId === "instant_job_pitch") {
        setActiveTab("searched");
        setTone("casual");
      } else {
        setActiveTab("searched");
        setTone("casual");
      }
      setSearchFilter("");
      setShowCustomForm(false);
      if (recipeId === "recruiter_cold_outreach") setCustomJobs([]);
    }
  }, [open, recipeId]);

  // Fetch jobs and applications on open
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        let activeUserId = userId;
        if (!activeUserId) {
          const { data: authData } = await supabase.auth.getUser();
          activeUserId = authData.user?.id;
        }

        if (!activeUserId) return;

        // Fetch searched jobs
        const { data: jobs } = await supabase
          .from("jobs")
          .select("id, title, company, location, lead_quality_score, created_at")
          .eq("user_id", activeUserId)
          .order("created_at", { ascending: false })
          .limit(30);

        // Fetch applications for follow-up
        const { data: apps } = await supabase
          .from("applications")
          .select("id, job_title, company, location, status, match_score, applied_date")
          .eq("user_id", activeUserId)
          .order("created_at", { ascending: false })
          .limit(30);

        if (!isMounted) return;

        const isFollowup = recipeId === "followup_bump";
        const limit = activeRecipe.defaultJobLimit || 3;

        const seenCompanies = new Set<string>();
        const mappedSearched: PresetJobItem[] = [];

        (jobs || []).forEach((j) => {
          const norm = (j.company || "").toLowerCase().trim();
          if (!norm || seenCompanies.has(norm)) return;
          seenCompanies.add(norm);
          mappedSearched.push({
            id: j.id,
            company: j.company,
            title: j.title || "Target Position",
            source: "searched",
            matchScore: j.lead_quality_score ? Math.min(99, Math.max(65, j.lead_quality_score)) : 88,
            location: j.location || "Remote / Hybrid",
            selected: !isFollowup && mappedSearched.length < limit,
          });
        });

        const mappedApplied: PresetJobItem[] = (apps || []).map((a, index) => ({
          id: a.id,
          company: a.company,
          title: a.job_title || "Target Position",
          source: "applied",
          matchScore: a.match_score || 85,
          location: a.location || "Remote",
          appliedDate: a.applied_date ? new Date(a.applied_date).toLocaleDateString() : undefined,
          selected: isFollowup && index < limit,
        }));

        setSearchedJobs(mappedSearched);
        setAppliedJobs(mappedApplied);
      } catch (err) {
        console.error("Failed to load preset jobs", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [open, supabase, userId, recipeId, activeRecipe.defaultJobLimit]);

  // Selected jobs across searched, applied, and custom
  const selectedJobs = useMemo(() => {
    const list: PresetJobItem[] = [];
    searchedJobs.forEach((j) => j.selected && list.push(j));
    appliedJobs.forEach((j) => j.selected && list.push(j));
    customJobs.forEach((j) => j.selected && list.push(j));
    return list;
  }, [searchedJobs, appliedJobs, customJobs]);

  const toggleJob = (id: string, source: "searched" | "applied" | "custom") => {
    if (isColdMailPreset) {
      setSearchedJobs((prev) =>
        prev.map((job) => ({ ...job, selected: source === "searched" && job.id === id })),
      );
      setAppliedJobs((prev) => prev.map((job) => ({ ...job, selected: false })));
      setCustomJobs([]);
      return;
    }
    if (source === "searched") {
      setSearchedJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, selected: !j.selected } : j)),
      );
    } else if (source === "applied") {
      setAppliedJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, selected: !j.selected } : j)),
      );
    } else {
      setCustomJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, selected: !j.selected } : j)),
      );
    }
  };

  const removeSelectedJob = (id: string) => {
    setSearchedJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, selected: false } : j)),
    );
    setAppliedJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, selected: false } : j)),
    );
    setCustomJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const handleSelectAllCurrentTab = () => {
    if (activeTab === "searched") {
      const allSelected = searchedJobs.every((j) => j.selected);
      setSearchedJobs((prev) => prev.map((j) => ({ ...j, selected: !allSelected })));
    } else {
      const allSelected = appliedJobs.every((j) => j.selected);
      setAppliedJobs((prev) => prev.map((j) => ({ ...j, selected: !allSelected })));
    }
  };

  const handleAddCustomJob = () => {
    if (!customCompany.trim() || !customTitle.trim()) return;
    const newJob: PresetJobItem = {
      id: `custom-${Date.now()}`,
      company: customCompany.trim(),
      title: customTitle.trim(),
      source: "custom",
      matchScore: 90,
      selected: true,
    };
    setCustomJobs((prev) => [newJob, ...prev]);
    setCustomCompany("");
    setCustomTitle("");
    setShowCustomForm(false);
  };

  // Compile structured agentic prompt and dispatch to AI Chat
  const handleLaunchAgenticOutreach = () => {
    if (selectedJobs.length === 0) return;
    if (
      isColdMailPreset &&
      (selectedJobs.length !== 1 || selectedJobs[0].source !== "searched")
    ) return;

    const jobLines = selectedJobs
      .map(
        (j, i) =>
          `${i + 1}. **${j.company}** - ${j.title}${
            j.source === "applied" ? " (Follow-up on submitted application)" : ""
          }${j.appliedDate ? ` [Applied: ${j.appliedDate}]` : ""}`,
      )
      .join("\n");

    let prompt = "";

    if (activeRecipe.id === "instant_job_pitch") {
      const toneLabel =
        tone === "bold"
          ? "Executive Bold & High-Agency"
          : tone === "technical"
            ? "Technical, Metric-Focused & Direct"
            : "Startup Casual & Authentic";

      prompt = `🎯 **Instant Job Pitch & Cover Letter Preset**

Please generate role-tailored introductory pitches and custom cover letters for the following target positions:
${jobLines}

**Configuration**:
- **Tone**: ${toneLabel}
- **Deliverables**:
  1. **LinkedIn InMail / DM Pitch**: A high-impact 100-150 word note designed to start a warm conversation with the hiring team or founder.
  2. **Tailored Cover Letter**: A focused, persuasive letter connecting my background and achievements to the specific requirements of the role.
  3. **2-Sentence Hook**: A punchy opening hook highlighting why I am an exceptional fit.`;
    } else if (activeRecipe.id === "followup_bump") {
      const strategyLabel =
        tone === "value_add"
          ? "Value-Add Update (Highlight new relevant project/skills)"
          : tone === "timeline"
            ? "Decision Timeline Check (Polite inquiry about interview stages)"
            : "Friendly & Professional Nudge (Courteous check-in on submitted application)";

      prompt = `🎯 **Application Follow-Up Bump Preset**

Please prepare polite, strategic follow-up outreach messages for the following submitted applications:
${jobLines}

**Configuration**:
- **Follow-Up Strategy**: ${strategyLabel}
- **Workflow Steps**:
  1. Reference my application submission date and confirm continued enthusiasm for the role.
  2. Incorporate a concise value-add update highlighting relevant achievements or portfolio evidence.
  3. Prepare and sync the follow-up email drafts directly into my connected Gmail workspace for review before sending.`;
    } else {
      const toneLabel =
        tone === "bold"
          ? "Executive Bold & High-Agency"
          : tone === "punchy"
            ? "Short & Punchy (<80 words)"
            : "Startup Casual & Authentic";

      prompt = `🎯 **1-Click Recruiter Cold Outreach Preset**

Please execute an autonomous recruiter cold outreach workflow for the following target positions:
${jobLines}

**Outreach Configuration**:
- **Tone**: ${toneLabel}
- **Step 1**: Pull verified recruiter, talent acquisition, and hiring manager contact emails for each company.
- **Step 2**: Craft tailored, high-conversion outreach pitches highlighting relevant achievements from my profile and resume.
- **Step 3**: Prepare and sync the drafts directly into my connected Gmail workspace for review before sending.`;
    }

    onOpenChange(false);
    if (isColdMailPreset) {
      const selectedJob = selectedJobs[0];
      onLaunchPrompt(prompt, {
        presetId: "recruiter_cold_outreach",
        jobId: selectedJob.id,
        companyName: selectedJob.company,
        jobTitle: selectedJob.title,
        clientRunId: crypto.randomUUID(),
      });
    } else {
      onLaunchPrompt(prompt);
    }
  };

  const toneOptions = useMemo(() => {
    if (activeRecipe.id === "followup_bump") {
      return [
        { id: "friendly", label: "Friendly Check-In" },
        { id: "value_add", label: "Value-Add Update" },
        { id: "timeline", label: "Timeline Inquiry" },
      ];
    }
    if (activeRecipe.id === "instant_job_pitch") {
      return [
        { id: "casual", label: "Startup Casual" },
        { id: "bold", label: "Executive Bold" },
        { id: "technical", label: "Technical & Direct" },
      ];
    }
    return [
      { id: "casual", label: "Startup Casual" },
      { id: "bold", label: "Executive Bold" },
      { id: "punchy", label: "Short & Punchy" },
    ];
  }, [activeRecipe.id]);

  const launchButtonLabel = useMemo(() => {
    const count = selectedJobs.length;
    if (activeRecipe.id === "instant_job_pitch") {
      return `Generate Pitch & Cover Letter in AI Chat (${count} Position${count === 1 ? "" : "s"})`;
    }
    if (activeRecipe.id === "followup_bump") {
      return `Draft Follow-Up Nudges in AI Chat (${count} Application${count === 1 ? "" : "s"})`;
    }
    return `Launch Recruiter Outreach in AI Chat (${count} Position${count === 1 ? "" : "s"})`;
  }, [activeRecipe.id, selectedJobs.length]);

  // Filtered job list for current tab
  const currentList = activeTab === "searched" ? searchedJobs : appliedJobs;
  const filteredList = useMemo(() => {
    if (!searchFilter.trim()) return currentList;
    const q = searchFilter.toLowerCase().trim();
    return currentList.filter(
      (j) =>
        j.company.toLowerCase().includes(q) ||
        j.title.toLowerCase().includes(q) ||
        (j.location && j.location.toLowerCase().includes(q)),
    );
  }, [currentList, searchFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card/98 border border-brand/30 shadow-2xl backdrop-blur-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border/80 bg-background/50">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-brand/15 text-brand border border-brand/30 shrink-0">
              {activeRecipe.id === "instant_job_pitch" ? (
                <Sparkles className="size-4 text-blue-400" />
              ) : activeRecipe.id === "followup_bump" ? (
                <RefreshCw className="size-4 text-purple-400" />
              ) : (
                <Zap className="size-4 fill-brand/20 text-brand" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground">
                  {activeRecipe.title}
                </DialogTitle>
                <span className="text-[10px] bg-brand/20 text-brand px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  {activeRecipe.badge || "Preset"}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {activeRecipe.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step-by-Step Flow Indicator */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/60">
            {activeRecipe.stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-2">
                <span className="size-5 rounded-full bg-brand/20 text-brand flex items-center justify-center text-[10px] font-bold shrink-0">
                  {stage.stepNumber}
                </span>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold text-foreground truncate">
                    {stage.label}
                  </span>
                  <span className="block text-[10px] text-muted-foreground truncate">
                    {stage.description}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Active Selected Jobs Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-brand" />
                Selected Roles ({selectedJobs.length}):
              </span>
              {isColdMailPreset && coldMailQuota ? (
                <span className="text-[11px] text-muted-foreground">
                  {coldMailQuota.remaining} / {coldMailQuota.limit} runs remaining
                </span>
              ) : selectedJobs.length > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  Est. ~{selectedJobs.length * 5} credits
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-2 rounded-xl border border-border/60 bg-muted/20">
              {selectedJobs.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                  No positions selected yet. Choose from the list below or add a custom role.
                </span>
              ) : (
                selectedJobs.map((job) => (
                  <span
                    key={job.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-brand/10 border border-brand/30 text-foreground font-medium"
                  >
                    <Building2 className="size-3 text-brand" />
                    <span>{job.company}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      ({job.title})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSelectedJob(job.id)}
                      className="text-muted-foreground hover:text-destructive p-0.5 rounded ml-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Quick Add Custom Job Drawer */}
          {!isColdMailPreset && <div className="rounded-xl border border-border/70 bg-background/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="size-3.5 text-brand" />
                Target Another Company or Title:
              </span>
              <button
                type="button"
                onClick={() => setShowCustomForm((prev) => !prev)}
                className="text-[11px] text-brand hover:underline font-semibold"
              >
                {showCustomForm ? "Cancel" : "+ Add Custom Position"}
              </button>
            </div>

            {showCustomForm && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
                <input
                  type="text"
                  placeholder="Company Name (e.g. Anthropic)"
                  value={customCompany}
                  onChange={(e) => setCustomCompany(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-foreground outline-none focus:border-brand"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Role Title (e.g. Software Engineer)"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-card border border-border text-foreground outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomJob}
                    disabled={!customCompany.trim() || !customTitle.trim()}
                    className="px-3 py-1.5 rounded-lg bg-brand text-black text-xs font-bold hover:bg-brand/90 transition-colors shrink-0 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>}

          {isColdMailPreset && (
            <div className="rounded-xl border border-border/70 bg-background/50 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Gmail draft connection</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {gmailConnected
                    ? `Connected${gmailStatus?.identifier ? ` as ${gmailStatus.identifier}` : ""}`
                    : "Connect Gmail before starting the recruiter search."}
                </p>
              </div>
              {!gmailConnected && GMAIL_INTEGRATION && (
                <button
                  type="button"
                  onClick={() => void coldMailGmail.connect(GMAIL_INTEGRATION)}
                  disabled={coldMailGmail.isBusy}
                  className="px-3 py-1.5 rounded-lg bg-muted text-xs font-semibold text-foreground hover:bg-muted/80 disabled:opacity-50"
                >
                  {coldMailGmail.isBusy ? "Connecting…" : "Connect Gmail"}
                </button>
              )}
            </div>
          )}

          {/* Tab Selection: Searched Jobs vs Applied Jobs */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("searched")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "searched"
                      ? "bg-brand text-black shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Search className="size-3" />
                  <span>Searched Jobs ({searchedJobs.length})</span>
                </button>
                {!isColdMailPreset && <button
                  type="button"
                  onClick={() => setActiveTab("applied")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "applied"
                      ? "bg-brand text-black shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <History className="size-3" />
                  <span>Applied Jobs Follow-up ({appliedJobs.length})</span>
                </button>}
              </div>

              {!isColdMailPreset && <button
                type="button"
                onClick={handleSelectAllCurrentTab}
                className="text-[11px] text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
              >
                <span>Select / Deselect All</span>
              </button>}
            </div>

            {/* Filter Search Box */}
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={`Search in ${activeTab === "searched" ? "searched jobs" : "applications"}...`}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-background/80 border border-border text-foreground outline-none focus:border-brand"
              />
            </div>

            {/* Jobs List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="size-5 text-brand animate-spin" />
                  <span className="text-xs">Loading positions...</span>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {searchFilter
                    ? "No positions match your search filter."
                    : activeTab === "searched"
                      ? "No searched jobs found. Use the job finder or add a custom role."
                      : "No tracked applications found yet."}
                </div>
              ) : (
                filteredList.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => toggleJob(job.id, job.source)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      job.selected
                        ? "bg-brand/10 border-brand/40 text-foreground"
                        : "bg-background/60 hover:bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {job.selected ? (
                        <CheckSquare className="size-4 text-brand shrink-0" />
                      ) : (
                        <Square className="size-4 text-muted-foreground/60 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {job.company}
                          </span>
                          {job.matchScore && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-bold text-muted-foreground">
                              {job.matchScore}%
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {job.title} {job.location ? `• ${job.location}` : ""}
                        </p>
                      </div>
                    </div>

                    {job.appliedDate && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        Applied: {job.appliedDate}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tone Configuration */}
          <div className="pt-2 border-t border-border/70 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-brand" />
              {activeRecipe.id === "followup_bump"
                ? "Follow-Up Strategy:"
                : "Outreach Pitch Tone:"}
            </span>
            <div className="flex items-center gap-1.5">
              {toneOptions.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    tone === t.id
                      ? "bg-brand text-black font-bold shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer with Primary Launch Action */}
        <div className="p-4 border-t border-border/80 bg-background/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              selectedJobs.length === 0 ||
              (isColdMailPreset && (!gmailConnected || selectedJobs.length !== 1))
            }
            onClick={handleLaunchAgenticOutreach}
            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-black font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50 cursor-pointer"
          >
            {activeRecipe.id === "instant_job_pitch" ? (
              <Sparkles className="size-4 text-black" />
            ) : activeRecipe.id === "followup_bump" ? (
              <RefreshCw className="size-4 text-black" />
            ) : (
              <Zap className="size-4 fill-black text-black" />
            )}
            <span className="text-black">{launchButtonLabel}</span>
            <ArrowRight className="size-3.5 ml-0.5 text-black" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { RecruiterOutreachPresetModal as ChatActionPresetModal };
