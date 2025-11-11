import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  GaugeCircle,
  Target,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { useResumes } from "@/hooks/useResumes";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { useOpenAiStore } from "../stores/openai";
import { parsePdfFile } from "../../utils/parsePdf";
import { analyzeResumeWithOpenAI, type ResumeAnalysisResult } from "../../services/ai/analyzeResume";

interface HistoryEntry {
  result: ResumeAnalysisResult;
  analyzedAt: number;
}

async function parseResumeBlob(blob: Blob, extension: string | null, basename: string): Promise<string> {
  const ext = (extension || "").toLowerCase();
  
  if (ext === "pdf") {
    const file = new File([blob], `${basename || "resume"}.pdf`, { type: "application/pdf" });
    const parsed = await parsePdfFile(file);
    return parsed.text;
  }
  
  if (["txt", "text", "md", "markdown"].includes(ext)) {
    return await blob.text();
  }
  
  if (ext === "json") {
    try {
      const raw = await blob.text();
      const obj = JSON.parse(raw);
      return JSON.stringify(obj, null, 2).slice(0, 18000);
    } catch {
      return await blob.text();
    }
  }
  
  throw new Error("Only PDF or text-based resumes are supported for AI analysis right now.");
}

export function ResumeChecker() {
  // All hooks called unconditionally at top level
  const { resumes, getSignedUrl } = useResumes();
  const { profile, experiences, education, skills } = useProfileSettings();
  const openAiState = useOpenAiStore();
  const apiKey = openAiState?.apiKey || null;
  const model = openAiState?.model || null;
  const baseURL = openAiState?.baseURL || null;

  // State declarations
  const [selectedResume, setSelectedResume] = useState<string>("");
  const [history, setHistory] = useState<Record<string, HistoryEntry>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumePreview, setResumePreview] = useState<string>("");
  
  const lastPreviewedIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoized values
  const activeResume = useMemo(() => {
    return resumes.find((r) => r.id === selectedResume) || null;
  }, [resumes, selectedResume]);

  const activeEntry = useMemo(() => {
    return selectedResume && history[selectedResume] ? history[selectedResume] : null;
  }, [selectedResume, history]);

  const analysis = useMemo(() => {
    return activeEntry?.result || null;
  }, [activeEntry]);

  const lastAnalyzedAt = useMemo(() => {
    return activeEntry?.analyzedAt || null;
  }, [activeEntry]);

  // Profile summary computation
  const profileSummary = useMemo(() => {
    if (!profile) return "Profile not completed.";
    
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown";
    const title = profile.job_title || "n/a";
    const years = profile.experience_years != null ? `${profile.experience_years} yrs` : "n/a";
    const location = profile.location || "n/a";
    const goals = Array.isArray(profile.goals) && profile.goals.length ? profile.goals.join(", ") : "n/a";
    
    const experiencesData = experiences?.data || [];
    const educationData = education?.data || [];
    const skillsData = skills?.data || [];
    
    const roleLines = experiencesData.slice(0, 3).map((exp: any) => {
      const span = exp.end_date ? `${exp.start_date} → ${exp.end_date}` : `${exp.start_date} → present`;
      return `${exp.title || "Role"} at ${exp.company || "Company"} (${span})`;
    });
    
    const skillLine = skillsData
      .slice(0, 12)
      .map((skill: any) => (skill.level ? `${skill.name} (${skill.level})` : skill.name))
      .join(", ");
    
    const eduLine = educationData
      .slice(0, 2)
      .map((ed: any) => `${ed.degree || ""} - ${ed.school || ""}`)
      .join(" | ");
    
    return [
      `Name: ${fullName}`,
      `Target Title: ${title}`,
      `Experience: ${years}`,
      `Location: ${location}`,
      `Goals: ${goals}`,
      roleLines.length ? `Recent Roles: ${roleLines.join(" | ")}` : null,
      skillLine ? `Key Skills: ${skillLine}` : null,
      eduLine ? `Education: ${eduLine}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }, [profile, experiences, education, skills]);

  // Auto-select first resume
  useEffect(() => {
    if (!selectedResume && resumes.length > 0) {
      setSelectedResume(resumes[0].id);
    }
  }, [resumes, selectedResume]);

  // Load resume preview
  useEffect(() => {
    // Cleanup previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!activeResume?.id || !activeResume?.file_path) {
      lastPreviewedIdRef.current = null;
      setResumePreview("");
      return;
    }

    if (lastPreviewedIdRef.current === activeResume.id) {
      return;
    }
    
    lastPreviewedIdRef.current = activeResume.id;
    setResumePreview("");
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    (async () => {
      try {
        const url = await getSignedUrl(activeResume.file_path);
        if (!url || controller.signal.aborted) {
          if (!controller.signal.aborted) lastPreviewedIdRef.current = null;
          return;
        }
        
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok || controller.signal.aborted) {
          if (!controller.signal.aborted) lastPreviewedIdRef.current = null;
          return;
        }
        
        const blob = await res.blob();
        const text = await parseResumeBlob(blob, activeResume.file_ext, activeResume.name);
        if (!controller.signal.aborted) {
          setResumePreview(text.slice(0, 600));
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          lastPreviewedIdRef.current = null;
        }
      }
    })();
    
    return () => {
      controller.abort();
    };
  }, [activeResume?.id, activeResume?.file_path, activeResume?.file_ext, activeResume?.name, getSignedUrl]);

  // Analyze handler
  const handleAnalyze = useCallback(async () => {
    if (!apiKey) {
      setError("Add an OpenAI API key in Settings → Integrations to run the checker.");
      return;
    }
    if (!activeResume) {
      setError("Select a resume to analyze.");
      return;
    }
    if (!activeResume.file_path) {
      setError("This resume has no file attached yet. Upload or export it first.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const url = await getSignedUrl(activeResume.file_path);
      if (!url) throw new Error("Unable to retrieve resume file.");

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to download resume file.");

      const blob = await response.blob();
      const text = await parseResumeBlob(blob, activeResume.file_ext, activeResume.name);

      if (!text.trim()) {
        throw new Error("Resume appears empty or unsupported. Convert it to PDF or text.");
      }

      const normalized = text.slice(0, 15000);
      const result = await analyzeResumeWithOpenAI({
        resumeText: normalized,
        profileSummary,
        apiKey,
        model: model || undefined,
        baseURL: baseURL || undefined,
      });

      setHistory((prev) => ({
        ...prev,
        [activeResume.id]: { result, analyzedAt: Date.now() },
      }));
    } catch (err: any) {
      setError(err?.message || "Resume analysis failed.");
    } finally {
      setLoading(false);
    }
  }, [apiKey, activeResume, getSignedUrl, profileSummary, model, baseURL]);

  const SCORE_LABELS = [
    { key: "overallScore" as const, label: "Overall Quality" },
    { key: "alignmentScore" as const, label: "Profile Alignment" },
    { key: "atsScore" as const, label: "ATS Readiness" },
    { key: "readabilityScore" as const, label: "Human Readability" },
  ];

  return (
    <Card className="bg-card/10 border-border/20">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-[#1dff00]" />
          <h3 className="text-lg font-semibold text-foreground">Resume Checker</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Run an AI-powered analysis to benchmark your resume against your profile and predict interview readiness.
        </p>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Left sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d0d0d] via-[#111] to-[#0a0a0a] p-4">
              <div className="space-y-3">
                {!resumes.length ? (
                  <p className="text-sm text-white/60">
                    No resumes found. Create or import one from the Resume Builder.
                  </p>
                ) : (
                  <Select value={selectedResume} onValueChange={setSelectedResume}>
                    <SelectTrigger className="bg-white/5 border-white/15 text-sm">
                      <SelectValue placeholder="Choose a resume" />
                    </SelectTrigger>
                    <SelectContent>
                      {resumes.map((resume: any) => (
                        <SelectItem key={resume.id} value={resume.id}>
                          <div className="flex flex-col">
                            <span>{resume.name}</span>
                            <span className="text-[10px] uppercase text-white/40">
                              Updated {new Date(resume.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  onClick={handleAnalyze}
                  disabled={loading || !selectedResume || !apiKey}
                  className="w-full bg-[#1dff00]/80 text-black hover:bg-[#1dff00]"
                >
                  {loading ? "Analyzing…" : "Run Deep Analysis"}
                </Button>

                {!apiKey && (
                  <p className="text-[11px] text-amber-300/80">
                    Connect your OpenAI key in Settings → Integrations to enable intelligent resume scoring.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Profile Snapshot</p>
              <p className="mt-2 text-xs text-white/50 leading-relaxed whitespace-pre-line">
                {profileSummary || "Complete your profile to unlock alignment insights."}
              </p>
            </div>

            {resumePreview && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs font-medium text-white/70 uppercase tracking-wide">Resume Sample</p>
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] text-white/50 thin-scrollbar">
                  {resumePreview}
                </pre>
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-[12px] text-red-200">
                <AlertTriangle className="mr-2 inline h-3.5 w-3.5" />
                {error}
              </div>
            )}
          </div>

          {/* Right content */}
          <div className="space-y-5">
            <motion.div
              key={analysis ? analysis.grade : "placeholder"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-[#1dff00]/25 bg-gradient-to-br from-[#0f2b12] via-[#071307] to-[#050505] p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[#1dff00]/60">Aggregate Score</p>
                  <div className="mt-2 flex items-end gap-3">
                    <span className="text-5xl font-black text-white">
                      {analysis ? analysis.overallScore : "--"}
                    </span>
                    <span className="text-sm text-white/60">/100</span>
                  </div>
                  <p className="mt-4 max-w-md text-sm text-white/70 leading-relaxed">
                    {analysis
                      ? analysis.summary
                      : "Select a resume and run the checker to see targeted guidance, weaknesses, and interview probability."}
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1dff00]/40 bg-black/60 px-6 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#1dff00]/70">Grade</p>
                  <span className="mt-2 text-4xl font-black text-[#1dff00]">
                    {analysis ? analysis.grade : "–"}
                  </span>
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                    <GaugeCircle className="h-4 w-4 text-[#1dff00]" />
                    <span>
                      {analysis ? `${analysis.jobFitLikelihood}% interview readiness` : "Awaiting scan"}
                    </span>
                  </div>
                  {lastAnalyzedAt && (
                    <p className="mt-3 text-[10px] uppercase tracking-wide text-white/40">
                      Last run {new Date(lastAnalyzedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SCORE_LABELS.map(({ key, label }) => {
                const metricValue = analysis ? (analysis[key] as number) : 0;
                const displayValue = analysis ? metricValue : "--";
                return (
                  <div key={key} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{label}</p>
                      <span className="text-sm font-bold text-white">{displayValue}</span>
                    </div>
                    <Progress value={analysis ? metricValue : 0} className="mt-3 h-2" />
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[
                {
                  title: "Key Strengths",
                  icon: ShieldCheck,
                  items: analysis?.strengths,
                  placeholder: "Run the checker to surface signature wins worth keeping.",
                  accent: "positive" as const,
                },
                {
                  title: "Critical Gaps",
                  icon: AlertTriangle,
                  items: analysis?.gaps,
                  placeholder: "Gaps and ATS blockers will appear here.",
                  accent: "warning" as const,
                },
              ].map(({ title, icon: Icon, items, placeholder, accent }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <Icon
                      className={`h-4 w-4 ${
                        accent === "positive" ? "text-[#1dff00]" : "text-amber-300"
                      }`}
                    />
                    <p className="text-sm font-semibold">{title}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {loading && !items?.length && (
                      <>
                        <Skeleton className="h-6 w-full rounded-lg bg-white/10" />
                        <Skeleton className="h-6 w-5/6 rounded-lg bg-white/10" />
                      </>
                    )}
                    {!loading && (!items || items.length === 0) && (
                      <p className="text-xs text-white/50">{placeholder}</p>
                    )}
                    {items && items.length > 0 && (
                      <ul className="space-y-2">
                        {items.map((item: string, idx: number) => (
                          <li
                            key={`${title}-${idx}`}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="flex items-center gap-2 text-white">
                <Target className="h-4 w-4 text-[#1dff00]" />
                <p className="text-sm font-semibold">High-Impact Recommendations</p>
              </div>
              <div className="mt-4 space-y-3">
                {loading && !analysis?.recommendations?.length && (
                  <>
                    <Skeleton className="h-7 w-full rounded-lg bg-white/10" />
                    <Skeleton className="h-7 w-5/6 rounded-lg bg-white/10" />
                    <Skeleton className="h-7 w-4/6 rounded-lg bg-white/10" />
                  </>
                )}
                {!loading && (!analysis?.recommendations || analysis.recommendations.length === 0) && (
                  <p className="text-xs text-white/50">
                    Actionable playbooks will unlock after you run an analysis.
                  </p>
                )}
                {analysis?.recommendations && analysis.recommendations.length > 0 && (
                  <ul className="space-y-3">
                    {analysis.recommendations.map((rec: any, idx: number) => (
                      <li
                        key={`rec-${idx}`}
                        className="rounded-xl border border-white/10 bg-gradient-to-r from-[#1dff00]/5 via-transparent to-transparent px-4 py-3 text-sm text-white/80"
                      >
                        <p className="font-semibold text-white">{rec.focus}</p>
                        <p className="mt-1 text-xs text-white/70">{rec.action}</p>
                        {rec.impact && (
                          <p className="mt-2 text-xs uppercase tracking-wide text-[#1dff00]/80">
                            Impact: {rec.impact}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {analysis?.atsRiskNarrative && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-4 w-4 text-[#1dff00]" />
                  <p className="text-sm font-semibold">ATS & Recruiter Risk Report</p>
                </div>
                <p className="mt-3 text-sm text-white/60 leading-relaxed">{analysis.atsRiskNarrative}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

