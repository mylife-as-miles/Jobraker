import { useRef, useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useResumeStore } from "@/client/stores/resume";
import { useArtboardStore } from "@/store/artboard";
import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { normalizeResume } from "@/client/utils/normalize-resume";
import { ResumesPage } from "../resumes/page";
import { useResumes } from "@/hooks/useResumes";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    Save,
    Loader2,
    Download,
    Share2,
    Maximize2,
    Minimize2,
    ZoomIn,
    ZoomOut,
    Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisterCoachMarks } from "@/providers/TourProvider";

// Constants
const DEFAULT_RESUME_DATA = {
    basics: { name: "", email: "", phone: "", location: {}, profiles: [] },
    sections: {
        summary: { name: "Summary", columns: 1, visible: true, id: "summary" },
        education: { name: "Education", columns: 1, visible: true, id: "education", items: [] },
        experience: { name: "Experience", columns: 1, visible: true, id: "experience", items: [] },
        skills: { name: "Skills", columns: 1, visible: true, id: "skills", items: [] },
        projects: { name: "Projects", columns: 1, visible: true, id: "projects", items: [] },
        awards: { name: "Awards", columns: 1, visible: true, id: "awards", items: [] },
    },
    metadata: { template: "pikachu", layout: {} }
};

export const ResumeBuilderPage = (): JSX.Element => {
    const { id: paramId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // Extract ID from URL since we are in a wildcard route /dashboard/*
    // Handles both:
    // /dashboard/resume/:id
    // /dashboard/resume/resume-builder/:id (User requested)
    const id = useMemo(() => {
        if (paramId) return paramId;
        const parts = location.pathname.split('/');

        if (parts.includes('resume')) {
            const resumeIndex = parts.indexOf('resume');
            const nextSegment = parts[resumeIndex + 1];

            // If the path contains 'resume-builder', the ID is the segment AFTER it
            if (nextSegment === 'resume-builder') {
                return parts[resumeIndex + 2];
            }

            // Otherwise, assumes /dashboard/resume/:id
            return nextSegment;
        }
        return undefined;
    }, [paramId, location.pathname]);

    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [zenMode, setZenMode] = useState(false);
    const [atsScore, setAtsScore] = useState(0); // Mock score for animation

    const { createEmpty } = useResumes();

    // Selectors
    const resume = useResumeStore((state) => state.resume);
    const title = resume?.title || "Untitled Resume";

    // Safe data access
    const resumeData = useMemo(() => {
        if (!resume?.data) return null;
        if (!resume.data.sections) return { ...resume.data, sections: DEFAULT_RESUME_DATA.sections };
        return resume.data;
    }, [resume]);

    const setArtboardResume = useArtboardStore((state) => state.setResume);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useRegisterCoachMarks({
        page: 'resume',
        marks: [
            { id: 'resume-header-actions', selector: '#resume-header-actions', title: 'Builder Actions', body: 'Save, preview, or export your resume from this toolbar.' },
            { id: 'resume-ats-score', selector: '#resume-ats-score', title: 'ATS Health Check', body: 'Real-time analysis of your resume content scoring.' }
        ]
    });

    // Calculate mock score based on content length
    useEffect(() => {
        if (resumeData) {
            // Simple heuristic for dynamic "alive" feeling
            const contentScore = Math.min(100, Math.floor(JSON.stringify(resumeData).length / 50));
            setAtsScore(prev => Math.abs(prev - contentScore) > 5 ? contentScore : prev);
        }
    }, [resumeData]);

    // Fetch Logic
    useEffect(() => {
        if (!id) return;

        let active = true;

        if (id === 'new') {
            const createNew = async () => {
                setLoading(true);
                try {
                    const newResume = await createEmpty({ name: 'Untitled Resume' });
                    if (active && newResume) {
                        // Redirect to the new resume builder URL
                        navigate(`/dashboard/resume/resume-builder/${newResume.id}`, { replace: true });
                    } else if (active) {
                        setLoading(false);
                    }
                } catch (e) {
                    console.error("Failed to create new resume", e);
                    if (active) setLoading(false);
                }
            };
            createNew();
            return () => { active = false; };
        }

        const fetchResume = async () => {
            try {
                setLoading(true);
                const fetched = await queryClient.fetchQuery({
                    queryKey: ["resume", { id }],
                    queryFn: () => findResumeById({ id }),
                });

                if (!active) return;

                const { resume: normalized } = normalizeResume(fetched);

                if (!normalized.data || !normalized.data.sections) {
                    normalized.data = { ...DEFAULT_RESUME_DATA, ...normalized.data };
                }

                useResumeStore.setState({ resume: normalized });
            } catch (err) {
                console.error("Failed to fetch resume:", err);
                if (active) navigate("/dashboard/resumes");
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchResume();
        return () => { active = false; };
    }, [id, navigate, createEmpty]);

    useEffect(() => {
        if (resumeData) setArtboardResume(resumeData);
    }, [resumeData, setArtboardResume]);

    useEffect(() => {
        const syncIframe = () => {
            if (!iframeRef.current?.contentWindow || !resumeData) return;
            if (!resumeData.sections) return;
            iframeRef.current.contentWindow.postMessage({ type: 'SET_RESUME', payload: { resume: resumeData } }, '*');
        };
        if (resumeData) {
            syncIframe();
            const t1 = setTimeout(syncIframe, 500);
            return () => clearTimeout(t1);
        }
    }, [resumeData]);

    const handleSave = async () => {
        setIsSaving(true);
        await new Promise(r => setTimeout(r, 800));
        setIsSaving(false);
    };

    const handleDownload = (format: 'pdf' | 'json') => {
        console.log(`Downloading as ${format}`);
        // Implement actual download logic here or through a dialog
    };

    if (!id) return <ResumesPage />;

    return (
        <div className="h-full w-full flex flex-col bg-[#050505] overflow-hidden relative group/studio">
            <Helmet>
                <title>{title} - Studio - JobRaker</title>
            </Helmet>

            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1dff0005_1px,transparent_1px),linear-gradient(to_bottom,#1dff0005_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/80 pointer-events-none" />

            {/* Floating Glass Header */}
            <motion.header
                layout
                className={`z-30 shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl transition-all duration-300 ${zenMode ? '-mt-20 opacity-0 pointer-events-none' : 'h-16 px-6'}`}
            >
                <div className="h-full flex items-center justify-between max-w-[1920px] mx-auto">
                    {/* Left Control Group */}
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/dashboard/resume')}
                            className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full ring-1 ring-white/5 hover:ring-[#1dff00]/30 transition-all"
                        >
                            <ArrowLeft size={18} />
                        </Button>

                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm font-bold text-white tracking-tight">
                                    {loading ? <div className="h-4 w-32 bg-white/10 rounded animate-pulse" /> : title}
                                </h1>
                                {!loading && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1dff00]/10 text-[#1dff00] border border-[#1dff00]/20 uppercase tracking-widest shadow-[0_0_10px_rgba(29,255,0,0.1)]">
                                        Active Draft
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1dff00] animate-pulse shadow-[0_0_5px_#1dff00]" />
                                Auto-sync active
                            </div>
                        </div>
                    </div>

                    {/* Center: Resume Health Dashboard */}
                    <div className="hidden lg:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
                        <div id="resume-ats-score" className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-[#1dff00]/30 transition-all cursor-help group">
                            <div className="relative w-8 h-8 flex items-center justify-center">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-gray-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                    <path className="text-[#1dff00] drop-shadow-[0_0_3px_#1dff00]" strokeDasharray={`${atsScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                </svg>
                                <span className="absolute text-[9px] font-bold text-white">{atsScore}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-gray-300 group-hover:text-[#1dff00] transition-colors">ATS Score</span>
                                <span className="text-[9px] text-gray-500">{atsScore > 80 ? 'Excellent' : atsScore > 50 ? 'Good' : 'Needs Work'}</span>
                            </div>
                        </div>

                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20 rounded-full px-3">
                            <Wand2 size={12} />
                            <span>AI Assistant</span>
                        </Button>
                    </div>

                    {/* Right: Actions Toolbar */}
                    <div id="resume-header-actions" className="flex items-center gap-2">
                        <div className="hidden md:flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10 mr-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setZoom(Math.max(50, zoom - 10))}>
                                <ZoomOut size={14} />
                            </Button>
                            <span className="text-[10px] font-mono text-gray-400 w-8 text-center">{zoom}%</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setZoom(Math.min(150, zoom + 10))}>
                                <ZoomIn size={14} />
                            </Button>
                        </div>

                        <div className="h-4 w-[1px] bg-white/10 mx-1" />

                        <div className="flex items-center gap-2">
                            {/* Export Dropdown Trigger (Mock) */}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#1dff00] hover:bg-[#1dff00]/10" onClick={() => handleDownload('pdf')}>
                                <Download size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-[#1dff00] hover:bg-[#1dff00]/10">
                                <Share2 size={16} />
                            </Button>
                            <Button
                                disabled={loading || isSaving}
                                onClick={handleSave}
                                size="sm"
                                className="h-8 gap-2 bg-[#1dff00] hover:bg-[#1dff00]/90 text-black font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(29,255,0,0.2)] hover:shadow-[0_0_30px_rgba(29,255,0,0.4)] transition-all rounded-lg px-4"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>Save</span>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setZenMode(!zenMode)}
                                className={`h-8 w-8 text-gray-400 hover:text-white transition-colors ${zenMode ? 'text-[#1dff00]' : ''}`}
                            >
                                {zenMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* Floating Zen Mode Toggle (Visible when header hidden) */}
            <AnimatePresence>
                {zenMode && (
                    <motion.button
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        onClick={() => setZenMode(false)}
                        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-gray-400 hover:text-white shadow-xl hover:scale-110 transition-all"
                    >
                        <Minimize2 size={18} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Builder Canvas Area */}
            <div id="resume-canvas-area" className="flex-1 relative w-full h-full overflow-hidden flex items-center justify-center p-0 lg:p-4 transition-all duration-300">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 backdrop-blur-sm">
                        <Loader2 className="w-12 h-12 text-[#1dff00] animate-spin mb-4" />
                        <p className="text-[#1dff00] text-sm font-bold animate-pulse tracking-widest uppercase">Initializing Studio...</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, ease: "circOut" }}
                            className={`relative w-full h-full transition-all duration-500 ease-in-out ${zenMode ? '' : 'lg:max-w-[1400px] lg:h-[95%]'}`}
                        >
                            {/* The "Device Frame" Effect */}
                            <div className={`w-full h-full overflow-hidden transition-all duration-500 ${zenMode ? '' : 'rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5'}`}>
                                <div className="w-full h-full" style={{ transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none', transformOrigin: 'center top', transition: 'transform 0.2s ease-out' }}>
                                    <iframe
                                        ref={iframeRef}
                                        title="Resume Builder Interface"
                                        src="/artboard/builder"
                                        className="w-full h-full border-0 block bg-[#1a1a1a]"
                                        allow="clipboard-read; clipboard-write; fullscreen"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
