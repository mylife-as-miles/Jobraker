import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Sparkles,
  UploadCloud,
  FileText,
  Wand2,
  ShieldCheck,
  User,
  Briefcase,
  MapPin,
  Target,
  GraduationCap,
  Zap,
  Check,
  Plus,
  X,
  Loader2,
  Building,
  Award,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../../lib/supabaseClient";
import { parsePdfFile } from "@/utils/parsePdf";
import { analyzeResumeText } from "@/utils/analyzeResume";
import { hashEmbedding } from "@/utils/hashEmbedding";
import {
  buildFallbackParsedProfileData,
  parseResumeWithAI,
  type ParsedProfileData,
} from "@/services/ai/parseResumeProfile";
import { persistParsedResume } from "@/lib/parsedResume";
import { mapParsedDataToResume } from "@/lib/resume-mapper";
import { initialResumeState } from "@/store/artboard";
import { events } from "@/lib/analytics";
import { sanitizeStructuredPayload } from "@/lib/inputSecurity";
import { logSecurityEvent } from "@/utils/sessionManagement";
import { SUBSCRIPTION_MARKETING_PLANS } from "@/lib/subscriptionAccess";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

interface EducationItem {
  school?: string;
  degree?: string;
  start?: string;
  end?: string;
}

const STEP_DEFINITIONS = [
  { id: 1, label: "Identity", icon: User },
  { id: 2, label: "Role", icon: Briefcase },
  { id: 3, label: "Location", icon: MapPin },
  { id: 4, label: "Goals", icon: Target },
  { id: 5, label: "Summary", icon: FileText },
  { id: 6, label: "Skills", icon: Zap },
  { id: 7, label: "Education", icon: GraduationCap },
  { id: 8, label: "Plan", icon: Award },
];

const SUGGESTED_SKILLS_BY_TITLE: Record<string, string[]> = {
  default: [
    "Project Management",
    "Communication",
    "Problem Solving",
    "Data Analysis",
    "Leadership",
    "Strategy",
  ],
  engineer: [
    "TypeScript",
    "React",
    "Node.js",
    "Python",
    "PostgreSQL",
    "System Design",
    "Docker",
    "GraphQL",
  ],
  manager: [
    "Agile / Scrum",
    "Stakeholder Management",
    "Product Strategy",
    "Team Leadership",
    "Roadmapping",
    "OKRs",
  ],
  designer: [
    "UI/UX Design",
    "Figma",
    "Design Systems",
    "Prototyping",
    "User Research",
    "Wireframing",
  ],
  marketer: [
    "SEO",
    "Growth Marketing",
    "Content Strategy",
    "Google Analytics",
    "Email Campaigns",
    "Copywriting",
  ],
};

export const Onboarding = (): JSX.Element => {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const [currentStep, setCurrentStep] = useState(0);
  const [mode, setMode] = useState<null | "manual" | "resume">(null);

  // Resume upload states
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form saving state
  const [saving, setSaving] = useState(false);

  // Plan states
  const [selectedPlan, setSelectedPlan] = useState<string>(() => {
    return localStorage.getItem("selectedPlan") || "Pro";
  });
  const [selectedBilling, setSelectedBilling] = useState<string>(() => {
    return localStorage.getItem("selectedBilling") || "monthly";
  });

  // Form data state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    jobTitle: "",
    experience: "3",
    location: "",
    workPreference: "Remote",
    goals: ["Find a new job", "Better salary"],
    about: "",
    skills: [] as string[],
    education: [] as EducationItem[],
  });

  // Load existing profile if available
  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile || !active) return;

        const { data: edu } = await supabase
          .from("profile_education")
          .select("*")
          .eq("user_id", user.id);
        const { data: sks } = await supabase
          .from("profile_skills")
          .select("*")
          .eq("user_id", user.id);

        setFormData((prev) => ({
          ...prev,
          firstName: profile.first_name || prev.firstName,
          lastName: profile.last_name || prev.lastName,
          phone: profile.phone || prev.phone,
          jobTitle: profile.job_title || prev.jobTitle,
          experience:
            profile.experience_years != null
              ? String(profile.experience_years)
              : prev.experience,
          location: profile.location || prev.location,
          goals:
            Array.isArray(profile.goals) && profile.goals.length > 0
              ? profile.goals
              : prev.goals,
          about: profile.about || prev.about,
          skills: sks && sks.length > 0 ? sks.map((s) => s.name) : prev.skills,
          education:
            edu && edu.length > 0
              ? edu.map((e) => ({
                  school: e.school || "",
                  degree: e.degree || "",
                  start: e.start_date ? e.start_date.split("-")[0] : "",
                  end: e.end_date ? e.end_date.split("-")[0] : "",
                }))
              : prev.education,
        }));
      } catch (err) {
        console.warn("Failed to load existing profile:", err);
      }
    };
    void loadProfile();
    return () => {
      active = false;
    };
  }, [supabase]);

  const updateFormData = useCallback((field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleGoal = useCallback((goal: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }));
  }, []);

  // Suggested skills based on current job title
  const suggestedSkills = useMemo(() => {
    const titleLower = formData.jobTitle.toLowerCase();
    if (titleLower.includes("engineer") || titleLower.includes("developer") || titleLower.includes("code")) {
      return SUGGESTED_SKILLS_BY_TITLE.engineer;
    }
    if (titleLower.includes("manager") || titleLower.includes("lead") || titleLower.includes("director")) {
      return SUGGESTED_SKILLS_BY_TITLE.manager;
    }
    if (titleLower.includes("design") || titleLower.includes("ux") || titleLower.includes("ui")) {
      return SUGGESTED_SKILLS_BY_TITLE.designer;
    }
    if (titleLower.includes("market") || titleLower.includes("growth") || titleLower.includes("seo")) {
      return SUGGESTED_SKILLS_BY_TITLE.marketer;
    }
    return SUGGESTED_SKILLS_BY_TITLE.default;
  }, [formData.jobTitle]);

  // Profile completion calculation
  const completionPercentage = useMemo(() => {
    let score = 0;
    if (formData.firstName.trim()) score += 15;
    if (formData.lastName.trim()) score += 10;
    if (formData.jobTitle.trim()) score += 20;
    if (formData.location.trim()) score += 15;
    if (formData.goals.length > 0) score += 10;
    if (formData.about.trim()) score += 10;
    if (formData.skills.length > 0) score += 10;
    if (formData.education.length > 0) score += 10;
    return Math.min(100, score);
  }, [formData]);

  // Experience level label helper
  const experienceLabel = useMemo(() => {
    const yrs = parseInt(formData.experience || "0", 10);
    if (yrs <= 2) return "Entry Level (0-2 yrs)";
    if (yrs <= 5) return "Mid-Level (3-5 yrs)";
    if (yrs <= 8) return "Senior (6-8 yrs)";
    if (yrs <= 12) return "Lead / Staff (9-12 yrs)";
    return "Executive (13+ yrs)";
  }, [formData.experience]);

  // Handle Resume File Upload & AI Parsing
  const handleResumeFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || !fileList.length) return;
      const file = fileList[0];
      setUploading(true);
      setParseError(null);
      setUploadProgress(10);

      try {
        const MAX_MB = 8;
        if (file.size > MAX_MB * 1024 * 1024) {
          throw new Error(`File exceeds ${MAX_MB}MB limit`);
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
        const allowedExtensions = /^(pdf|txt|md|rtf)$/;
        if (!allowedExtensions.test(ext)) {
          await logSecurityEvent(
            user.id,
            "blocked_malicious_upload",
            `User attempted to upload file with unallowed extension: .${ext} (${file.name})`,
            "medium"
          );
          throw new Error("Invalid file type. Only PDF, TXT, MD, and RTF files are allowed.");
        }

        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const bytes = await file.arrayBuffer();
        const blob = new Blob([bytes], {
          type: file.type || "application/octet-stream",
        });
        setUploadProgress(30);

        const { error: upErr } = await (supabase as any).storage
          .from("resumes")
          .upload(path, blob, {
            upsert: false,
            contentType: file.type || undefined,
          });
        if (upErr) throw upErr;
        setUploadProgress(50);

        const resumeDisplayName = sanitizeStructuredPayload(file.name.replace(/\.[^.]+$/, "")) as string;
        const insertPayload = {
          user_id: user.id,
          name: resumeDisplayName,
          template: null,
          status: "Draft",
          applications: 0,
          thumbnail: null,
          is_favorite: true,
          file_path: path,
          file_ext: ext,
          size: file.size,
        };

        const { data: resumeRow, error: insErr } = await (supabase as any)
          .from("resumes")
          .insert(insertPayload)
          .select("*")
          .single();
        if (insErr) throw insErr;
        setUploadProgress(65);

        setParsing(true);
        let rawText = "";
        let lines: string[] = [];
        if (ext === "pdf") {
          const parsedPdf = await parsePdfFile(file);
          rawText = parsedPdf.text;
          lines = parsedPdf.lines;
        } else {
          rawText = await file.text();
          lines = rawText
            .split(/\n+/)
            .map((l) => l.trim())
            .filter(Boolean);
        }
        if (!rawText?.trim()) {
          throw new Error(
            "Could not read text from this file. Try a clear PDF or plain text resume.",
          );
        }
        setUploadProgress(75);

        const analyzed = analyzeResumeText(rawText);
        let aiParsedData: ParsedProfileData | null = null;
        try {
          const hasSufficientText = rawText && rawText.trim().length >= 50;
          let pdfBase64: string | undefined = undefined;
          if (!hasSufficientText && ext === "pdf") {
            try {
              pdfBase64 = await fileToBase64(file);
            } catch (b64Err) {
              console.warn("Could not encode PDF to base64", b64Err);
            }
          }
          aiParsedData = await parseResumeWithAI({ resumeText: rawText, pdfBase64 });
          setUploadProgress(85);
        } catch (aiErr) {
          console.warn("AI parsing failed, using structural fallback:", aiErr);
        }

        const effective: ParsedProfileData =
          aiParsedData ??
          buildFallbackParsedProfileData(rawText, resumeDisplayName);
        setUploadProgress(90);

        try {
          await persistParsedResume({
            supabase,
            resumeId: resumeRow.id,
            userId: user.id,
            rawText: rawText.slice(0, 500000),
            json: {
              lines,
              entities: analyzed.entities,
              aiParsedData: aiParsedData ?? undefined,
            },
            structured: analyzed.structured,
            skills:
              effective.skills?.length > 0 ? effective.skills : analyzed.skills,
            embedding: hashEmbedding(rawText),
          });
        } catch (snapErr) {
          console.warn("parsed_resumes snapshot skipped:", snapErr);
        }

        const mappedResumeData = mapParsedDataToResume(
          effective,
          structuredClone(initialResumeState.data),
        );
        await (supabase as any)
          .from("resumes")
          .update({
            data: mappedResumeData,
            name:
              mappedResumeData.basics?.name?.trim() ||
              mappedResumeData.title ||
              resumeDisplayName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", resumeRow.id);

        const profileData = {
          first_name: effective.firstName || null,
          last_name: effective.lastName || null,
          phone: effective.phone || null,
          location: effective.location || null,
          job_title: effective.jobTitle || null,
          experience_years:
            effective.experienceYears != null &&
            !isNaN(Number(effective.experienceYears))
              ? Math.round(Number(effective.experienceYears))
              : null,
          about: effective.about || null,
          onboarding_complete: false,
          updated_at: new Date().toISOString(),
        };

        const sanitizedProfileData = sanitizeStructuredPayload(
          profileData
        ) as typeof profileData;

        if (effective.education?.length > 0) {
          const eduRows = effective.education
            .filter((e) => e.school || e.degree)
            .map((e) => ({
              user_id: user.id,
              degree: e.degree || "",
              school: e.school || "",
              location: "",
              start_date: e.start
                ? /^\d{4}$/.test(e.start)
                  ? `${e.start}-01-01`
                  : /^\d{4}-\d{2}$/.test(e.start)
                    ? `${e.start}-01`
                    : e.start
                : new Date().toISOString().split("T")[0],
              end_date:
                e.end && e.end !== "Present"
                  ? /^\d{4}$/.test(e.end)
                    ? `${e.end}-01-01`
                    : /^\d{4}-\d{2}$/.test(e.end)
                      ? `${e.end}-01`
                      : e.end
                  : null,
              gpa: null,
            }));
          const sanitizedEduRows = sanitizeStructuredPayload(eduRows) as typeof eduRows;
          if (sanitizedEduRows.length > 0) {
            try {
              await (supabase as any)
                .from("profile_education")
                .insert(sanitizedEduRows);
            } catch (eduErr) {
              console.warn("Failed to insert education:", eduErr);
            }
          }
        }

        if (effective.skills?.length > 0) {
          const skillRows = effective.skills
            .slice(0, 60)
            .map((name) => ({
              user_id: user.id,
              name: name.trim(),
              level: null,
              category: "",
            }))
            .filter((r) => r.name);
          const sanitizedSkillRows = sanitizeStructuredPayload(skillRows) as typeof skillRows;
          if (sanitizedSkillRows.length > 0) {
            try {
              await (supabase as any)
                .from("profile_skills")
                .insert(sanitizedSkillRows);
            } catch (skillErr) {
              console.warn("Failed to insert skills:", skillErr);
            }
          }
        }

        await (supabase as any)
          .from("profiles")
          .upsert({ id: user.id, ...sanitizedProfileData }, { onConflict: "id" });

        setUploadProgress(100);
        setParsed(true);
        setParsing(false);
      } catch (e: any) {
        const rawMessage = e?.message || String(e);
        let userMessage =
          "An unexpected error occurred while parsing your resume. Please try again.";

        if (rawMessage.includes("invalid input syntax for type integer")) {
          userMessage =
            "Resume parsing encountered an invalid format for experience years.";
        } else if (
          rawMessage.includes("File exceeds") ||
          rawMessage.includes("exceeds limit")
        ) {
          userMessage = "The resume file is too large. Please upload a file under 8MB.";
        } else if (
          rawMessage.includes("Not authenticated") ||
          rawMessage.includes("JWT")
        ) {
          userMessage = "Your session has expired. Please sign in again.";
        } else if (
          rawMessage.includes("Could not extract text") ||
          rawMessage.includes("Failed to extract text")
        ) {
          userMessage =
            "We couldn't read the text in this PDF. Please check that it's not a scanned image.";
        } else if (rawMessage.length < 90) {
          userMessage = rawMessage;
        }
        setParseError(userMessage);
      } finally {
        setUploading(false);
        setParsing(false);
      }
    },
    [supabase]
  );

  // Submit and Complete Onboarding (Manual Mode or Resume Pricing Step)
  const handleCompleteOnboarding = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signIn");
        return;
      }

      const startedAt = (user as any).created_at
        ? new Date((user as any).created_at).getTime()
        : undefined;
      const tier = (
        selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1).toLowerCase()
      ) as "Free" | "Basics" | "Pro" | "Ultimate";

      const profilePayload = {
        id: user.id,
        first_name: formData.firstName.trim() || null,
        last_name: formData.lastName.trim() || null,
        phone: formData.phone.trim() || null,
        job_title: formData.jobTitle.trim() || null,
        experience_years:
          formData.experience && !isNaN(Number(formData.experience))
            ? Math.round(Number(formData.experience))
            : null,
        location: formData.location.trim() || null,
        goals: formData.goals,
        about: formData.about.trim() || null,
        skills: formData.skills.length ? formData.skills : [],
        education:
          formData.education && formData.education.length
            ? JSON.stringify(formData.education)
            : null,
        onboarding_complete: true,
        subscription_tier: tier,
        updated_at: new Date().toISOString(),
      };

      const sanitizedProfilePayload = sanitizeStructuredPayload(
        profilePayload
      ) as typeof profilePayload;

      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert(sanitizedProfilePayload, { onConflict: "id" });

      if (profileErr) throw profileErr;

      // Safely insert normalize tables
      try {
        if (Array.isArray(formData.education) && formData.education.length > 0) {
          const eduRows = formData.education
            .filter((e) => (e.school || "").trim() || (e.degree || "").trim())
            .map((e) => ({
              user_id: user.id,
              degree: (e.degree || "").trim(),
              school: (e.school || "").trim(),
              location: "",
              start_date: e.start ? `${e.start}-01-01` : new Date().toISOString(),
              end_date: e.end ? `${e.end}-01-01` : null,
              gpa: null,
            }));
          const sanitizedEduRows = sanitizeStructuredPayload(eduRows) as typeof eduRows;
          if (sanitizedEduRows.length) {
            await supabase.from("profile_education").insert(sanitizedEduRows);
          }
        }

        if (Array.isArray(formData.skills) && formData.skills.length > 0) {
          const skillRows = formData.skills.slice(0, 60).map((name) => ({
            user_id: user.id,
            name: name.trim(),
            level: null,
            category: "",
          }));
          const sanitizedSkillRows = sanitizeStructuredPayload(
            skillRows
          ) as typeof skillRows;
          if (sanitizedSkillRows.length) {
            await supabase.from("profile_skills").insert(sanitizedSkillRows);
          }
        }
      } catch (normErr) {
        console.warn("Secondary table normalization notice:", normErr);
      }

      await logSecurityEvent(
        user.id,
        "onboarding_complete",
        `User completed onboarding using ${mode || "manual"} mode and selected plan: ${tier}`,
        "low"
      );

      try {
        const elapsed = startedAt ? Date.now() - startedAt : undefined;
        events.profileCompleted(elapsed as any);
      } catch {}

      navigate("/dashboard/overview");
    } catch (err: any) {
      console.error("Failed to save onboarding profile:", err);
      const rawMessage = err?.message || String(err);
      let userMessage =
        "Failed to save onboarding information. Please try again.";
      if (
        rawMessage.includes("JWT") ||
        rawMessage.includes("Not authenticated")
      ) {
        userMessage = "Your session has expired. Please log in again.";
      } else if (rawMessage.length < 80) {
        userMessage = rawMessage;
      }
      alert(userMessage);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEP_DEFINITIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      void handleCompleteOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      // Step 0 -> Go back to mode choice screen
      setMode(null);
    }
  };

  // Avatar Initials Helper
  const avatarInitials = useMemo(() => {
    const f = formData.firstName.trim().charAt(0).toUpperCase();
    const l = formData.lastName.trim().charAt(0).toUpperCase();
    if (f && l) return `${f}${l}`;
    if (f) return f;
    return "JR";
  }, [formData.firstName, formData.lastName]);

  // Render Step Content
  const renderStepComponent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  First Name <span className="text-brand">*</span>
                </label>
                <Input
                  placeholder="e.g. John"
                  value={formData.firstName}
                  onChange={(e) => updateFormData("firstName", e.target.value)}
                  className="h-11 bg-background/50 border-brand/20 text-foreground placeholder:text-foreground/30 focus:border-brand rounded-xl"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  Last Name <span className="text-brand">*</span>
                </label>
                <Input
                  placeholder="e.g. Doe"
                  value={formData.lastName}
                  onChange={(e) => updateFormData("lastName", e.target.value)}
                  className="h-11 bg-background/50 border-brand/20 text-foreground placeholder:text-foreground/30 focus:border-brand rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                Phone Number (Optional)
              </label>
              <Input
                placeholder="e.g. +1 (555) 019-2834"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
                className="h-11 bg-background/50 border-brand/20 text-foreground placeholder:text-foreground/30 focus:border-brand rounded-xl"
              />
              <p className="text-[11px] text-foreground/40">
                Used for recruiter outreach notifications and interview alerts.
              </p>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                Current or Target Job Title <span className="text-brand">*</span>
              </label>
              <Input
                placeholder="e.g. Senior Full Stack Engineer, Product Manager"
                value={formData.jobTitle}
                onChange={(e) => updateFormData("jobTitle", e.target.value)}
                className="h-11 bg-background/50 border-brand/20 text-foreground placeholder:text-foreground/30 focus:border-brand rounded-xl"
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                  Years of Professional Experience
                </label>
                <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 font-mono text-xs font-bold text-brand">
                  {formData.experience} Years ({experienceLabel})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={formData.experience}
                onChange={(e) => updateFormData("experience", e.target.value)}
                className="w-full h-2 rounded-lg bg-foreground/10 accent-brand cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-foreground/40 font-mono">
                <span>0 yrs (Entry)</span>
                <span>5 yrs (Mid)</span>
                <span>10 yrs (Senior)</span>
                <span>15+ yrs (Lead)</span>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                Your Primary Location <span className="text-brand">*</span>
              </label>
              <Input
                placeholder="e.g. New York, NY or London, UK"
                value={formData.location}
                onChange={(e) => updateFormData("location", e.target.value)}
                className="h-11 bg-background/50 border-brand/20 text-foreground placeholder:text-foreground/30 focus:border-brand rounded-xl"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                Work Location Preference
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "Remote", label: "Remote 🏠" },
                  { id: "Hybrid", label: "Hybrid 🏢" },
                  { id: "On-site", label: "On-site 📍" },
                ].map((pref) => {
                  const active = formData.workPreference === pref.id;
                  return (
                    <button
                      key={pref.id}
                      type="button"
                      onClick={() => updateFormData("workPreference", pref.id)}
                      className={`flex items-center justify-center py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        active
                          ? "border-brand bg-brand/15 text-brand shadow-[0_0_15px_rgba(47,217,104,0.15)]"
                          : "border-foreground/10 bg-background/40 text-foreground/70 hover:border-foreground/20 hover:text-foreground"
                      }`}
                    >
                      {pref.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-3">
            <p className="text-xs text-foreground/60 leading-relaxed mb-1">
              Select one or more goals so JobRaker's AI agents can optimize your auto-apply matches.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { id: "Find a new job", icon: RocketIcon, desc: "Land a role quickly" },
                { id: "Better salary", icon: DollarIcon, desc: "Increase target pay" },
                { id: "Career growth", icon: TrendingIcon, desc: "Level up title & scope" },
                { id: "Remote freedom", icon: LaptopIcon, desc: "Work from anywhere" },
                { id: "Switch industry", icon: RefreshIcon, desc: "Transition domain" },
                { id: "Executive Search", icon: AwardIcon, desc: "High-impact roles" },
              ].map((g) => {
                const selected = formData.goals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      selected
                        ? "border-brand bg-brand/15 text-foreground shadow-[0_0_15px_rgba(47,217,104,0.12)]"
                        : "border-foreground/10 bg-background/40 text-foreground/70 hover:border-foreground/20 hover:text-foreground"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs ${
                        selected
                          ? "border-brand bg-brand text-black font-bold"
                          : "border-foreground/20 bg-foreground/5 text-foreground/40"
                      }`}
                    >
                      {selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{g.id}</div>
                      <div className="text-[11px] text-foreground/50">{g.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                Professional Bio & Summary
              </label>
              <span className="text-[11px] text-foreground/40">
                {formData.about.length} / 500 chars
              </span>
            </div>
            <textarea
              placeholder="e.g. Accomplished software engineer with 5+ years of experience building high-scale distributed applications and leading front-end design systems..."
              value={formData.about}
              onChange={(e) => updateFormData("about", e.target.value.slice(0, 500))}
              className="w-full h-32 p-3.5 text-xs sm:text-sm bg-background/50 border border-brand/20 rounded-xl text-foreground placeholder:text-foreground/30 focus:border-brand focus:outline-none resize-none leading-relaxed"
              autoFocus
            />
            {/* Quick Template Prompts */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
                Quick Prompts (Click to add starter template):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Experienced SaaS developer with a track record of scaling user-facing applications.",
                  "Results-driven Product Manager specializing in B2B growth and user analytics.",
                  "Data Analyst skilled in SQL, Python, and translating data into strategic decisions.",
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateFormData("about", tmpl)}
                    className="text-[10px] border border-brand/20 bg-brand/5 text-brand/80 px-2 py-1 rounded-md hover:bg-brand/15 hover:text-brand transition-all text-left line-clamp-1"
                  >
                    "{tmpl.slice(0, 45)}..."
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <SkillInputWidget
              values={formData.skills}
              onChange={(vals) => updateFormData("skills", vals)}
            />

            {/* Suggested Skills */}
            <div className="space-y-2 pt-1 border-t border-foreground/10">
              <div className="text-[11px] font-semibold text-foreground/60 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                Suggested skills for <span className="text-brand font-bold">{formData.jobTitle || "your role"}</span>:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedSkills.map((sk) => {
                  const exists = formData.skills.includes(sk);
                  return (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => {
                        if (!exists) updateFormData("skills", [...formData.skills, sk]);
                      }}
                      disabled={exists}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 ${
                        exists
                          ? "border-brand/20 bg-brand/10 text-brand/50 cursor-default"
                          : "border-foreground/15 bg-background/40 text-foreground/80 hover:border-brand hover:text-brand"
                      }`}
                    >
                      <span>{sk}</span>
                      {!exists && <Plus className="h-3 w-3 text-brand" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <EducationEditorWidget
            values={formData.education}
            onChange={(vals) => updateFormData("education", vals)}
          />
        );

      case 7:
        return (
          <PricingSelectorWidget
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            selectedBilling={selectedBilling}
            setSelectedBilling={setSelectedBilling}
          />
        );

      default:
        return null;
    }
  };

  // Choice Screen View (mode === null)
  const renderChoiceScreen = (
    <div className="min-h-screen bg-[#08090d] text-foreground flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Radial mesh background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(circle_at_50%_0%,rgba(47,217,104,0.15),transparent_70%)] blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl w-full space-y-8 text-center">
        {/* Header Branding */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-brand/30 bg-brand/10 text-brand text-xs font-semibold uppercase tracking-wider shadow-[0_0_15px_rgba(47,217,104,0.15)]">
            <Sparkles className="w-3.5 h-3.5" /> Welcome to JobRaker
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-brand bg-clip-text text-transparent">
            Build Your AI Job Hunting Profile
          </h1>
          <p className="text-foreground/60 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Choose how you'd like to set up your account. Upload your resume for instant AI-powered profile creation, or proceed step-by-step.
          </p>
        </div>

        {/* Hero Cards Grid */}
        <div className="grid gap-5 md:grid-cols-2 text-left">
          {/* AI Resume Upload Card */}
          <div
            onClick={() => setMode("resume")}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-brand/40 bg-gradient-to-br from-card/90 via-card/50 to-card/20 p-6 sm:p-8 shadow-[0_0_30px_rgba(47,217,104,0.1)] hover:border-brand hover:shadow-[0_0_40px_rgba(47,217,104,0.25)] transition-all duration-300 backdrop-blur-xl flex flex-col justify-between"
          >
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-brand text-black text-[10px] font-extrabold uppercase tracking-wider shadow">
              ⚡ Recommended
            </div>
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-brand/20 border border-brand/40 flex items-center justify-center text-brand group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground group-hover:text-brand transition-colors">
                    AI-Powered Resume Upload
                  </h2>
                  <p className="text-xs text-foreground/50">Instant profile creation</p>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs text-foreground/75">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-brand text-[10px] font-bold">✓</span>
                  AI parses name, title, contact, skills & work history
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-brand text-[10px] font-bold">✓</span>
                  Creates your profile in under 15 seconds
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20 text-brand text-[10px] font-bold">✓</span>
                  Full edit control anytime in Dashboard Settings
                </li>
              </ul>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-brand/15 pt-4 text-brand text-xs font-bold">
              <span>Upload PDF / TXT / MD</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Upload Resume <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* Manual Guided Card */}
          <div
            onClick={() => setMode("manual")}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border border-foreground/10 bg-card/40 p-6 sm:p-8 hover:border-brand/40 hover:bg-card/70 transition-all duration-300 backdrop-blur-xl flex flex-col justify-between"
          >
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-foreground/10 border border-foreground/15 flex items-center justify-center text-foreground group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground group-hover:text-brand transition-colors">
                    Guided Step-by-Step
                  </h2>
                  <p className="text-xs text-foreground/50">Manual interactive setup</p>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs text-foreground/60">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-foreground text-[10px]">1</span>
                  Enter details step by step with live preview
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-foreground text-[10px]">2</span>
                  Select career goals, skills & work preferences
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-foreground text-[10px]">3</span>
                  Select your scouting power plan
                </li>
              </ul>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-foreground/10 pt-4 text-foreground text-xs font-bold group-hover:text-brand transition-colors">
              <span>8 quick steps (~2 mins)</span>
              <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Start Guided Flow <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Resume Upload View (mode === "resume" && !parsed)
  const renderResumeUpload = (
    <div className="min-h-screen bg-[#08090d] text-foreground flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(circle_at_50%_0%,rgba(47,217,104,0.15),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 max-w-xl w-full space-y-6">
        <button
          onClick={() => setMode(null)}
          disabled={uploading || parsing}
          className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" /> Back to mode choice
        </button>

        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Upload Your Resume
          </h1>
          <p className="text-xs sm:text-sm text-foreground/60 max-w-md mx-auto">
            JobRaker AI will extract your profile data, skills, and experience to set up your account automatically.
          </p>
        </div>

        <Card className="rounded-2xl border border-brand/30 bg-card/60 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <label
            className="w-full cursor-pointer group block"
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!dragActive) setDragActive(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const files = e.dataTransfer?.files;
              if (files && files.length) void handleResumeFiles(files);
            }}
          >
            <div
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 px-6 text-center transition-all ${
                dragActive
                  ? "border-brand bg-brand/15 shadow-[0_0_25px_rgba(47,217,104,0.2)] scale-[1.01]"
                  : "border-brand/30 group-hover:border-brand bg-brand/5"
              }`}
            >
              <div className="h-12 w-12 rounded-xl bg-brand/20 border border-brand/40 flex items-center justify-center text-brand">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {dragActive ? "Drop resume here to parse" : "Click or drag resume file"}
                </p>
                <p className="text-xs text-foreground/50 mt-0.5">
                  Supports PDF, TXT, MD, RTF (Max 8MB)
                </p>
              </div>
              <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider">
                🔒 Secure Local Extraction
              </span>
            </div>
            <input
              type="file"
              accept=".pdf,.txt,.md,.rtf"
              className="hidden"
              onChange={(e) => void handleResumeFiles(e.target.files)}
            />
          </label>

          {/* Progress state */}
          {(uploading || parsing) && (
            <div className="space-y-3 rounded-xl border border-brand/20 bg-background/50 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-brand animate-spin" />
                  {parsing ? "Parsing resume with AI & generating profile..." : "Uploading file to storage..."}
                </span>
                <span className="font-mono text-brand">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand via-[#2fd968] to-[#80f2a7] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {parseError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2">
              <X className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Parse Notice</p>
                <p className="mt-0.5 leading-relaxed">{parseError}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  // Resume Upload Success & Plan Selection View (mode === "resume" && parsed)
  const renderResumeSuccessPricing = (
    <div className="min-h-screen bg-[#08090d] text-foreground flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="relative z-10 max-w-4xl w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand/30 bg-brand/10 text-brand text-xs font-bold">
            <CheckCircle className="w-4 h-4" /> Resume Parsed Successfully!
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground">
            Activate Your Scouting Power Plan
          </h1>
          <p className="text-xs sm:text-sm text-foreground/60 max-w-xl mx-auto">
            Your candidate profile, work history, and core skills have been parsed and mapped. Select your subscription plan to open your dashboard.
          </p>
        </div>

        <Card className="rounded-2xl border border-brand/30 bg-card/60 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <PricingSelectorWidget
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            selectedBilling={selectedBilling}
            setSelectedBilling={setSelectedBilling}
          />

          <div className="pt-2 flex justify-center">
            <Button
              onClick={() => void handleCompleteOnboarding()}
              disabled={saving}
              className="w-full max-w-md bg-brand text-black hover:bg-brand/90 transition-all h-12 text-sm font-bold rounded-xl shadow-[0_0_20px_rgba(47,217,104,0.25)] flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Completing Account Setup...
                </>
              ) : (
                <>
                  Activate Account & Go to Dashboard <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  // Return screens based on mode
  if (mode === null) return renderChoiceScreen;
  if (mode === "resume" && !parsed) return renderResumeUpload;
  if (mode === "resume" && parsed) return renderResumeSuccessPricing;

  // Manual Mode Guided Wizard View (mode === "manual")
  const activeStepMeta = STEP_DEFINITIONS[currentStep];

  return (
    <div className="min-h-screen bg-[#08090d] text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-[radial-gradient(circle_at_50%_0%,rgba(47,217,104,0.12),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-6">
        {/* Top Stepper Header Bar */}
        <div className="flex flex-col gap-4 border-b border-foreground/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevStep}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/15 bg-background/50 text-foreground/70 transition-[background-color,border-color,color] hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
              title={currentStep === 0 ? "Back to setup options" : "Previous step"}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-brand">
                <span>
                  Step {String(currentStep + 1).padStart(2, "0")} / {String(STEP_DEFINITIONS.length).padStart(2, "0")}
                </span>
                <span className="text-foreground/30">•</span>
                <span className="text-foreground/50">{activeStepMeta.label}</span>
              </div>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">
                JobRaker Profile Setup
              </h2>
            </div>
          </div>

          {/* Compact step progress */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1" aria-label="Onboarding progress">
            {STEP_DEFINITIONS.map((s, idx) => {
              const isDone = idx < currentStep;
              const isCurrent = idx === currentStep;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`h-2 rounded-full transition-[width,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                    isCurrent
                      ? "w-7 bg-brand shadow-[0_0_10px_rgba(47,217,104,0.35)]"
                      : isDone
                        ? "w-2 bg-brand/70 hover:bg-brand"
                        : "w-2 bg-foreground/15 hover:bg-foreground/35"
                  }`}
                  title={s.label}
                  aria-label={`Go to ${s.label}`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className="sr-only">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Dual-Column Workspace */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Form Step Container */}
          <Card className="space-y-6 rounded-2xl border border-brand/20 bg-card/60 p-5 shadow-2xl backdrop-blur-2xl sm:p-7 lg:col-span-7">
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
                {React.createElement(activeStepMeta.icon, { className: "w-4 h-4" })}
                {activeStepMeta.label} Configuration
              </div>
              <h3 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                {currentStep === 0 && "Welcome! Let's get your details"}
                {currentStep === 1 && "Your Role & Career Level"}
                {currentStep === 2 && "Where are you based?"}
                {currentStep === 3 && "What are your primary job goals?"}
                {currentStep === 4 && "Write a short professional summary"}
                {currentStep === 5 && "Add your core skills"}
                {currentStep === 6 && "Add your education history"}
                {currentStep === 7 && "Choose your Scouting Power Plan"}
              </h3>
              <p className="mt-2 text-sm text-foreground/60">
                {currentStep === 0 && "Enter your name and contact details to get started."}
                {currentStep === 1 && "Help AI agents target relevant openings for your title."}
                {currentStep === 2 && "Specify location & remote/hybrid work preference."}
                {currentStep === 3 && "Select goals to optimize AI matching algorithms."}
                {currentStep === 4 && "Brief summary used for email templates and cover letters."}
                {currentStep === 5 && "Type and press Enter or pick suggested skill tags."}
                {currentStep === 6 && "Add school, degree, and graduation dates (optional)."}
                {currentStep === 7 && "Select your plan to activate account & access Dashboard."}
              </p>
            </div>

            {/* Step Body */}
            <div className="py-2">{renderStepComponent()}</div>

            {/* Navigation Footer Controls */}
            <div className="flex items-center justify-between border-t border-foreground/10 pt-5">
              <Button
                onClick={prevStep}
                variant="outline"
                className="h-10 rounded-xl border-foreground/15 bg-background/40 text-xs font-semibold text-foreground/80 transition-[background-color,border-color,color] hover:border-brand/40 hover:bg-brand/10 hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {currentStep === 0 ? "Back to Mode" : "Back"}
              </Button>

              <Button
                onClick={nextStep}
                disabled={saving}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-brand px-6 text-xs font-bold text-black shadow-[0_0_15px_rgba(47,217,104,0.2)] transition-[background-color,box-shadow] hover:bg-brand/90 hover:shadow-[0_0_22px_rgba(47,217,104,0.3)]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : currentStep === STEP_DEFINITIONS.length - 1 ? (
                  <>
                    Activate Account & Finish <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next Step <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Right Live Profile Snapshot Card */}
          <div className="space-y-4 lg:col-span-5">
            <Card className="space-y-4 rounded-2xl border border-brand/30 bg-gradient-to-br from-card/80 via-card/50 to-card/20 p-5 shadow-xl backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                  <span className="text-xs font-bold text-foreground">
                    Live Profile Preview
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-brand">
                  {completionPercentage}% Complete
                </span>
              </div>

              {/* Live Profile Card */}
              <div className="space-y-4 rounded-xl border border-foreground/10 bg-background/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/50 flex items-center justify-center font-bold text-brand text-base shadow-[0_0_15px_rgba(47,217,104,0.2)]">
                    {avatarInitials}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground leading-tight">
                      {formData.firstName || formData.lastName
                        ? `${formData.firstName} ${formData.lastName}`.trim()
                        : "Candidate Profile"}
                    </h4>
                    <p className="text-xs font-medium text-brand mt-0.5">
                      {formData.jobTitle || "Job Title Not Specified"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-foreground/70">
                  <span className="inline-flex items-center gap-1 rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1">
                    <MapPin className="h-3 w-3 text-brand" />
                    {formData.location || "Location not set"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1">
                    <Briefcase className="h-3 w-3 text-brand" />
                    {formData.experience} yrs ({formData.workPreference})
                  </span>
                </div>

                {/* Goals */}
                {formData.goals.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                      Target Goals
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {formData.goals.map((g) => (
                        <span
                          key={g}
                          className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills */}
                {formData.skills.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
                      Core Skills ({formData.skills.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {formData.skills.slice(0, 8).map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-foreground/15 bg-background/60 px-2 py-0.5 text-[10px] text-foreground/80"
                        >
                          {s}
                        </span>
                      ))}
                      {formData.skills.length > 8 && (
                        <span className="text-[10px] text-foreground/40 self-center">
                          +{formData.skills.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Onboarding Trust Footer */}
              <div className="flex items-center justify-around text-[10px] text-foreground/40 pt-1">
                <span>✓ Verified Supabase Storage</span>
                <span>•</span>
                <span>✓ Safe Encryption</span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Skill Input Component
const SkillInputWidget = ({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Type a skill (e.g. React, SQL) and press Enter"
          className="h-11 bg-background/50 border-brand/20 text-foreground placeholder:text-foreground/30 focus:border-brand rounded-xl text-xs sm:text-sm"
          autoFocus
        />
        <Button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="bg-brand text-black hover:bg-brand/90 h-11 px-4 font-bold text-xs rounded-xl disabled:opacity-50"
        >
          Add
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[40px]">
        {values.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand shadow-sm"
          >
            <span>{s}</span>
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== s))}
              className="text-brand/70 hover:text-brand"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!values.length && (
          <span className="text-xs text-foreground/40 italic">
            No skills added yet. Enter custom skills or pick from suggested tags below.
          </span>
        )}
      </div>
    </div>
  );
};

// Education Editor Component
const EducationEditorWidget = ({
  values,
  onChange,
}: {
  values: EducationItem[];
  onChange: (v: EducationItem[]) => void;
}) => {
  const update = (idx: number, patch: Partial<EducationItem>) => {
    const next = values.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    onChange(next);
  };
  const add = () =>
    onChange([...(values || []), { school: "", degree: "", start: "", end: "" }]);
  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {(values || []).map((e, i) => (
        <div
          key={i}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center p-3 rounded-xl border border-foreground/10 bg-background/40"
        >
          <Input
            value={e.school || ""}
            onChange={(ev) => update(i, { school: ev.target.value })}
            placeholder="School / University"
            className="h-10 text-xs bg-background/50 border-brand/20 rounded-lg"
          />
          <Input
            value={e.degree || ""}
            onChange={(ev) => update(i, { degree: ev.target.value })}
            placeholder="Degree / Major"
            className="h-10 text-xs bg-background/50 border-brand/20 rounded-lg"
          />
          <Input
            value={e.start || ""}
            onChange={(ev) => update(i, { start: ev.target.value })}
            placeholder="Start Year"
            className="h-10 text-xs bg-background/50 border-brand/20 rounded-lg"
          />
          <div className="flex gap-2">
            <Input
              value={e.end || ""}
              onChange={(ev) => update(i, { end: ev.target.value })}
              placeholder="End Year"
              className="h-10 text-xs bg-background/50 border-brand/20 rounded-lg flex-1"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
              title="Remove entry"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        onClick={add}
        variant="outline"
        className="w-full border-dashed border-brand/30 bg-brand/5 text-brand hover:bg-brand/10 text-xs font-semibold h-10 rounded-xl"
      >
        <Plus className="w-4 h-4 mr-1" /> Add Education Entry
      </Button>
    </div>
  );
};

// Pricing Selector Widget
const PricingSelectorWidget = ({
  selectedPlan,
  setSelectedPlan,
  selectedBilling,
  setSelectedBilling,
}: {
  selectedPlan: string;
  setSelectedPlan: (plan: string) => void;
  selectedBilling: string;
  setSelectedBilling: (billing: string) => void;
}) => {
  const plans = SUBSCRIPTION_MARKETING_PLANS.filter((p) => p.tier !== "Free");

  return (
    <div className="w-full space-y-5">
      {/* Billing toggle */}
      <div className="flex justify-center items-center gap-3">
        <span
          className={`text-xs font-semibold ${
            selectedBilling === "monthly" ? "text-foreground" : "text-foreground/50"
          }`}
        >
          Monthly
        </span>
        <button
          type="button"
          onClick={() =>
            setSelectedBilling(selectedBilling === "monthly" ? "annual" : "monthly")
          }
          className="relative inline-flex h-6 w-11 items-center rounded-full bg-foreground/15 transition-colors focus:outline-none"
        >
          <span
            className={`${
              selectedBilling === "annual" ? "translate-x-6" : "translate-x-1"
            } inline-block h-4 w-4 transform rounded-full bg-brand transition-transform`}
          />
        </button>
        <span
          className={`text-xs font-semibold ${
            selectedBilling === "annual" ? "text-foreground" : "text-foreground/50"
          }`}
        >
          Annually{" "}
          <span className="text-[10px] text-brand bg-brand/10 border border-brand/30 px-1.5 py-0.5 rounded-full font-mono font-bold">
            Save 30%
          </span>
        </span>
      </div>

      {/* Plan Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full">
        {plans.map((plan) => {
          const isSelected = selectedPlan.toLowerCase() === plan.tier.toLowerCase();
          const isPro = plan.tier === "Pro";
          const price = selectedBilling === "annual" ? plan.yearlyPrice : plan.price;
          const displayPrice =
            selectedBilling === "annual" ? Math.round(Number(price) / 12) : price;

          return (
            <div
              key={plan.tier}
              onClick={() => setSelectedPlan(plan.tier)}
              className={`cursor-pointer relative flex flex-col p-4 rounded-xl border transition-all duration-300 ${
                isSelected
                  ? "border-brand bg-brand/15 shadow-[0_0_20px_rgba(47,217,104,0.15)]"
                  : "border-foreground/10 bg-background/30 hover:border-foreground/25 hover:bg-background/50"
              }`}
            >
              {isPro && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-brand text-black text-[9px] font-extrabold uppercase tracking-wider shadow">
                  Most Popular
                </div>
              )}
              <div className="mb-2">
                <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
                <p className="text-[10px] text-foreground/50 line-clamp-2 min-h-[28px]">
                  {plan.description}
                </p>
              </div>
              <div className="mb-3 flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-foreground">${displayPrice}</span>
                <span className="text-[10px] text-foreground/50">/month</span>
              </div>
              <div className="space-y-1.5 border-t border-foreground/10 pt-2 text-[10px]">
                <div className="font-bold text-brand uppercase tracking-wider">
                  {plan.creditsPerMonth} Credits / mo
                </div>
                <ul className="space-y-1 text-foreground/70">
                  {plan.features.slice(0, 3).map((feat, idx) => {
                    const featName = typeof feat === "string" ? feat : feat.name;
                    return (
                      <li key={idx} className="flex items-center gap-1">
                        <Check className="h-3 w-3 text-brand shrink-0" />
                        <span className="line-clamp-1">{featName}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => setSelectedPlan("Free")}
          className={`text-xs underline transition-colors ${
            selectedPlan.toLowerCase() === "free"
              ? "text-brand font-bold"
              : "text-foreground/40 hover:text-foreground/70"
          }`}
        >
          Or continue with the Free Plan (10 credits/mo, basic tracking)
        </button>
      </div>
    </div>
  );
};

// Icon Helpers
function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function DollarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TrendingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function LaptopIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function AwardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
