import React, { useMemo, useState, useCallback } from "react";
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

interface OnboardingStep {
  id: number;
  title: string;
  subtitle: string;
  component: React.ReactNode;
}

export const Onboarding = (): JSX.Element => {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const [currentStep, setCurrentStep] = useState(0);
  // Onboarding mode: null = not chosen yet, 'manual' | 'resume'
  const [mode, setMode] = useState<null | "manual" | "resume">(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string>(() => {
    return localStorage.getItem("selectedPlan") || "Pro";
  });
  const [selectedBilling, setSelectedBilling] = useState<string>(() => {
    return localStorage.getItem("selectedBilling") || "monthly";
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    experience: "",
    location: "",
    goals: [] as string[],
    about: "",
    skills: [] as string[],
    education: [] as {
      school?: string;
      degree?: string;
      start?: string;
      end?: string;
    }[],
  });

  // Load existing profile if any
  React.useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile || !active) return;

        // Also fetch education, skills if present
        const { data: edu } = await supabase.from("profile_education").select("*").eq("user_id", user.id);
        const { data: sks } = await supabase.from("profile_skills").select("*").eq("user_id", user.id);

        setFormData({
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          jobTitle: profile.job_title || "",
          experience: profile.experience_years != null ? String(profile.experience_years) : "",
          location: profile.location || "",
          goals: profile.goals || [],
          about: profile.about || "",
          skills: sks ? sks.map(s => s.name) : [],
          education: edu ? edu.map(e => ({
            school: e.school || "",
            degree: e.degree || "",
            start: e.start_date ? e.start_date.split("-")[0] : "",
            end: e.end_date ? e.end_date.split("-")[0] : "",
          })) : [],
        });
      } catch (err) {
        console.warn("Failed to load existing profile:", err);
      }
    };
    loadProfile();
    return () => { active = false; };
  }, [supabase]);


  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleGoal = (goal: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }));
  };

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: "Welcome to JobRaker",
      subtitle: "Let's get your profile set up.",
      component: (
        <div className='w-full space-y-3 sm:space-y-4'>
          <Input
            placeholder='First Name'
            value={formData.firstName}
            onChange={(e) => updateFormData("firstName", e.target.value)}
            className='w-full product-input-surface h-10 sm:h-12 text-sm sm:text-base'
          />
          <Input
            placeholder='Last Name'
            value={formData.lastName}
            onChange={(e) => updateFormData("lastName", e.target.value)}
            className='w-full product-input-surface h-10 sm:h-12 text-sm sm:text-base'
          />
        </div>
      ),
    },
    {
      id: 2,
      title: "Your Professional Details",
      subtitle: "Help us understand your career.",
      component: (
        <div className='w-full space-y-3 sm:space-y-4'>
          <Input
            placeholder='Current Job Title'
            value={formData.jobTitle}
            onChange={(e) => updateFormData("jobTitle", e.target.value)}
            className='w-full product-input-surface h-10 sm:h-12 text-sm sm:text-base'
          />
          <Input
            placeholder='Years of Experience'
            type='number'
            value={formData.experience}
            onChange={(e) => updateFormData("experience", e.target.value)}
            className='w-full product-input-surface h-10 sm:h-12 text-sm sm:text-base'
          />
        </div>
      ),
    },
    {
      id: 3,
      title: "Location",
      subtitle: "Where are you based?",
      component: (
        <Input
          placeholder='City, State, Country'
          value={formData.location}
          onChange={(e) => updateFormData("location", e.target.value)}
          className='w-full product-input-surface h-10 sm:h-12 text-sm sm:text-base'
        />
      ),
    },
    {
      id: 4,
      title: "Your Goals",
      subtitle: "What are you looking for?",
      component: (
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full'>
          {[
            "Find a new job",
            "Better salary",
            "Career growth",
            "Networking",
          ].map((goal) => (
            <Button
              key={goal}
              variant={formData.goals.includes(goal) ? "primary" : "outline"}
              onClick={() => toggleGoal(goal)}
              className={`h-10 sm:h-12 text-xs sm:text-sm transition-all duration-200 ${
                formData.goals.includes(goal)
                  ? "bg-brand text-black hover:bg-brand/90"
                  : "product-outline-button"
              }`}
            >
              {goal}
            </Button>
          ))}
        </div>
      ),
    },
    {
      id: 5,
      title: "About You",
      subtitle: "Add a short professional summary.",
      component: (
        <div className='w-full space-y-3'>
          <textarea
            placeholder='e.g. Full-stack engineer with 5+ years building scalable SaaS platforms...'
            value={formData.about}
            onChange={(e) => updateFormData("about", e.target.value)}
            className='w-full min-h-[120px] product-input-surface text-sm p-3 rounded-md'
          />
        </div>
      ),
    },
    {
      id: 6,
      title: "Core Skills",
      subtitle: "List a few key skills (press Enter).",
      component: (
        <SkillInput
          values={formData.skills}
          onChange={(vals) => updateFormData("skills", vals)}
        />
      ),
    },
    {
      id: 7,
      title: "Education",
      subtitle: "Add at least one entry (optional).",
      component: (
        <EducationEditor
          values={formData.education}
          onChange={(vals) => updateFormData("education", vals)}
        />
      ),
    },
    {
      id: 8,
      title: "Choose Your Scouting Power",
      subtitle: "Select a plan that aligns with your monthly job applications.",
      component: (
        <PricingSelector
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          selectedBilling={selectedBilling}
          setSelectedBilling={setSelectedBilling}
        />
      ),
    },
  ];

  const handleResumeFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || !fileList.length) return;
      const file = fileList[0];
      setUploading(true);
      setParseError(null);
      setUploadProgress(5);
      try {
        const MAX_MB = 8;
        if (file.size > MAX_MB * 1024 * 1024) {
          throw new Error(`File exceeds ${MAX_MB}MB limit`);
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Upload to storage (resumes bucket)
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
        setUploadProgress(25);

        const { error: upErr } = await (supabase as any).storage
          .from("resumes")
          .upload(path, blob, {
            upsert: false,
            contentType: file.type || undefined,
          });
        if (upErr) throw upErr;
        setUploadProgress(40);

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
        setUploadProgress(50);

        // Parse PDF/text content (same sources as resume import)
        setParsing(true);
        let rawText = "";
        let lines: string[] = [];
        if (ext === "pdf") {
          const parsed = await parsePdfFile(file);
          rawText = parsed.text;
          lines = parsed.lines;
        } else {
          rawText = await file.text();
          lines = rawText
            .split(/\n+/)
            .map((l) => l.trim())
            .filter(Boolean);
        }
        if (!rawText?.trim()) {
          throw new Error(
            "Could not read any text from this file. Try a PDF or plain text resume.",
          );
        }
        setUploadProgress(60);

        const analyzed = analyzeResumeText(rawText);

        let aiParsedData: ParsedProfileData | null = null;
        try {
          setUploadProgress(65);
          let pdfBase64: string | undefined = undefined;
          if (ext === "pdf") {
            try {
              pdfBase64 = await fileToBase64(file);
            } catch (b64Err) {
              console.warn("Could not encode PDF to base64", b64Err);
            }
          }
          aiParsedData = await parseResumeWithAI({ resumeText: rawText, pdfBase64 });
          setUploadProgress(80);
        } catch (aiErr) {
          console.warn(
            "AI parsing failed, using same fallback as resume page:",
            aiErr,
          );
        }

        const effective: ParsedProfileData =
          aiParsedData ??
          buildFallbackParsedProfileData(rawText, resumeDisplayName);
        setUploadProgress(85);

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
        const { error: resumeUpdateErr } = await (supabase as any)
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
        if (resumeUpdateErr) {
          console.warn(
            "Failed to update resume document data:",
            resumeUpdateErr,
          );
        }

        const profileData = {
          first_name: effective.firstName || null,
          last_name: effective.lastName || null,
          phone: effective.phone || null,
          location: effective.location || null,
          job_title: effective.jobTitle || null,
          experience_years: effective.experienceYears != null && !isNaN(Number(effective.experienceYears))
            ? Math.round(Number(effective.experienceYears))
            : null,
          about: effective.about || null,
          onboarding_complete: false, // Maintain false to allow plan confirmation step
          updated_at: new Date().toISOString(),
        };

        const sanitizedProfileData = sanitizeStructuredPayload(profileData) as typeof profileData;

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
              const { error: eduErr } = await (supabase as any)
                .from("profile_education")
                .insert(sanitizedEduRows);
              if (eduErr) console.error("Education insert error:", eduErr);
            } catch (eduErr) {
              console.warn("Failed to insert education:", eduErr);
            }
          }
        }

        if (effective.experience?.length > 0) {
          const parseDate = (dateStr: string | undefined) => {
            if (!dateStr || dateStr === "Present") return null;
            if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01`;
            if (/^\d{4}$/.test(dateStr)) return `${dateStr}-01-01`;
            return dateStr;
          };

          const expRows = effective.experience
            .filter((e) => e.company || e.title)
            .map((e) => ({
              user_id: user.id,
              company: e.company || "",
              title: e.title || "",
              location: e.location || "",
              start_date:
                parseDate(e.startDate) ||
                new Date().toISOString().split("T")[0],
              end_date: parseDate(e.endDate),
              is_current: !e.endDate || e.endDate === "Present",
              description: e.description || "",
            }));

          const sanitizedExpRows = sanitizeStructuredPayload(expRows) as typeof expRows;
          if (sanitizedExpRows.length > 0) {
            try {
              const { error: expErr } = await (supabase as any)
                .from("profile_experiences")
                .insert(sanitizedExpRows);
              if (expErr) console.error("Experience insert error:", expErr);
            } catch (expErr) {
              console.warn("Failed to insert experience:", expErr);
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
              const { error: skillErr } = await (supabase as any)
                .from("profile_skills")
                .insert(sanitizedSkillRows);
              if (skillErr) console.error("Skills insert error:", skillErr);
            } catch (skillErr) {
              console.warn("Failed to insert skills:", skillErr);
            }
          }
        }

        const { error: profileErr } = await (supabase as any)
          .from("profiles")
          .upsert({ id: user.id, ...sanitizedProfileData }, { onConflict: "id" });

        if (profileErr) throw profileErr;

        setUploadProgress(100);
        setParsed(true);
        setParsing(false);
      } catch (e: any) {
        const rawMessage = e?.message || String(e);
        let userMessage = "An unexpected error occurred while parsing your resume. Please try again.";
        
        if (rawMessage.includes("invalid input syntax for type integer")) {
          userMessage = "Resume parsing encountered invalid format for years of experience. Please check your details.";
        } else if (rawMessage.includes("File exceeds") || rawMessage.includes("exceeds limit")) {
          userMessage = "The resume file is too large. Please upload a file smaller than 8MB.";
        } else if (rawMessage.includes("Not authenticated") || rawMessage.includes("JWT")) {
          userMessage = "Your session has expired. Please sign in again.";
        } else if (rawMessage.includes("Could not extract text") || rawMessage.includes("Failed to extract text")) {
          userMessage = "We couldn't read the text in this PDF. Please make sure it's not scanned or password-protected.";
        } else if (rawMessage.includes("rate limit") || rawMessage.includes("limit exceeded") || rawMessage.includes("Subscription")) {
          userMessage = "You've reached your resume parsing limit. Please check your subscription.";
        } else if (rawMessage.trim()) {
          userMessage = rawMessage.length < 80 ? rawMessage : "Unable to parse this resume. Please try another file.";
        }
        setParseError(userMessage);
      } finally {
        setUploading(false);
        setParsing(false);
        setTimeout(() => setUploadProgress(0), 1200);
      }
    },
    [supabase, navigate],
  );

  const resumeModeScreen = (
    <div className='product-page-shell min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden'>
      <div className='absolute inset-0 pointer-events-none'>
        <div className='absolute -top-32 -left-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl' />
        <div className='absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-brand/5 blur-3xl' />
      </div>
      <div className='relative max-w-4xl w-full space-y-10'>
        <div className='text-center space-y-4'>
          <h1 className='text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-brand bg-clip-text text-transparent'>
            Welcome – let's set up your profile
          </h1>
          <p className='product-helper-text max-w-2xl mx-auto text-sm md:text-base'>
            Upload your resume for instant AI-powered profile creation, or
            manually enter your information step by step.
          </p>
        </div>
        <div className='grid gap-6 md:grid-cols-2'>
          <button
            onClick={() => setMode("resume")}
            className='group relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-[#141414] via-background to-black p-8 text-left shadow-[0_0_0_1px_rgba(29,255,0,0.15),0_20px_40px_-10px_rgba(0,0,0,0.6)] hover:shadow-[0_0_0_1px_rgba(29,255,0,0.4),0_25px_50px_-12px_rgba(29,255,0,0.15)] transition'
          >
            <div className='absolute top-3 right-3 px-2 py-1 rounded-full bg-brand/20 border border-brand/40 text-brand text-[10px] font-semibold uppercase tracking-wide'>
              Recommended
            </div>
            <div className='absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-brand/10 to-transparent transition' />
            <div className='flex items-center gap-3 mb-6'>
              <div className='h-12 w-12 rounded-xl bg-brand/15 flex items-center justify-center border border-brand/30'>
                <UploadCloud className='w-6 h-6 text-brand' />
              </div>
              <h2 className='text-xl font-semibold text-foreground'>
                AI-Powered Setup
              </h2>
            </div>
            <ul className='space-y-2 text-sm product-helper-text'>
              <li className='flex items-start gap-2'>
                <Wand2 className='w-4 h-4 text-brand mt-0.5' /> AI extracts all
                profile information automatically
              </li>
              <li className='flex items-start gap-2'>
                <FileText className='w-4 h-4 text-brand mt-0.5' /> Saves
                directly to your account - no manual entry
              </li>
              <li className='flex items-start gap-2'>
                <ShieldCheck className='w-4 h-4 text-brand mt-0.5' /> Fast,
                accurate & editable anytime
              </li>
            </ul>
            <div className='mt-6 inline-flex items-center gap-2 text-brand text-sm font-medium'>
              Upload Resume <ChevronRight className='w-4 h-4' />
            </div>
          </button>
          <button
            onClick={() => setMode("manual")}
            className='group relative overflow-hidden product-section-card p-8 text-left transition hover:border-brand/60 hover:shadow-lg'
          >
            <div className='absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-white/5 to-transparent transition' />
            <div className='flex items-center gap-3 mb-6'>
              <div className='product-muted-icon-chip h-12 w-12 rounded-xl'>
                <FileText className='w-6 h-6 text-foreground' />
              </div>
              <h2 className='text-xl font-semibold text-foreground'>
                Manual Setup
              </h2>
            </div>
            <ul className='space-y-2 text-sm text-foreground/60'>
              <li>Enter details step by step</li>
              <li>Full control over every field</li>
              <li>Add skills, education & goals</li>
            </ul>
            <div className='mt-6 inline-flex items-center gap-2 text-foreground text-sm font-medium'>
              Begin manual flow <ChevronRight className='w-4 h-4' />
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const resumeUploadScreen = (
    <div
      className='product-page-shell min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden'
      role='main'
      aria-labelledby='uploadHeading'
    >
      <div className='absolute inset-0 pointer-events-none'>
        <div className='absolute -top-32 -left-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl' />
        <div className='absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-brand/5 blur-3xl' />
      </div>
      <div className='relative max-w-2xl w-full space-y-10'>
        <div className='text-center space-y-4'>
          <h1
            id='uploadHeading'
            className='text-3xl font-bold tracking-tight text-foreground'
          >
            Upload Your Resume
          </h1>
          <p className='product-helper-text text-sm md:text-base max-w-xl mx-auto'>
            We'll use AI to parse your profile information and automatically set
            up your account. You'll be redirected to your dashboard once
            complete.
          </p>
        </div>
        <div
          className='product-section-card p-10 relative overflow-hidden'
          aria-live='polite'
        >
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(29,255,0,0.15),transparent_70%)] opacity-70' />
          <div className='relative z-10 flex flex-col gap-8'>
            <div className='flex flex-col lg:flex-row gap-8'>
              <div className='flex-1 flex flex-col gap-4'>
                <label
                  className='w-full cursor-pointer group'
                  aria-label='Upload resume file'
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!dragActive) setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node))
                      return;
                    setDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    const files = e.dataTransfer?.files;
                    if (files && files.length) handleResumeFiles(files);
                  }}
                >
                  <div
                    className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl py-12 px-6 relative overflow-hidden transition ${dragActive ? "border-brand bg-brand/10 shadow-[0_0_0_1px_rgba(29,255,0,0.4),0_0_20px_-2px_rgba(29,255,0,0.4)]" : "border-brand/40 group-hover:border-brand bg-brand/5"}`}
                  >
                    <div className='absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-brand/10 to-transparent transition' />
                    <UploadCloud className='w-10 h-10 text-brand' />
                    <div className='text-center space-y-1'>
                      <p className='text-foreground font-medium'>
                        {dragActive
                          ? "Release to upload"
                          : "Drop your resume here"}
                      </p>
                      <p className='text-foreground/60 text-xs'>
                        {dragActive
                          ? "Parsing will begin automatically"
                          : "Click or drag (PDF / TXT / MD / RTF)"}
                      </p>
                    </div>
                    <p className='text-[10px] tracking-wide text-brand/70 uppercase'>
                      Secure • Local Parse
                    </p>
                  </div>
                  <input
                    type='file'
                    accept='.pdf,.txt,.md,.rtf'
                    className='hidden'
                    onChange={(e) => handleResumeFiles(e.target.files)}
                  />
                </label>
                {(uploading || parsing) && (
                  <div className='w-full space-y-2'>
                    <div className='flex items-center justify-between text-[11px] text-foreground/60'>
                      <span>
                        {parsing
                          ? "Parsing resume with AI & saving profile"
                          : "Uploading file"}
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className='h-2 w-full rounded-full bg-muted overflow-hidden'>
                      <div
                        className='h-full bg-gradient-to-r from-brand via-[#fde047] to-brand transition-all duration-300'
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className='flex items-center gap-2 text-[10px] text-foreground/40'>
                      <div className='h-1.5 w-1.5 rounded-full bg-brand animate-pulse' />
                      <span>
                        {parsing
                          ? "Extracting profile data & creating your account…"
                          : "Uploading to secure storage…"}
                      </span>
                    </div>
                  </div>
                )}
                {parseError && (
                  <div className='text-xs text-brand bg-brand/10 border border-brand/30 rounded-md px-3 py-2 w-full'>
                    {parseError}
                  </div>
                )}
                {parsed && !parseError && (
                  <div className='text-xs text-brand bg-brand/10 border border-brand/30 rounded-md px-3 py-2 w-full flex items-center gap-2'>
                    <CheckCircle className='w-4 h-4' />
                    <span>
                      Profile created successfully! Redirecting to dashboard...
                    </span>
                  </div>
                )}
                <div className='flex flex-wrap gap-3'>
                  <button
                    onClick={() => setMode(null)}
                    disabled={uploading || parsing}
                    className='px-4 py-2 rounded-md border border-foreground/20 product-helper-text hover:text-foreground hover:border-foreground/40 text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    Back
                  </button>
                  {parseError && (
                    <button
                      onClick={() => setParseError(null)}
                      className='px-4 py-2 rounded-md bg-brand text-black text-sm font-medium'
                    >
                      Try Again
                    </button>
                  )}
                </div>
              </div>
              {/* Preview / Extraction Panel */}
              <div className='flex-1 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-5 flex flex-col gap-4 min-h-[320px]'>
                {!parsed && !(uploading || parsing) && (
                  <div className='product-helper-text text-sm leading-relaxed'>
                    <p className='font-medium mb-2 product-helper-text'>
                      Automatic Profile Setup
                    </p>
                    <ul className='list-disc list-inside space-y-1 text-xs'>
                      <li>AI extracts name, email, phone & location</li>
                      <li>Parses professional summary & job title</li>
                      <li>Identifies skills and calculates experience</li>
                      <li>Extracts education and work history</li>
                      <li>Automatically saves to your profile</li>
                      <li>Redirects to dashboard when complete</li>
                    </ul>
                    <div className='mt-4 text-[10px] uppercase tracking-wide text-foreground/30'>
                      AI-Powered • Secure • Automatic
                    </div>
                  </div>
                )}
                {(uploading || parsing) && (
                  <div className='flex flex-col gap-3 animate-pulse'>
                    <div className='h-4 w-1/2 bg-muted rounded' />
                    <div className='space-y-2'>
                      <div className='h-3 w-full bg-muted/50 rounded' />
                      <div className='h-3 w-5/6 bg-muted/50 rounded' />
                      <div className='h-3 w-4/6 bg-muted/50 rounded' />
                    </div>
                    <div className='flex flex-wrap gap-2 mt-2'>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className='h-5 w-14 bg-muted/50 rounded-full'
                        />
                      ))}
                    </div>
                  </div>
                )}
                {parsed && !uploading && !parsing && (
                  <div className='flex flex-col gap-4'>
                    <div className='flex items-center gap-2 text-brand'>
                      <CheckCircle className='w-5 h-5' />
                      <span className='font-semibold'>
                        Profile Created Successfully!
                      </span>
                    </div>
                    <div className='text-xs product-helper-text space-y-2'>
                      <p>Your profile has been automatically created with:</p>
                      <ul className='list-disc list-inside space-y-1 text-[11px] text-foreground/60 ml-2'>
                        <li>Personal information</li>
                        <li>Professional summary</li>
                        <li>Skills and experience</li>
                        <li>Education history</li>
                        <li>Work experience</li>
                      </ul>
                      <p className='mt-3 text-[11px] text-brand/80'>
                        Redirecting you to the dashboard...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className='grid grid-cols-3 gap-4 text-center text-[10px] text-foreground/40'>
              <div className='flex flex-col gap-1'>
                <span className='font-medium text-foreground/60'>Secure</span>
                <span>AI-powered parsing</span>
              </div>
              <div className='flex flex-col gap-1'>
                <span className='font-medium text-foreground/60'>
                  Automatic
                </span>
                <span>Profile setup</span>
              </div>
              <div className='flex flex-col gap-1'>
                <span className='font-medium text-foreground/60'>Editable</span>
                <span>Modify anytime</span>
              </div>
            </div>
          </div>
        </div>
        <div className='text-center text-xs text-foreground/40'>
          Your resume is parsed with AI to automatically create your profile.
          All data can be edited later in settings.
        </div>
      </div>
    </div>
  );

  const nextStep = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          // If user is not authenticated, send to sign-in route
          navigate("/signIn");
          return;
        }
        // Upsert profile information and mark onboarding complete
        const startedAt = (user as any).created_at
          ? new Date((user as any).created_at).getTime()
          : undefined;
        const tier = (selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1).toLowerCase()) as "Free" | "Basics" | "Pro" | "Ultimate";
        const profilePayload = {
          id: user.id,
          first_name: formData.firstName || null,
          last_name: formData.lastName || null,
          job_title: formData.jobTitle || null,
          experience_years: formData.experience && !isNaN(Number(formData.experience))
            ? Math.round(Number(formData.experience))
            : null,
          location: formData.location || null,
          goals: formData.goals,
          about: formData.about || null,
          skills: formData.skills.length ? formData.skills : [],
          education:
            formData.education && formData.education.length
              ? JSON.stringify(formData.education)
              : null,
          onboarding_complete: true,
          subscription_tier: tier,
          updated_at: new Date().toISOString(),
        };

        const sanitizedProfilePayload = sanitizeStructuredPayload(profilePayload) as typeof profilePayload;

        const { error } = await supabase.from("profiles").upsert(
          sanitizedProfilePayload,
          { onConflict: "id" },
        );
        if (error) throw error;

        // Normalize collections into dedicated tables (education, skills). Experience is not collected in onboarding yet.
        try {
          // Education: insert rows if user has none yet OR to avoid duplicates use simple uniqueness heuristic
          if (Array.isArray(formData.education) && formData.education.length) {
            const { data: existingEdu } = await supabase
              .from("profile_education")
              .select("id, degree, school")
              .eq("user_id", user.id)
              .limit(1);
            if (!(existingEdu && existingEdu.length)) {
              const eduRows = formData.education
                .filter(
                  (e) => (e.school || "").trim() || (e.degree || "").trim(),
                )
                .map((e) => ({
                  user_id: user.id,
                  degree: (e.degree || "").trim(),
                  school: (e.school || "").trim(),
                  location: "",
                  start_date: e.start
                    ? `${e.start}-01`
                    : new Date().toISOString(),
                  end_date: e.end ? `${e.end}-01` : null,
                  gpa: null,
                }));
              const sanitizedEduRows = sanitizeStructuredPayload(eduRows) as typeof eduRows;
              if (sanitizedEduRows.length) {
                await supabase.from("profile_education").insert(sanitizedEduRows);
              }
            }
          }
          // Skills: if table empty for user, seed
          if (Array.isArray(formData.skills) && formData.skills.length) {
            const { data: existingSkills } = await supabase
              .from("profile_skills")
              .select("id")
              .eq("user_id", user.id)
              .limit(1);
            if (!(existingSkills && existingSkills.length)) {
              const skillRows = formData.skills
                .slice(0, 60)
                .map((name) => ({
                  user_id: user.id,
                  name: name.trim(),
                  level: null,
                  category: "",
                }))
                .filter((r) => r.name);
              const sanitizedSkillRows = sanitizeStructuredPayload(skillRows) as typeof skillRows;
              if (sanitizedSkillRows.length) {
                await supabase.from("profile_skills").insert(sanitizedSkillRows);
              }
            }
          }
        } catch (normErr) {
          // Non-fatal: log only; profile core saved already
          console.warn("Normalization failed (non-blocking):", normErr);
        }

        // Log completion security event
        await logSecurityEvent(
          user.id,
          "onboarding_complete",
          `User completed onboarding using manual entry and selected plan: ${tier}`,
          "low"
        );

        // Analytics: emit counts for collections normalization
        try {
          const elapsed = startedAt ? Date.now() - startedAt : undefined;
          // Extend existing schema by merging counts if the tracker tolerates extra props
          events.profileCompleted(elapsed as any);
          (window as any).__profileCompletedTracked = true;
        } catch {}
        navigate("/dashboard/overview");
      } catch (err: any) {
        console.error("Failed to save onboarding:", err);
        const rawMessage = err?.message || String(err);
        let userMessage = "Failed to save onboarding information. Please try again.";
        if (rawMessage.includes("invalid input syntax") || rawMessage.includes("violates check constraint")) {
          userMessage = "Invalid data format. Please verify your experience years or details.";
        } else if (rawMessage.includes("JWT") || rawMessage.includes("Not authenticated")) {
          userMessage = "Your session has expired. Please log in again.";
        } else if (rawMessage.length < 80) {
          userMessage = rawMessage;
        }
        alert(userMessage);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut",
        staggerChildren: 0.1,
      },
    },
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      x: -50,
      transition: { duration: 0.3, ease: "easeIn" },
    },
  };

  // Mode gating: keep resume flow on this screen until navigation (never fall through to manual steps).
  const handleResumePricingSubmit = async () => {
    try {
      setUploading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const tier = (selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1).toLowerCase()) as "Free" | "Basics" | "Pro" | "Ultimate";
      const { error } = await supabase.from("profiles").update({
        onboarding_complete: true,
        subscription_tier: tier,
        updated_at: new Date().toISOString(),
      }).eq("id", user.id);

      if (error) throw error;

      await logSecurityEvent(
        user.id,
        "onboarding_complete",
        `User completed onboarding using resume parsing and selected plan: ${tier}`,
        "low"
      );

      navigate("/dashboard/overview");
    } catch (err: any) {
      console.error("Failed to complete onboarding:", err);
      const rawMessage = err?.message || String(err);
      let userMessage = "Failed to complete onboarding. Please try again.";
      if (rawMessage.includes("JWT") || rawMessage.includes("Not authenticated")) {
        userMessage = "Your session has expired. Please log in again.";
      } else if (rawMessage.length < 80) {
        userMessage = rawMessage;
      }
      alert(userMessage);
    } finally {
      setUploading(false);
    }
  };

  const resumeSuccessPricingScreen = (
    <div className='product-page-shell min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden'>
      <div className='absolute inset-0 pointer-events-none'>
        <div className='absolute -top-32 -left-24 h-72 w-72 rounded-full bg-brand/10 blur-3xl' />
        <div className='absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-brand/5 blur-3xl' />
      </div>

      <div className='w-full max-w-4xl relative z-10 space-y-6'>
        <div className='text-center space-y-2'>
          <h1 className='text-2xl sm:text-3xl font-bold tracking-tight text-foreground'>
            Resume Parsed Successfully!
          </h1>
          <p className='text-foreground/60 text-sm max-w-xl mx-auto'>
            Your profile details and experiences have been successfully analyzed. Select your scouting plan to unlock the dashboard.
          </p>
        </div>

        <Card className='product-section-card w-full relative overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl p-6 sm:p-8 bg-background/80 backdrop-blur-md border border-foreground/10'>
          <div className='absolute inset-0 bg-gradient-to-r from-brand/10 via-transparent to-brand/10 opacity-30 pointer-events-none' />
          
          <div className='space-y-6'>
            <div className='bg-foreground/[0.03] border border-foreground/5 rounded-xl p-4 flex flex-wrap gap-4 justify-around text-center text-xs'>
              <div>
                <span className='block text-lg font-bold text-brand'>✓ Profile</span>
                <span className='text-foreground/50'>Structured & mapped</span>
              </div>
              <div className='h-8 w-px bg-foreground/10 self-center hidden sm:block' />
              <div>
                <span className='block text-lg font-bold text-brand'>✓ Skills</span>
                <span className='text-foreground/50'>Extracted & normalized</span>
              </div>
              <div className='h-8 w-px bg-foreground/10 self-center hidden sm:block' />
              <div>
                <span className='block text-lg font-bold text-brand'>✓ Work History</span>
                <span className='text-foreground/50'>Experiences recorded</span>
              </div>
            </div>

            <PricingSelector
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              selectedBilling={selectedBilling}
              setSelectedBilling={setSelectedBilling}
            />

            <div className='pt-2 flex justify-center'>
              <Button
                onClick={handleResumePricingSubmit}
                disabled={uploading}
                className='w-full max-w-md bg-brand text-black hover:bg-brand/90 transition-all h-11 text-sm font-semibold rounded-lg shadow-[0_0_15px_rgba(29,255,0,0.2)]'
              >
                {uploading ? "Completing setup..." : "Activate Account & Go to Dashboard"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  if (mode === null) return resumeModeScreen;
  if (mode === "resume" && !parsed) return resumeUploadScreen;
  if (mode === "resume" && parsed) return resumeSuccessPricingScreen;

  return (
    <div className='product-page-shell min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8'>
      <div className='w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl'>
        {/* Floating background elements */}
        <motion.div
          className='absolute top-4 sm:top-8 left-2 sm:left-4 lg:left-8 bg-gradient-to-r from-brand/20 to-background/20 rounded-full blur-xl w-8 h-8 sm:w-12 sm:h-12 lg:w-16 lg:h-16'
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className='absolute bottom-4 sm:bottom-8 right-2 sm:right-4 lg:right-8 bg-gradient-to-r from-brand/10 to-background/10 rounded-full blur-xl w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20'
          animate={{ y: [10, -10, 10] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        <motion.div
          className='w-full'
          variants={containerVariants}
          initial='hidden'
          animate='visible'
        >
          <Card className='product-section-card w-full relative overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl'>
            {/* Animated border glow */}
            <div className='absolute inset-0 bg-gradient-to-r from-brand/20 via-transparent to-brand/20 opacity-50 animate-pulse rounded-xl sm:rounded-2xl' />

            <CardContent className='relative z-10 p-4 sm:p-6 lg:p-8 xl:p-10'>
              {/* Header with logo */}
              <div className='flex items-center justify-center mb-6 sm:mb-8'>
                <div className='flex items-center space-x-2 sm:space-x-3'>
                  <div className='w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-brand to-background rounded-full flex items-center justify-center'>
                    <Sparkles className='w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-foreground' />
                  </div>
                  <span className='text-foreground font-bold text-lg sm:text-xl lg:text-2xl'>
                    JobRaker
                  </span>
                </div>
              </div>

              <AnimatePresence mode='wait'>
                <motion.div
                  key={currentStep}
                  variants={stepVariants}
                  initial='hidden'
                  animate='visible'
                  exit='exit'
                  className='flex flex-col items-center text-center'
                >
                  {/* Step content */}
                  <div className='mb-6 sm:mb-8'>
                    <h2 className='text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-2 sm:mb-3'>
                      {steps[currentStep].title}
                    </h2>
                    <p className='product-helper-text text-sm sm:text-base lg:text-lg'>
                      {steps[currentStep].subtitle}
                    </p>
                  </div>

                  {/* Step component */}
                  <div className='w-full mb-6 sm:mb-8'>
                    {steps[currentStep].component}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className='flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4'>
                <Button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  variant='ghost'
                  className='product-outline-button h-10 w-full text-sm order-2 disabled:opacity-50 disabled:cursor-not-allowed sm:h-12 sm:w-auto sm:text-base sm:order-1'
                >
                  <ChevronLeft className='mr-1 sm:mr-2 w-4 h-4 sm:w-5 sm:h-5' />
                  Back
                </Button>

                <Button
                  onClick={nextStep}
                  className='w-full sm:w-auto bg-gradient-to-r from-white to-[#f0f0f0] text-black hover:shadow-lg transition-all h-10 sm:h-12 text-sm sm:text-base font-medium order-1 sm:order-2'
                >
                  {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                  <ChevronRight className='ml-1 sm:ml-2 w-4 h-4 sm:w-5 sm:h-5' />
                </Button>
              </div>

              {/* Progress bar */}
              <div className='w-full bg-foreground/10 rounded-full h-2 sm:h-3 mt-4 sm:mt-6 overflow-hidden'>
                <motion.div
                  className='bg-gradient-to-r from-white to-[#f0f0f0] h-full rounded-full'
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((currentStep + 1) / steps.length) * 100}%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>

              {/* Step indicator */}
              <div className='flex justify-center mt-3 sm:mt-4 space-x-2'>
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                      index <= currentStep ? "bg-brand" : "bg-foreground/20"
                    }`}
                  />
                ))}
              </div>

              {/* Step counter */}
              <div className='text-center mt-2 sm:mt-3'>
                <span className='text-xs sm:text-sm text-foreground/40'>
                  Step {currentStep + 1} of {steps.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

// Lightweight skill input (Enter to add, click to remove)
const SkillInput = ({
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
    <div className='w-full space-y-2'>
      <div className='flex gap-2'>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder='Type a skill and press Enter'
          className='product-input-surface flex-1 rounded-md px-3 py-2 text-sm outline-none'
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className='px-4 py-2 rounded-md bg-brand text-black text-sm font-medium disabled:opacity-50'
        >
          Add
        </button>
      </div>
      <div className='flex flex-wrap gap-2'>
        {values.map((s) => (
          <button
            key={s}
            onClick={() => onChange(values.filter((x) => x !== s))}
            className='group inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs text-brand hover:bg-brand/20'
            title='Remove skill'
          >
            <span>{s}</span>
            <span className='text-brand/70 group-hover:text-brand'>×</span>
          </button>
        ))}
        {!values.length && (
          <span className='text-xs text-foreground/40'>
            No skills added yet
          </span>
        )}
      </div>
    </div>
  );
};

interface EduItem {
  school?: string;
  degree?: string;
  start?: string;
  end?: string;
}
const EducationEditor = ({
  values,
  onChange,
}: {
  values: EduItem[];
  onChange: (v: EduItem[]) => void;
}) => {
  const update = (idx: number, patch: Partial<EduItem>) => {
    const next = values.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    onChange(next);
  };
  const add = () =>
    onChange([
      ...(values || []),
      { school: "", degree: "", start: "", end: "" },
    ]);
  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));
  return (
    <div className='space-y-4'>
      {(values || []).map((e, i) => (
        <div
          key={i}
          className='grid grid-cols-1 sm:grid-cols-4 gap-2 items-start'
        >
          <input
            value={e.school || ""}
            onChange={(ev) => update(i, { school: ev.target.value })}
            placeholder='School'
            className='product-input-surface rounded-md px-3 py-2 text-xs sm:text-sm outline-none'
          />
          <input
            value={e.degree || ""}
            onChange={(ev) => update(i, { degree: ev.target.value })}
            placeholder='Degree'
            className='product-input-surface rounded-md px-3 py-2 text-xs sm:text-sm outline-none'
          />
          <input
            value={e.start || ""}
            onChange={(ev) => update(i, { start: ev.target.value })}
            placeholder='Start'
            className='product-input-surface rounded-md px-3 py-2 text-xs sm:text-sm outline-none'
          />
          <div className='flex gap-2'>
            <input
              value={e.end || ""}
              onChange={(ev) => update(i, { end: ev.target.value })}
              placeholder='End'
              className='product-input-surface flex-1 rounded-md px-3 py-2 text-xs sm:text-sm outline-none'
            />
            <button
              onClick={() => remove(i)}
              className='px-2 rounded-md bg-brand/20 text-brand text-xs hover:bg-brand/30'
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className='px-4 py-2 rounded-md bg-brand text-black text-sm font-medium'
      >
        Add Education
      </button>
      {!values.length && (
        <div className='text-xs text-foreground/40'>
          No education entries yet
        </div>
      )}
    </div>
  );
};

const PricingSelector = ({
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
    <div className="w-full space-y-6">
      {/* Billing toggle */}
      <div className="flex justify-center items-center gap-3">
        <span className={`text-sm ${selectedBilling === "monthly" ? "text-foreground font-semibold" : "text-foreground/60"}`}>Monthly</span>
        <button
          type="button"
          onClick={() => setSelectedBilling(selectedBilling === "monthly" ? "annual" : "monthly")}
          className="relative inline-flex h-6 w-11 items-center rounded-full bg-foreground/10 transition-colors focus:outline-none"
        >
          <span
            className={`${
              selectedBilling === "annual" ? "translate-x-6" : "translate-x-1"
            } inline-block h-4 w-4 transform rounded-full bg-brand transition-transform`}
          />
        </button>
        <span className={`text-sm ${selectedBilling === "annual" ? "text-foreground font-semibold" : "text-foreground/60"}`}>
          Annually <span className="text-xs text-brand bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded ml-1 font-mono font-bold">Save 30%</span>
        </span>
      </div>

      {/* Plan Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        {plans.map((plan) => {
          const isSelected = selectedPlan.toLowerCase() === plan.tier.toLowerCase();
          const isPro = plan.tier === "Pro";
          const price = selectedBilling === "annual" ? plan.yearlyPrice : plan.price;
          const displayPrice = selectedBilling === "annual" 
            ? Math.round(Number(price) / 12)
            : price;

          return (
            <button
              key={plan.tier}
              type="button"
              onClick={() => setSelectedPlan(plan.tier)}
              className={`text-left relative flex flex-col p-5 rounded-2xl border transition-all duration-300 ${
                isSelected
                  ? "border-brand bg-brand/5 shadow-[0_0_20px_rgba(29,255,0,0.1)]"
                  : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20 hover:bg-foreground/[0.04]"
              } ${isPro && !isSelected ? "hover:shadow-[0_0_15px_rgba(255,255,255,0.02)]" : ""}`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-brand text-black text-[10px] font-bold uppercase tracking-wider shadow">
                  Most Popular
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                <p className="text-[11px] text-foreground/60 mt-1 line-clamp-2 min-h-[32px]">{plan.description}</p>
              </div>
              <div className="mb-4 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">${displayPrice}</span>
                <span className="text-xs text-foreground/50">/month</span>
                {selectedBilling === "annual" && (
                  <span className="text-[10px] text-brand/80 block mt-1">Billed annually (${price}/yr)</span>
                )}
              </div>
              <div className="flex-grow space-y-2 mt-2">
                <div className="text-[10px] font-semibold text-brand tracking-wider uppercase">
                  {plan.creditsPerMonth} Credits / mo
                </div>
                <ul className="space-y-1 text-[11px] text-foreground/75">
                  {plan.features.slice(0, 3).map((feat, idx) => {
                    const featName = typeof feat === "string" ? feat : feat.name;
                    return (
                      <li key={idx} className="flex items-start gap-1">
                        <span className="text-brand mt-0.5">✓</span>
                        <span className="line-clamp-1">{featName}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </button>
          );
        })}
      </div>

      {/* Free Plan link */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => setSelectedPlan("Free")}
          className={`text-xs ${selectedPlan.toLowerCase() === "free" ? "text-brand underline font-semibold" : "text-foreground/40 hover:text-foreground/60 underline"}`}
        >
          Or continue with the Free Plan (10 credits/mo, basic tracking)
        </button>
      </div>

      {/* Trust guarantees */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-foreground/45 border-t border-foreground/5 pt-4">
        <span>✓ 14-Day Free Trial</span>
        <span>•</span>
        <span>✓ Cancel Anytime</span>
        <span>•</span>
        <span>✓ Secure Checkout</span>
      </div>
    </div>
  );
};

