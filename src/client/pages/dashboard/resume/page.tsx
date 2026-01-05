import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useResumeStore } from "@/client/stores/resume";
import { useArtboardStore } from "@/store/artboard";
import { queryClient } from "@/client/libs/query-client";
import { findResumeById } from "@/client/services/resume";
import { normalizeResume } from "@/client/utils/normalize-resume";
import { ResumesPage } from "../resumes/page";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    Save,
    Eye,
    Loader2,
    MonitorPlay,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisterCoachMarks } from "@/providers/TourProvider";

// Define a default/empty resume data structure to prevent 'undefined' errors
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
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Selectors
    const resume = useResumeStore((state) => state.resume);
    const title = resume?.title || "Untitled Resume";

    // Safe data access
    const resumeData = useMemo(() => {
        if (!resume?.data) return null;
        // ensure sections exists
        if (!resume.data.sections) return { ...resume.data, sections: DEFAULT_RESUME_DATA.sections };
        return resume.data;
    }, [resume]);

    const setArtboardResume = useArtboardStore((state) => state.setResume);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useRegisterCoachMarks({
        page: 'resume',
        marks: [
            { id: 'resume-header-actions', selector: '#resume-header-actions', title: 'Builder Actions', body: 'Save, preview, or export your resume from this toolbar.' },
            { id: 'resume-canvas-area', selector: '#resume-canvas-area', title: 'Live Editor', body: 'This is your live canvas. Edits reflect instantly.' }
        ]
    });

    // Fetch Logic
    useEffect(() => {
        if (!id) return;

        let active = true;
        const fetchResume = async () => {
            try {
                setLoading(true);
                const fetched = await queryClient.fetchQuery({
                    queryKey: ["resume", { id }],
                    queryFn: () => findResumeById({ id }),
                });

                if (!active) return;

                // Normalize to ensure structural integrity
                const { resume: normalized } = normalizeResume(fetched);

                // Double check sections exist, if not, patch them
                if (!normalized.data || !normalized.data.sections) {
                    normalized.data = { ...DEFAULT_RESUME_DATA, ...normalized.data };
                }

                useResumeStore.setState({ resume: normalized });
            } catch (err) {
                console.error("Failed to fetch resume:", err);
                if (active) navigate("/dashboard/resumes"); // Redirect to list on error
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchResume();
        return () => { active = false; };
    }, [id, navigate]);

    // Sync with Artboard Store (for local state management)
    useEffect(() => {
        if (resumeData) {
            setArtboardResume(resumeData);
        }
    }, [resumeData, setArtboardResume]);

    // Sync with Iframe (Visual Builder)
    useEffect(() => {
        const syncIframe = () => {
            if (!iframeRef.current?.contentWindow || !resumeData) return;

            // Safety check before sending
            if (!resumeData.sections) {
                console.warn("Attempting to send resume data without sections to iframe");
                return;
            }

            iframeRef.current.contentWindow.postMessage({
                type: 'SET_RESUME',
                payload: { resume: resumeData }
            }, '*');
        };

        if (resumeData) {
            syncIframe();
            // Retry strategy for iframe loading race conditions
            const t1 = setTimeout(syncIframe, 500);
            const t2 = setTimeout(syncIframe, 1500);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [resumeData]);

    const handleSave = async () => {
        setIsSaving(true);
        // In a real app, this would trigger a mutation. 
        // For now, we simulate a save delay since auto-save usually handles this in the background.
        await new Promise(r => setTimeout(r, 800));
        setIsSaving(false);
    };

    // MODE 1: List View (No ID)
    if (!id) {
        return <ResumesPage />;
    }

    // MODE 2: Builder View
    return (
        <div className="h-full w-full flex flex-col bg-black overflow-hidden relative">
            <Helmet>
                <title>{title} - Builder - JobRaker</title>
            </Helmet>

            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[#1dff00]/[0.02] pointer-events-none" />

            {/* Header Toolbar */}
            <header className="h-16 border-b border-white/5 bg-black/50 backdrop-blur-md flex items-center justify-between px-6 z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/dashboard/resume')} // Go back to list
                        className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
                    >
                        <ArrowLeft size={18} />
                    </Button>

                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold text-white tracking-tight">
                                {loading ? <div className="h-4 w-32 bg-white/10 rounded animate-pulse" /> : title}
                            </h1>
                            {!loading && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1dff00]/10 text-[#1dff00] border border-[#1dff00]/20 uppercase tracking-widest">
                                    Draft
                                </span>
                            )}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                            Auto-saving enabled
                        </div>
                    </div>
                </div>

                <div id="resume-header-actions" className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 mr-4 text-xs text-gray-500">
                        <MonitorPlay size={12} />
                        <span>Syncing...</span>
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

            {/* Builder Workspace */}
            <div id="resume-canvas-area" className="flex-1 relative w-full h-full bg-[#0a0a0a] overflow-hidden">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                        <Loader2 className="w-10 h-10 text-[#1dff00] animate-spin mb-4" />
                        <p className="text-gray-500 text-sm animate-pulse">Loading Studio...</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="w-full h-full"
                        >
                            <iframe
                                ref={iframeRef}
                                title="Resume Builder Interface"
                                src="/artboard/builder"
                                className="w-full h-full border-0 block"
                                allow="clipboard-read; clipboard-write"
                            />
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
