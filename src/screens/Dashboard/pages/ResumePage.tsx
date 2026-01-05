import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useResumeStore } from "@/client/stores/resume";
import { useArtboardStore } from "../../../store/artboard";
import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { normalizeResume } from "@/client/utils/normalize-resume";
import { ResumesPage } from "@/client/pages/dashboard/resumes/page";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Save,
  Eye,
  Download,
  CheckCircle2,
  Loader2,
  MonitorPlay,
  Share2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";

export const ResumePage = (): JSX.Element => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Stores
  const resume = useResumeStore((state) => state.resume);
  const data = useResumeStore((state) => state.resume?.data);
  const setArtboardResume = useArtboardStore((state) => state.setResume);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useRegisterCoachMarks({
    page: 'resume',
    marks: [
      { id: 'resume-header-actions', selector: '#resume-header-actions', title: 'Builder Actions', body: 'Save, preview, or export your resume from this toolbar.' },
      { id: 'resume-canvas-area', selector: '#resume-canvas-area', title: 'Live Editor', body: 'This is your live canvas. Edits reflect instantly.' }
    ]
  });



  // Fetch Resume Data
  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const fetched = await queryClient.fetchQuery({
          queryKey: ["resume", { id }],
          queryFn: () => findResumeById({ id }),
        });

        if (!active) return;

        // CRITICAL FIX: Normalize the data to ensure 'sections', 'basics', etc. exist
        const { resume: normalized } = normalizeResume(fetched);

        useResumeStore.setState({ resume: normalized });
      } catch (e) {
        console.error("Failed to load resume", e);
        if (active) navigate("/dashboard/resumes");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, navigate]);

  // Sync to Artboard Store
  useEffect(() => {
    if (data) setArtboardResume(data);
  }, [data, setArtboardResume]);

  // Post Message to Iframe
  useEffect(() => {
    const post = () => {
      if (!iframeRef.current?.contentWindow || !data) return;
      iframeRef.current.contentWindow.postMessage({ type: 'SET_RESUME', payload: { resume: data } }, '*');
    };
    post();
    // Retry to ensure iframe is ready
    const timer = setTimeout(post, 500);
    const timer2 = setTimeout(post, 1500);
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, [data]);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save (in real app, useResumeStore usually auto-saves or we call an update hook)
    await new Promise(r => setTimeout(r, 800));
    setIsSaving(false);
  };

  // 1. List View Mode
  if (!id) {
    return <ResumesPage />;
  }

  // 2. Builder Mode
  return (
    <div className="h-full w-full flex flex-col bg-black overflow-hidden relative">
      <Helmet>
        <title>{resume?.title ? `${resume.title} - Builder` : 'Resume Builder'} - JobRaker</title>
      </Helmet>

      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[#1dff00]/[0.02] pointer-events-none" />

      {/* Studio Header */}
      <header className="h-16 border-b border-white/5 bg-black/50 backdrop-blur-md flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard/resume')}
            className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
          >
            <ArrowLeft size={18} />
          </Button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">
                {loading ? (
                  <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                ) : (
                  resume?.title || "Untitled Resume"
                )}
              </h1>
              {!loading && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1dff00]/10 text-[#1dff00] border border-[#1dff00]/20 uppercase tracking-widest">
                  Draft
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              Last edited {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div id="resume-header-actions" className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 mr-4 text-xs text-gray-500">
            <MonitorPlay size={12} />
            <span>Auto-saving changes</span>
          </div>

          <Button
            disabled={loading}
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-gray-400 hover:text-white hover:bg-white/5"
          >
            <Eye size={14} /> <span className="hidden sm:inline">Preview</span>
          </Button>

          <Button
            disabled={loading || isSaving}
            onClick={handleSave}
            size="sm"
            className="h-8 gap-2 bg-[#1dff00] hover:bg-[#1dff00]/90 text-black font-semibold shadow-[0_0_15px_rgba(29,255,0,0.3)] transition-all"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
      </header>

      {/* Workspace Area */}
      <div id="resume-canvas-area" className="flex-1 relative w-full h-full bg-[#0a0a0a/50] overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <Loader2 className="w-10 h-10 text-[#1dff00] animate-spin" />
            <p className="text-sm text-gray-500 animate-pulse">Loading Studio...</p>
          </div>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full"
            >
              <iframe
                ref={iframeRef}
                title="Artboard Builder"
                src="/artboard/builder"
                className="w-full h-full border-0 block"
                allow="clipboard-read; clipboard-write"
                onLoad={() => {
                  if (data && iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({ type: 'SET_RESUME', payload: { resume: data } }, '*');
                  }
                }}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};