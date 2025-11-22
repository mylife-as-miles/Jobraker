import React, { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ChevronLeft, ChevronRight, CheckCircle, Sparkles, UploadCloud, FileText, Wand2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "../../lib/supabaseClient";
import { parsePdfFile } from '@/utils/parsePdf';
import { analyzeResumeText } from '@/utils/analyzeResume';
import { parseResumeWithAI, type ParsedProfileData } from '@/services/ai/parseResumeProfile';
import { events } from '@/lib/analytics';

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
  const [mode, setMode] = useState<null | 'manual' | 'resume'>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    experience: "",
    location: "",
    goals: [] as string[],
    about: "",
    skills: [] as string[],
    education: [] as { school?: string; degree?: string; start?: string; end?: string }[],
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleGoal = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }));
  };

  const steps: OnboardingStep[] = [
    {
      id: 1,
      title: "Welcome to JobRaker",
      subtitle: "Let's get your profile set up.",
      component: (
        <div className="w-full space-y-3 sm:space-y-4">
          <Input
            placeholder="First Name"
            value={formData.firstName}
            onChange={(e) => updateFormData("firstName", e.target.value)}
            className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
          />
          <Input
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => updateFormData("lastName", e.target.value)}
            className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
          />
        </div>
      ),
    },
    {
      id: 2,
      title: "Your Professional Details",
      subtitle: "Help us understand your career.",
      component: (
        <div className="w-full space-y-3 sm:space-y-4">
          <Input
            placeholder="Current Job Title"
            value={formData.jobTitle}
            onChange={(e) => updateFormData("jobTitle", e.target.value)}
            className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
          />
          <Input
            placeholder="Years of Experience"
            type="number"
            value={formData.experience}
            onChange={(e) => updateFormData("experience", e.target.value)}
            className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
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
          placeholder="City, State, Country"
          value={formData.location}
          onChange={(e) => updateFormData("location", e.target.value)}
          className="w-full bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] h-10 sm:h-12 text-sm sm:text-base"
        />
      ),
    },
    {
      id: 4,
      title: "Your Goals",
      subtitle: "What are you looking for?",
      component: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
          {["Find a new job", "Better salary", "Career growth", "Networking"].map((goal) => (
            <Button
              key={goal}
              variant={formData.goals.includes(goal) ? "primary" : "outline"}
              onClick={() => toggleGoal(goal)}
              className={`h-10 sm:h-12 text-xs sm:text-sm transition-all duration-200 ${
                formData.goals.includes(goal)
                  ? 'bg-[#1dff00] text-black hover:bg-[#1dff00]/90'
                  : 'border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]'
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
        <div className="w-full space-y-3">
          <textarea
            placeholder="e.g. Full-stack engineer with 5+ years building scalable SaaS platforms..."
            value={formData.about}
            onChange={(e) => updateFormData("about", e.target.value)}
            className="w-full min-h-[120px] bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] text-sm p-3 rounded-md"
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
      title: "All Set!",
      subtitle: "Your profile is ready.",
      component: (
        <div className="text-center space-y-4 sm:space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            <CheckCircle className="mx-auto h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20 text-[#1dff00]" />
          </motion.div>
          <motion.p
            className="text-white text-sm sm:text-base lg:text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            You are all set to track your applications!
          </motion.p>
          <motion.div
            className="flex flex-wrap justify-center gap-2 text-xs sm:text-sm text-[#ffffff80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span className="bg-[#ffffff1a] px-2 py-1 rounded">✓ Profile Complete</span>
            <span className="bg-[#ffffff1a] px-2 py-1 rounded">✓ Goals Set</span>
            <span className="bg-[#ffffff1a] px-2 py-1 rounded">✓ Ready to Go</span>
          </motion.div>
        </div>
      )
    }
  ];

  // ================= Resume Upload & Parse =================
  const handleResumeFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    setUploading(true);
    setParseError(null);
    setUploadProgress(5);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Upload to storage (resumes bucket)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const bytes = await file.arrayBuffer();
      const blob = new Blob([bytes], { type: file.type || 'application/octet-stream' });
      setUploadProgress(25);
      
      const { error: upErr } = await (supabase as any).storage.from('resumes').upload(path, blob, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      setUploadProgress(40);
      
      const insertPayload = {
        user_id: user.id,
        name: file.name.replace(/\.[^.]+$/, ''),
        template: null,
        status: 'Draft',
        applications: 0,
        thumbnail: null,
        is_favorite: false,
        file_path: path,
        file_ext: ext,
        size: file.size,
      };
      
      const { data: resumeRow, error: insErr } = await (supabase as any).from('resumes').insert(insertPayload).select('*').single();
      if (insErr) throw insErr;
      setUploadProgress(50);
      
      // Parse PDF/text content
      setParsing(true);
      let rawText = '';
      if (ext === 'pdf') {
        const parsed = await parsePdfFile(file);
        rawText = parsed.text;
      } else {
        rawText = await file.text();
      }
      setUploadProgress(60);
      
      // Try AI parsing first (if user has OpenAI key configured)
      let aiParsedData: ParsedProfileData | null = null;
      try {
        // Check if user has OpenAI API key in settings
        const { data: settingsData } = await (supabase as any)
          .from('settings')
          .select('openai_api_key')
          .eq('user_id', user.id)
          .single();
        
        const apiKey = settingsData?.openai_api_key;
        
        if (apiKey && apiKey.trim()) {
          setUploadProgress(65);
          aiParsedData = await parseResumeWithAI({
            resumeText: rawText,
            apiKey: apiKey,
            model: 'gpt-4o-mini'
          });
          setUploadProgress(80);
        }
      } catch (aiErr: any) {
        console.warn('AI parsing failed, falling back to heuristic:', aiErr);
        // Fall through to heuristic parsing
      }
      
      // Fallback: use heuristic analysis
      const analyzed = analyzeResumeText(rawText || '');
      setUploadProgress(85);
      
      // Insert parsed snapshot (lightweight)
      try {
        await (supabase as any).from('parsed_resumes').insert({
          resume_id: resumeRow.id,
          user_id: user.id,
          raw_text: rawText.slice(0, 500000),
          json: { sections: analyzed.sections, entities: analyzed.entities },
        });
      } catch {}
      
      // Prepare profile data - prioritize AI parsing if available
      let profileData: any = {};
      
      if (aiParsedData) {
        console.log('✅ AI Parsed Data:', aiParsedData); // Debug log
        
        // Use AI-parsed data
        profileData = {
          first_name: aiParsedData.firstName || null,
          last_name: aiParsedData.lastName || null,
          phone: aiParsedData.phone || null,
          location: aiParsedData.location || null,
          job_title: aiParsedData.jobTitle || null,
          experience_years: aiParsedData.experienceYears,
          about: aiParsedData.about || null,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        };
        
        console.log('💾 Saving profile:', profileData); // Debug log
        
        // Save education to profile_education table
        if (aiParsedData.education && aiParsedData.education.length > 0) {
          console.log(`📚 Saving ${aiParsedData.education.length} education entries`);
          
          const eduRows = aiParsedData.education
            .filter(e => e.school || e.degree)
            .map(e => ({
              user_id: user.id,
              degree: e.degree || '',
              school: e.school || '',
              location: '',
              start_date: e.start ? `${e.start}-01-01` : new Date().toISOString().split('T')[0],
              end_date: e.end && e.end !== 'Present' ? `${e.end}-01-01` : null,
              gpa: null,
            }));
          
          if (eduRows.length > 0) {
            try {
              const { error: eduErr } = await (supabase as any).from('profile_education').insert(eduRows);
              if (eduErr) {
                console.error('❌ Education insert error:', eduErr);
              } else {
                console.log('✅ Education saved successfully');
              }
            } catch (eduErr) {
              console.warn('Failed to insert education:', eduErr);
            }
          }
        }
        
        // Save work experience to profile_experiences table
        if (aiParsedData.experience && aiParsedData.experience.length > 0) {
          console.log(`💼 Saving ${aiParsedData.experience.length} work experience entries`);
          
          const expRows = aiParsedData.experience
            .filter(e => e.company || e.title)
            .map(e => {
              // Parse dates - handle YYYY-MM format or just YYYY
              const parseDate = (dateStr: string | undefined) => {
                if (!dateStr || dateStr === 'Present') return null;
                // If YYYY-MM format, add -01 for first day of month
                if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01`;
                // If YYYY format, add -01-01 for first day of year
                if (/^\d{4}$/.test(dateStr)) return `${dateStr}-01-01`;
                return dateStr;
              };
              
              return {
                user_id: user.id,
                company: e.company || '',
                title: e.title || '',
                location: e.location || '',
                start_date: parseDate(e.startDate) || new Date().toISOString().split('T')[0],
                end_date: parseDate(e.endDate),
                is_current: !e.endDate || e.endDate === 'Present',
                description: e.description || '',
              };
            });
          
          if (expRows.length > 0) {
            try {
              const { error: expErr } = await (supabase as any).from('profile_experiences').insert(expRows);
              if (expErr) {
                console.error('❌ Experience insert error:', expErr);
              } else {
                console.log('✅ Experience saved successfully');
              }
            } catch (expErr) {
              console.warn('Failed to insert experience:', expErr);
            }
          }
        }
        
        // Save skills to profile_skills table
        if (aiParsedData.skills && aiParsedData.skills.length > 0) {
          console.log(`🔧 Saving ${aiParsedData.skills.length} skills`);
          
          const skillRows = aiParsedData.skills.slice(0, 60).map(name => ({
            user_id: user.id,
            name: name.trim(),
            level: null,
            category: '',
          })).filter(r => r.name);
          
          if (skillRows.length > 0) {
            try {
              const { error: skillErr } = await (supabase as any).from('profile_skills').insert(skillRows);
              if (skillErr) {
                console.error('❌ Skills insert error:', skillErr);
              } else {
                console.log('✅ Skills saved successfully');
              }
            } catch (skillErr) {
              console.warn('Failed to insert skills:', skillErr);
            }
          }
        }
      } else {
        // Fallback to heuristic parsing
        const summary = analyzed.structured?.summary || '';
        const educationSections = Array.isArray(analyzed.structured?.education) ? analyzed.structured.education : [];
        const eduParsed = educationSections.map((s: any) => {
          const lines = String(s.content || '').split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
          return { school: lines[0] || '', degree: lines[1] || '', start: '', end: '' };
        }).slice(0, 5);
        
        profileData = {
          first_name: null,
          last_name: null,
          phone: analyzed.phones?.[0] || null,
          location: null,
          job_title: analyzed.entities?.titles?.[0] || null,
          experience_years: null,
          about: typeof summary === 'string' ? summary : null,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        };
        
        // Save education heuristically
        if (eduParsed.length > 0) {
          const eduRows = eduParsed
            .filter((e: any) => e.school || e.degree)
            .map((e: any) => ({
              user_id: user.id,
              degree: e.degree || '',
              school: e.school || '',
              location: '',
              start_date: e.start ? `${e.start}-01` : new Date().toISOString(),
              end_date: e.end ? `${e.end}-01` : null,
              gpa: null,
            }));
          
          if (eduRows.length > 0) {
            try {
              await (supabase as any).from('profile_education').insert(eduRows);
            } catch (eduErr) {
              console.warn('Failed to insert education:', eduErr);
            }
          }
        }
        
        // Save skills heuristically
        if (profileData.skills && profileData.skills.length > 0) {
          const skillRows = profileData.skills.map((name: string) => ({
            user_id: user.id,
            name: name.trim(),
            level: null,
            category: '',
          })).filter((r: any) => r.name);
          
          if (skillRows.length > 0) {
            try {
              await (supabase as any).from('profile_skills').insert(skillRows);
            } catch (skillErr) {
              console.warn('Failed to insert skills:', skillErr);
            }
          }
        }
      }
      
      // Save profile data
      const { error: profileErr } = await (supabase as any).from('profiles').upsert(
        { id: user.id, ...profileData },
        { onConflict: 'id' }
      );
      
      if (profileErr) throw profileErr;
      
      setUploadProgress(100);
      setParsed(true);
      setParsing(false);
      
      // Track analytics
      try {
        const startedAt = (user as any).created_at ? new Date((user as any).created_at).getTime() : undefined;
        const elapsed = startedAt ? Date.now() - startedAt : undefined;
        events.profileCompleted(elapsed as any);
        (window as any).__profileCompletedTracked = true;
      } catch {}
      
      // Redirect to dashboard after brief delay
      setTimeout(() => {
        navigate("/dashboard/overview");
      }, 1500);
      
    } catch (e: any) {
      setParseError(e.message || 'Failed to process resume');
    } finally {
      setUploading(false);
      setParsing(false);
      setTimeout(() => setUploadProgress(0), 1200);
    }
  }, [supabase, navigate]);

  const resumeModeScreen = (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-black relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-[#1dff00]/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-[#1dff00]/5 blur-3xl" />
      </div>
      <div className="relative max-w-4xl w-full space-y-10">
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-[#1dff00] bg-clip-text text-transparent">Welcome – let's set up your profile</h1>
          <p className="text-white/70 max-w-2xl mx-auto text-sm md:text-base">Upload your resume for instant AI-powered profile creation, or manually enter your information step by step.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <button onClick={() => setMode('resume')} className="group relative overflow-hidden rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#101910] via-[#060a06] to-black p-8 text-left shadow-[0_0_0_1px_rgba(29,255,0,0.15),0_20px_40px_-10px_rgba(0,0,0,0.6)] hover:shadow-[0_0_0_1px_rgba(29,255,0,0.4),0_25px_50px_-12px_rgba(29,255,0,0.15)] transition">
            <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-[#1dff00]/20 border border-[#1dff00]/40 text-[#1dff00] text-[10px] font-semibold uppercase tracking-wide">Recommended</div>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-[#1dff00]/10 to-transparent transition" />
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-[#1dff00]/15 flex items-center justify-center border border-[#1dff00]/30"><UploadCloud className="w-6 h-6 text-[#1dff00]" /></div>
              <h2 className="text-xl font-semibold text-white">AI-Powered Setup</h2>
            </div>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-start gap-2"><Wand2 className="w-4 h-4 text-[#1dff00] mt-0.5" /> AI extracts all profile information automatically</li>
              <li className="flex items-start gap-2"><FileText className="w-4 h-4 text-[#1dff00] mt-0.5" /> Saves directly to your account - no manual entry</li>
              <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-[#1dff00] mt-0.5" /> Fast, accurate & editable anytime</li>
            </ul>
            <div className="mt-6 inline-flex items-center gap-2 text-[#1dff00] text-sm font-medium">Upload Resume <ChevronRight className="w-4 h-4" /></div>
          </button>
          <button onClick={() => setMode('manual')} className="group relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#0d0d0d] via-[#060606] to-black p-8 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_40px_-10px_rgba(0,0,0,0.6)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_25px_50px_-12px_rgba(0,0,0,0.5)] transition">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-white/5 to-transparent transition" />
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/20"><FileText className="w-6 h-6 text-white" /></div>
              <h2 className="text-xl font-semibold text-white">Manual Setup</h2>
            </div>
            <ul className="space-y-2 text-sm text-white/60">
              <li>Enter details step by step</li>
              <li>Full control over every field</li>
              <li>Add skills, education & goals</li>
            </ul>
            <div className="mt-6 inline-flex items-center gap-2 text-white text-sm font-medium">Begin manual flow <ChevronRight className="w-4 h-4" /></div>
          </button>
        </div>
      </div>
    </div>
  );

  const resumeUploadScreen = (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-black relative overflow-hidden" role="main" aria-labelledby="uploadHeading">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-[#1dff00]/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-[#1dff00]/5 blur-3xl" />
      </div>
      <div className="relative max-w-2xl w-full space-y-10">
        <div className="text-center space-y-4">
          <h1 id="uploadHeading" className="text-3xl font-bold tracking-tight text-white">Upload Your Resume</h1>
          <p className="text-white/70 text-sm md:text-base max-w-xl mx-auto">We'll use AI to parse your profile information and automatically set up your account. You'll be redirected to your dashboard once complete.</p>
        </div>
        <div className="rounded-2xl border border-[#1dff00]/30 bg-gradient-to-br from-[#081108] via-[#050805] to-black p-10 relative overflow-hidden" aria-live="polite">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(29,255,0,0.15),transparent_70%)] opacity-70" />
          <div className="relative z-10 flex flex-col gap-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1 flex flex-col gap-4">
                <label
                  className="w-full cursor-pointer group"
                  aria-label="Upload resume file"
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!dragActive) setDragActive(true); }}
                  onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setDragActive(false); }}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation(); setDragActive(false);
                    const files = e.dataTransfer?.files; if (files && files.length) handleResumeFiles(files);
                  }}
                >
                  <div className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl py-12 px-6 relative overflow-hidden transition ${dragActive ? 'border-[#1dff00] bg-[#1dff00]/10 shadow-[0_0_0_1px_rgba(29,255,0,0.4),0_0_20px_-2px_rgba(29,255,0,0.4)]' : 'border-[#1dff00]/40 group-hover:border-[#1dff00] bg-[#1dff00]/5'}`}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-tr from-[#1dff00]/10 to-transparent transition" />
                    <UploadCloud className="w-10 h-10 text-[#1dff00]" />
                    <div className="text-center space-y-1">
                      <p className="text-white font-medium">{dragActive ? 'Release to upload' : 'Drop your resume here'}</p>
                      <p className="text-white/60 text-xs">{dragActive ? 'Parsing will begin automatically' : 'Click or drag (PDF / TXT / MD / RTF)'}</p>
                    </div>
                    <p className="text-[10px] tracking-wide text-[#1dff00]/70 uppercase">Secure • Local Parse</p>
                  </div>
                  <input type="file" accept=".pdf,.txt,.md,.rtf" className="hidden" onChange={(e) => handleResumeFiles(e.target.files)} />
                </label>
                {(uploading || parsing) && (
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-white/60">
                      <span>{parsing ? 'Parsing resume with AI & saving profile' : 'Uploading file'}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#1dff00] via-[#7dff5c] to-[#1dff00] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#1dff00] animate-pulse" />
                      <span>{parsing ? 'Extracting profile data & creating your account…' : 'Uploading to secure storage…'}</span>
                    </div>
                  </div>
                )}
                {parseError && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 w-full">{parseError}</div>}
                {parsed && !parseError && (
                  <div className="text-xs text-[#1dff00] bg-[#1dff00]/10 border border-[#1dff00]/30 rounded-md px-3 py-2 w-full flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Profile created successfully! Redirecting to dashboard...</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setMode(null)} disabled={uploading || parsing} className="px-4 py-2 rounded-md border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm disabled:opacity-50 disabled:cursor-not-allowed">Back</button>
                  {parseError && <button onClick={() => setParseError(null)} className="px-4 py-2 rounded-md bg-[#1dff00] text-black text-sm font-medium">Try Again</button>}
                </div>
              </div>
              {/* Preview / Extraction Panel */}
              <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4 min-h-[320px]">
                {!parsed && !(uploading||parsing) && (
                  <div className="text-white/50 text-sm leading-relaxed">
                    <p className="font-medium mb-2 text-white/70">Automatic Profile Setup</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>AI extracts name, email, phone & location</li>
                      <li>Parses professional summary & job title</li>
                      <li>Identifies skills and calculates experience</li>
                      <li>Extracts education and work history</li>
                      <li>Automatically saves to your profile</li>
                      <li>Redirects to dashboard when complete</li>
                    </ul>
                    <div className="mt-4 text-[10px] uppercase tracking-wide text-white/30">AI-Powered • Secure • Automatic</div>
                  </div>
                )}
                {(uploading || parsing) && (
                  <div className="flex flex-col gap-3 animate-pulse">
                    <div className="h-4 w-1/2 bg-white/10 rounded" />
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-white/5 rounded" />
                      <div className="h-3 w-5/6 bg-white/5 rounded" />
                      <div className="h-3 w-4/6 bg-white/5 rounded" />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Array.from({ length: 6 }).map((_,i)=>(<div key={i} className="h-5 w-14 bg-white/5 rounded-full" />))}
                    </div>
                  </div>
                )}
                {parsed && !uploading && !parsing && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-[#1dff00]">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">Profile Created Successfully!</span>
                    </div>
                    <div className="text-xs text-white/70 space-y-2">
                      <p>Your profile has been automatically created with:</p>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-white/60 ml-2">
                        <li>Personal information</li>
                        <li>Professional summary</li>
                        <li>Skills and experience</li>
                        <li>Education history</li>
                        <li>Work experience</li>
                      </ul>
                      <p className="mt-3 text-[11px] text-[#1dff00]/80">Redirecting you to the dashboard...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center text-[10px] text-white/40">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-white/60">Secure</span>
                <span>AI-powered parsing</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-white/60">Automatic</span>
                <span>Profile setup</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-white/60">Editable</span>
                <span>Modify anytime</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-white/40">Your resume is parsed with AI to automatically create your profile. All data can be edited later in settings.</div>
      </div>
    </div>
  );

  const nextStep = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // If user is not authenticated, send to sign-in route
          navigate('/signIn');
          return;
        }
        // Upsert profile information and mark onboarding complete
        const startedAt = (user as any).created_at ? new Date((user as any).created_at).getTime() : undefined;
        const { error } = await supabase.from('profiles').upsert({
          id: user.id,
          first_name: formData.firstName || null,
            last_name: formData.lastName || null,
            job_title: formData.jobTitle || null,
            experience_years: formData.experience ? Number(formData.experience) : null,
            location: formData.location || null,
            goals: formData.goals,
            about: formData.about || null,
            skills: formData.skills.length ? formData.skills : [],
            education: formData.education && formData.education.length ? JSON.stringify(formData.education) : null,
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
        if (error) throw error;

        // Normalize collections into dedicated tables (education, skills). Experience is not collected in onboarding yet.
        try {
          // Education: insert rows if user has none yet OR to avoid duplicates use simple uniqueness heuristic
          if (Array.isArray(formData.education) && formData.education.length) {
            const { data: existingEdu } = await supabase.from('profile_education').select('id, degree, school').eq('user_id', user.id).limit(1);
            if (!(existingEdu && existingEdu.length)) {
              const eduRows = formData.education
                .filter(e => (e.school || '').trim() || (e.degree || '').trim())
                .map(e => ({
                  user_id: user.id,
                  degree: (e.degree || '').trim(),
                  school: (e.school || '').trim(),
                  location: '',
                  start_date: e.start ? `${e.start}-01` : new Date().toISOString(),
                  end_date: e.end ? `${e.end}-01` : null,
                  gpa: null,
                }));
              if (eduRows.length) {
                await supabase.from('profile_education').insert(eduRows);
              }
            }
          }
          // Skills: if table empty for user, seed
          if (Array.isArray(formData.skills) && formData.skills.length) {
            const { data: existingSkills } = await supabase.from('profile_skills').select('id').eq('user_id', user.id).limit(1);
            if (!(existingSkills && existingSkills.length)) {
              const skillRows = formData.skills.slice(0, 60).map(name => ({
                user_id: user.id,
                name: name.trim(),
                level: null,
                category: '',
              })).filter(r => r.name);
              if (skillRows.length) {
                await supabase.from('profile_skills').insert(skillRows);
              }
            }
          }
        } catch (normErr) {
          // Non-fatal: log only; profile core saved already
          console.warn('Normalization failed (non-blocking):', normErr);
        }

        // Analytics: emit counts for collections normalization
        try {
          const elapsed = startedAt ? Date.now() - startedAt : undefined;
          // Extend existing schema by merging counts if the tracker tolerates extra props
          events.profileCompleted(elapsed as any);
          (window as any).__profileCompletedTracked = true;
        } catch {}
  navigate("/dashboard/overview");
      } catch (err) {
        console.error('Failed to save onboarding:', err);
        alert('Failed to save onboarding info. Please try again.');
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

  // Mode gating logic
  if (mode === null) return resumeModeScreen;
  if (mode === 'resume' && !parsed) return resumeUploadScreen;

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl">
        {/* Floating background elements */}
        <motion.div
          className="absolute top-4 sm:top-8 left-2 sm:left-4 lg:left-8 bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/20 rounded-full blur-xl w-8 h-8 sm:w-12 sm:h-12 lg:w-16 lg:h-16"
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-4 sm:bottom-8 right-2 sm:right-4 lg:right-8 bg-gradient-to-r from-[#1dff00]/10 to-[#0a8246]/10 rounded-full blur-xl w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20"
          animate={{ y: [10, -10, 10] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        <motion.div
          className="w-full"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="w-full bg-[#ffffff0d] backdrop-blur-[18px] border border-[#ffffff15] relative overflow-hidden rounded-xl sm:rounded-2xl shadow-2xl">
            {/* Animated border glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#1dff00]/20 via-transparent to-[#1dff00]/20 opacity-50 animate-pulse rounded-xl sm:rounded-2xl" />
            
            <CardContent className="relative z-10 p-4 sm:p-6 lg:p-8 xl:p-10">
              {/* Header with logo */}
              <div className="flex items-center justify-center mb-6 sm:mb-8">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                  </div>
                  <span className="text-white font-bold text-lg sm:text-xl lg:text-2xl">JobRaker</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex flex-col items-center text-center"
                >
                  {/* Step content */}
                  <div className="mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 sm:mb-3">
                      {steps[currentStep].title}
                    </h2>
                    <p className="text-[#ffffff80] text-sm sm:text-base lg:text-lg">
                      {steps[currentStep].subtitle}
                    </p>
                  </div>
                  
                  {/* Step component */}
                  <div className="w-full mb-6 sm:mb-8">
                    {steps[currentStep].component}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Button 
                  onClick={prevStep} 
                  disabled={currentStep === 0} 
                  variant="ghost"
                  className="w-full sm:w-auto text-white hover:bg-[#ffffff1a] disabled:opacity-50 disabled:cursor-not-allowed h-10 sm:h-12 text-sm sm:text-base order-2 sm:order-1"
                >
                  <ChevronLeft className="mr-1 sm:mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                  Back
                </Button>
                
                <Button 
                  onClick={nextStep}
                  className="w-full sm:w-auto bg-gradient-to-r from-white to-[#f0f0f0] text-black hover:shadow-lg transition-all h-10 sm:h-12 text-sm sm:text-base font-medium order-1 sm:order-2"
                >
                  {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                  <ChevronRight className="ml-1 sm:ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#ffffff20] rounded-full h-2 sm:h-3 mt-4 sm:mt-6 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-white to-[#f0f0f0] h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </div>

              {/* Step indicator */}
              <div className="flex justify-center mt-3 sm:mt-4 space-x-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                      index <= currentStep ? "bg-[#1dff00]" : "bg-[#ffffff30]"
                    }`}
                  />
                ))}
              </div>

              {/* Step counter */}
              <div className="text-center mt-2 sm:mt-3">
                <span className="text-xs sm:text-sm text-[#ffffff60]">
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
const SkillInput = ({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Type a skill and press Enter"
          className="flex-1 rounded-md bg-[#ffffff1a] border border-[#ffffff33] px-3 py-2 text-sm text-white placeholder:text-white/50 focus:border-[#1dff00] outline-none"
        />
        <button onClick={add} disabled={!draft.trim()} className="px-4 py-2 rounded-md bg-[#1dff00] text-black text-sm font-medium disabled:opacity-50">Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map(s => (
          <button
            key={s}
            onClick={() => onChange(values.filter(x => x !== s))}
            className="group inline-flex items-center gap-1 rounded-full border border-[#1dff00]/40 bg-[#1dff00]/10 px-3 py-1 text-xs text-[#1dff00] hover:bg-[#1dff00]/20"
            title="Remove skill"
          >
            <span>{s}</span>
            <span className="text-[#1dff00]/70 group-hover:text-[#ff4d4d]">×</span>
          </button>
        ))}
        {!values.length && <span className="text-xs text-white/40">No skills added yet</span>}
      </div>
    </div>
  );
};

interface EduItem { school?: string; degree?: string; start?: string; end?: string }
const EducationEditor = ({ values, onChange }: { values: EduItem[]; onChange: (v: EduItem[]) => void }) => {
  const update = (idx: number, patch: Partial<EduItem>) => {
    const next = values.map((v,i) => i===idx ? { ...v, ...patch } : v);
    onChange(next);
  };
  const add = () => onChange([...(values||[]), { school: '', degree: '', start: '', end: '' }]);
  const remove = (idx: number) => onChange(values.filter((_,i)=>i!==idx));
  return (
    <div className="space-y-4">
      {(values||[]).map((e,i)=>(
        <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-start">
          <input value={e.school||''} onChange={ev=>update(i,{school: ev.target.value})} placeholder="School" className="rounded-md bg-[#ffffff1a] border border-[#ffffff33] px-3 py-2 text-xs sm:text-sm text-white placeholder:text-white/50 focus:border-[#1dff00] outline-none" />
          <input value={e.degree||''} onChange={ev=>update(i,{degree: ev.target.value})} placeholder="Degree" className="rounded-md bg-[#ffffff1a] border border-[#ffffff33] px-3 py-2 text-xs sm:text-sm text-white placeholder:text-white/50 focus:border-[#1dff00] outline-none" />
          <input value={e.start||''} onChange={ev=>update(i,{start: ev.target.value})} placeholder="Start" className="rounded-md bg-[#ffffff1a] border border-[#ffffff33] px-3 py-2 text-xs sm:text-sm text-white placeholder:text-white/50 focus:border-[#1dff00] outline-none" />
          <div className="flex gap-2">
            <input value={e.end||''} onChange={ev=>update(i,{end: ev.target.value})} placeholder="End" className="flex-1 rounded-md bg-[#ffffff1a] border border-[#ffffff33] px-3 py-2 text-xs sm:text-sm text-white placeholder:text-white/50 focus:border-[#1dff00] outline-none" />
            <button onClick={()=>remove(i)} className="px-2 rounded-md bg-red-500/20 text-red-300 text-xs hover:bg-red-500/30">✕</button>
          </div>
        </div>
      ))}
      <button onClick={add} className="px-4 py-2 rounded-md bg-[#1dff00] text-black text-sm font-medium">Add Education</button>
      {!values.length && <div className="text-xs text-white/40">No education entries yet</div>}
    </div>
  );
};