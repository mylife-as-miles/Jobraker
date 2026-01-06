import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useResumeStore } from "@/client/stores/resume";
import { useArtboardStore } from "@/store/artboard";
import { queryClient } from "@/client/libs/query-client";
import { findResumeById, updateResume } from "@/client/services/resume";
import { normalizeResume } from "@/client/utils/normalize-resume";
import { ResumesPage } from "../resumes/page";
import { useResumes } from "@/hooks/useResumes";
import { Button } from "@/components/ui/button";
import { useToast } from "@/client/hooks/use-toast";
import { EmbeddedBuilderCanvas } from "./_components/EmbeddedBuilderCanvas";
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
    PanelLeft,
    PanelRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisterCoachMarks } from "@/providers/TourProvider";

// Builder Layout Imports
import {
    Panel,
    PanelGroup,
    PanelResizeHandle,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    VisuallyHidden,
} from "@reactive-resume/ui";
import { cn } from "@reactive-resume/utils";
import { useBreakpoint } from "@reactive-resume/hooks";
import { useBuilderStore } from "@/client/stores/builder";
import { LeftSidebar } from "@/client/pages/builder/sidebars/left";
import { RightSidebar } from "@/client/pages/builder/sidebars/right";

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
    metadata: {
        template: "pikachu",
        layout: {
            summary: [["summary"]],
            education: [["education"]],
            experience: [["experience"]],
            skills: [["skills"]],
            projects: [["projects"]],
            awards: [["awards"]],
        },
        page: {
            format: "A4",
            options: { breakLine: true, pageNumbers: true },
        },
        theme: {
            background: "#ffffff",
            text: "#000000",
            primary: "#000000",
        },
        typography: {
            font: { family: "Inter", subset: "latin", variants: ["regular"] },
            lineHeight: 1.5,
            hideIcons: false,
            underlineLinks: false,
        },
    },
};

const onOpenAutoFocus = (event: Event) => {
    event.preventDefault();
};

export const ResumeBuilderPage = (): JSX.Element => {
    const { id: paramId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isDesktop } = useBreakpoint();

    // Store hooks for panels/sheets
    const sheet = useBuilderStore((state) => state.sheet);
    const leftSetSize = useBuilderStore((state) => state.panel.left.setSize);
    const rightSetSize = useBuilderStore((state) => state.panel.right.setSize);
    const leftHandle = useBuilderStore((state) => state.panel.left.handle);
    const rightHandle = useBuilderStore((state) => state.panel.right.handle);
    const toggleSheet = useBuilderStore((state) => state.toggle);

    // Extract ID
    const id = useMemo(() => {
        if (paramId) return paramId;
        const parts = location.pathname.split('/');
        if (parts.includes('resume')) {
            const resumeIndex = parts.indexOf('resume');
            const nextSegment = parts[resumeIndex + 1];
            if (nextSegment === 'resume-builder') {
                return parts[resumeIndex + 2];
            }
            return nextSegment;
        }
        return undefined;
    }, [paramId, location.pathname]);

    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [zenMode, setZenMode] = useState(false);
    const [atsScore, setAtsScore] = useState(0);

    const { createEmpty } = useResumes();
    const resume = useResumeStore((state) => state.resume);
    const title = resume?.title || "Untitled Resume";

    const resumeData = useMemo(() => {
        if (!resume?.data) return null;
        if (!resume.data.sections) return { ...DEFAULT_RESUME_DATA, ...resume.data };
        return resume.data;
    }, [resume]);

    const setArtboardResume = useArtboardStore((state) => state.setResume);

    useRegisterCoachMarks({
        page: 'resume',
        marks: [
            { id: 'resume-header-actions', selector: '#resume-header-actions', title: 'Builder Actions', body: 'Save, preview, or export your resume from this toolbar.' },
            { id: 'resume-ats-score', selector: '#resume-ats-score', title: 'ATS Health Check', body: 'Real-time analysis of your resume content scoring.' }
        ]
    });

    // Mock ATS Score
    useEffect(() => {
        if (resumeData) {
            const contentScore = Math.min(100, Math.floor(JSON.stringify(resumeData).length / 50));
            setAtsScore(prev => Math.abs(prev - contentScore) > 5 ? contentScore : prev);
        }
    }, [resumeData]);

    // Fetch Resume
    useEffect(() => {
        if (!id) return;
        let active = true;

        if (id === 'new') {
            const createNew = async () => {
                setLoading(true);
                try {
                    const newResume = await createEmpty({ name: 'Untitled Resume' });
                    if (active && newResume) {
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
                    // Merge with comprehensive defaults including metadata
                    // Careful not to overwrite if section data exists
                    normalized.data = { ...DEFAULT_RESUME_DATA, ...normalized.data };
                    // Ensure metadata exists especially
                    if (!normalized.data.metadata || !normalized.data.metadata.page) {
                        normalized.data.metadata = { ...DEFAULT_RESUME_DATA.metadata, ...normalized.data.metadata };
                    }
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

    // Sync to Artboard Store
    useEffect(() => {
        if (resumeData) setArtboardResume(resumeData);
    }, [resumeData, setArtboardResume]);

    const handleSave = async () => {
        if (!resume || !resume.id) return;
        setIsSaving(true);
        try {
            await updateResume({
                id: resume.id,
                data: resume.data,
            });
            toast({
                title: "Resume Saved",
                description: "Your changes have been saved successfully.",
            });
        } catch (error) {
            console.error("Save error:", error);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: "Could not save your resume. Please try again.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = (format: 'pdf' | 'json') => {
        console.log(`Downloading as ${format}`);
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

            {/* Header */}
            {!zenMode && (
                <motion.header
                    layout
                    className="z-30 shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl h-16 px-6"
                >
                    <div className="h-full flex items-center justify-between max-w-[1920px] mx-auto">
                        {/* Left Control Group */}
                        <div className="flex items-center gap-4">
                            {!isDesktop && (
                                <Button variant="ghost" size="icon" onClick={() => toggleSheet('left')}>
                                    <PanelLeft size={18} />
                                </Button>
                            )}
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
                        <div className="hidden xl:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
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
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => window.dispatchEvent(new CustomEvent('ARTBOARD_CMD', { detail: { type: 'ZOOM_OUT' } }))}>
                                    <ZoomOut size={14} />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-mono text-gray-400 hover:text-white px-2" onClick={() => window.dispatchEvent(new CustomEvent('ARTBOARD_CMD', { detail: { type: 'RESET_VIEW' } }))}>
                                    Reset
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => window.dispatchEvent(new CustomEvent('ARTBOARD_CMD', { detail: { type: 'ZOOM_IN' } }))}>
                                    <ZoomIn size={14} />
                                </Button>
                            </div>

                            <div className="h-4 w-[1px] bg-white/10 mx-1" />

                            <div className="flex items-center gap-2">
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
                                {!isDesktop && (
                                    <Button variant="ghost" size="icon" onClick={() => toggleSheet('right')}>
                                        <PanelRight size={18} />
                                    </Button>
                                )}
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
            )}

            {/* Floating Zen Mode Toggle */}
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

            {/* Main Builder Content (3 Panels on Desktop) */}
            <div className="flex-1 relative w-full h-full overflow-hidden flex flex-col">
                {isDesktop ? (
                    <PanelGroup direction="horizontal" className="h-full w-full">
                        {/* Left Sidebar: Editor */}
                        {!zenMode && (
                            <>
                                <Panel
                                    minSize={25}
                                    maxSize={45}
                                    defaultSize={30}
                                    className={cn("z-10 bg-[#0a0a0a]/95 border-r border-[#1dff00]/20 shadow-[inset_-10px_0_30px_rgba(29,255,0,0.05)]", !leftHandle.isDragging && "transition-[flex]")}
                                    onResize={leftSetSize}
                                >
                                    <LeftSidebar />
                                </Panel>
                                <PanelResizeHandle
                                    isDragging={leftHandle.isDragging}
                                    onDragging={leftHandle.setDragging}
                                    className="w-1 bg-gradient-to-b from-transparent via-[#1dff00]/40 to-transparent hover:bg-[#1dff00]/60 transition-colors cursor-col-resize"
                                />
                            </>
                        )}

                        {/* Middle: Preview Canvas */}
                        <Panel className="bg-transparent relative">
                            {loading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 backdrop-blur-sm">
                                    <Loader2 className="w-12 h-12 text-[#1dff00] animate-spin mb-4" />
                                    <p className="text-[#1dff00] text-sm font-bold animate-pulse tracking-widest uppercase">Initializing Studio...</p>
                                </div>
                            ) : (
                                <div className="w-full h-full">
                                    <EmbeddedBuilderCanvas />
                                </div>
                            )}
                        </Panel>

                        {/* Right Sidebar: Settings/Templates */}
                        {!zenMode && (
                            <>
                                <PanelResizeHandle
                                    isDragging={rightHandle.isDragging}
                                    onDragging={rightHandle.setDragging}
                                    className="w-1 bg-gradient-to-b from-transparent via-[#1dff00]/40 to-transparent hover:bg-[#1dff00]/60 transition-colors cursor-col-resize"
                                />
                                <Panel
                                    minSize={25}
                                    maxSize={45}
                                    defaultSize={30}
                                    className={cn("z-10 bg-[#0a0a0a]/95 border-l border-[#1dff00]/20 shadow-[inset_10px_0_30px_rgba(29,255,0,0.05)]", !rightHandle.isDragging && "transition-[flex]")}
                                    onResize={rightSetSize}
                                >
                                    <RightSidebar />
                                </Panel>
                            </>
                        )}
                    </PanelGroup>
                ) : (
                    // Mobile View
                    <div className="relative w-full h-full">
                        <div className="w-full h-full">
                            {loading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 backdrop-blur-sm">
                                    <Loader2 className="w-12 h-12 text-[#1dff00] animate-spin mb-4" />
                                </div>
                            ) : (
                                <EmbeddedBuilderCanvas />
                            )}
                        </div>

                        {/* Mobile Sheets */}
                        <Sheet open={sheet.left.open} onOpenChange={sheet.left.setOpen}>
                            <VisuallyHidden>
                                <SheetHeader>
                                    <SheetTitle>Editor</SheetTitle>
                                    <SheetDescription>Edit your resume content</SheetDescription>
                                </SheetHeader>
                            </VisuallyHidden>
                            <SheetContent side="left" showClose={false} className="p-0 pt-12 sm:max-w-xl" onOpenAutoFocus={onOpenAutoFocus}>
                                <LeftSidebar />
                            </SheetContent>
                        </Sheet>
                        <Sheet open={sheet.right.open} onOpenChange={sheet.right.setOpen}>
                            <VisuallyHidden>
                                <SheetHeader>
                                    <SheetTitle>Settings</SheetTitle>
                                    <SheetDescription>Templates and Layouts</SheetDescription>
                                </SheetHeader>
                            </VisuallyHidden>
                            <SheetContent side="right" showClose={false} className="p-0 pt-12 sm:max-w-xl" onOpenAutoFocus={onOpenAutoFocus}>
                                <RightSidebar />
                            </SheetContent>
                        </Sheet>
                    </div>
                )}
            </div>
        </div>
    );
};
