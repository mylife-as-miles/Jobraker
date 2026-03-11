import React, { useState } from "react";
import {
  ArrowLeft,
  Edit2,
  LayoutTemplate,
  Sparkles,
  Wand2,
  Download,
  User,
  ChevronUp,
  ChevronDown,
  Briefcase,
  Plus,
  GraduationCap,
  BrainCircuit,
  X,
  ZoomIn,
  ZoomOut,
  FileText,
  FolderGit2,
  Languages,
  Heart,
  Trophy,
  Scroll,
  BookOpen,
  HandHeart,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useArtboardStore } from "../../../store/artboard";
import { createClient } from "../../../lib/supabaseClient";
import { AzurillTemplate } from "../../../templates/azurill/index";
import { TemplateSelector } from "../components/TemplateSelector";
import { AddSectionDialog } from "../components/resume/AddSectionDialog";
import { SectionEditor } from "../components/resume/SectionEditor";
import { ListEditor } from "../components/resume/ListEditor";
import { PersonalDetailsEditor } from "../components/resume/PersonalDetailsEditor";
import { ShareDialog } from "../components/resume/ShareDialog";
import { Share2 } from "lucide-react";

// ... templates imports ...
import { OnyxTemplate } from "../../../templates/onyx";
import { BronzorTemplate } from "../../../templates/bronzor";
import { ChikoritaTemplate } from "../../../templates/chikorita";
import { DitgarTemplate } from "../../../templates/ditgar";
import { DittoTemplate } from "../../../templates/ditto";
import { GengarTemplate } from "../../../templates/gengar";
import { GlalieTemplate } from "../../../templates/glalie";
import { KakunaTemplate } from "../../../templates/kakuna";
import { PikachuTemplate } from "../../../templates/pikachu";
import { RhyhornTemplate } from "../../../templates/rhyhorn";
import { useProfileSettings } from "../../../hooks/useProfileSettings";
import { Button } from "../../../components/ui/button";
import Modal from "../../../components/ui/modal";
import { downloadResumePDF } from "../../../utils/resume-download";
import { useToast } from "../../../components/ui/toast";
import { polishContent } from "../../../services/ai/polishContent";

const SECTION_ICONS: Record<string, any> = {
  experience: Briefcase,
  education: GraduationCap,
  skills: BrainCircuit,
  projects: FolderGit2,
  languages: Languages,
  interests: Heart,
  awards: Trophy,
  certifications: Scroll,
  publications: BookOpen,
  volunteer: HandHeart,
  references: Users,
  custom: LayoutTemplate,
};

export const ResumeBuilderPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const urlId = location.pathname.split("/")[4] || null;
  const [zoom, setZoom] = useState(0.8);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const { success, error: toastError } = useToast();
  const supabase = createClient();
  // Store State & Actions
  const resumeId = useArtboardStore((state) => state.resume.id);
  const resumeData = useArtboardStore((state) => state.resume.data);
  const setResume = useArtboardStore((state) => state.setResume);
  const setResumeId = useArtboardStore((state) => state.setResumeId);
  const setResumeData = useArtboardStore((state) => state.setResumeData);
  const setResumeTitle = useArtboardStore((state) => state.setResumeTitle);

  // Fetch Resume if ID changes or is provided in URL
  React.useEffect(() => {
    const loadResume = async () => {
      if (urlId && urlId !== resumeId) {
        try {
          const { data, error } = await supabase
            .from("resumes")
            .select("*")
            .eq("id", urlId)
            .single();

          if (error) throw error;
          if (data && data.data) {
            setResumeId(data.id);
            setResumeData(data.data);
            setResume({
              is_public: data.public_share_enabled,
              views: data.views || 0,
              downloads: data.downloads || 0,
            });
          }
        } catch (error) {
          console.error("Error loading resume:", error);
        }
      }
    };
    loadResume();
  }, [urlId, resumeId, setResumeId, setResumeData, supabase]);

  // Profile Data for Auto-population
  const {
    profile,
    experiences,
    education: profileEducation,
    skills: profileSkills,
  } = useProfileSettings();
  const [userEmail, setUserEmail] = useState("");

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, [supabase]);

  // Auto-populate logic (simplified for brevity, keeping existing logic)
  React.useEffect(() => {
    if (!resumeId && resumeData.basics.name === "John Doe" && profile) {
      const updatedBasics = {
        ...resumeData.basics,
        name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
        headline: profile.job_title || resumeData.basics.headline,
        location: profile.location || resumeData.basics.location,
        email: userEmail || resumeData.basics.email,
        phone: profile.phone || resumeData.basics.phone,
      };
      updateBasics(updatedBasics);
    }
  }, [
    profile,
    experiences.data,
    profileEducation.data,
    profileSkills.data,
    resumeId,
    resumeData.basics.name,
    userEmail,
  ]);

  // Actions
  const updateBasics = useArtboardStore((state) => state.updateBasics);
  const toggleSectionVisibility = useArtboardStore(
    (state) => state.toggleSectionVisibility,
  );

  // Helper for summary
  const setSummary = (val: string) =>
    setResumeData({ summary: { ...resumeData.summary, content: val } });

  const { basics, sections, summary, metadata } = resumeData;

  // Get active sections from layout order
  const layoutPage = metadata.layout.pages[0];
  const orderedSectionIds = [...layoutPage.main, ...layoutPage.sidebar];
  // Filter for unique IDs and ensure they exist in sections and are not hidden.
  // Exclude 'summary' because it is rendered explicitly above.
  const visibleSections = orderedSectionIds.filter(
    (id) => id !== "summary" && sections[id] && !sections[id].hidden,
  );

  const selectedTemplate = metadata?.template || "azurill";

  const [expandedSection, setExpandedSection] = useState<string | null>(
    "personal",
  );

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const downloadPDF = () => {
    downloadResumePDF(resumeData);
  };

  const aiPolishSummary = async (instruction = "Polish this resume summary for clarity, confidence, and measurable impact.") => {
    setAiLoading(true);
    try {
      const source = (summary.content || basics.headline || basics.name || "").trim();
      if (!source) throw new Error("Add a summary or headline first.");
      const suggestions = await polishContent(source, instruction);
      const nextSummary = suggestions.find((item) => item.isRecommended)?.content || suggestions[0]?.content || "";
      if (!nextSummary) throw new Error("No AI suggestion was returned.");
      setSummary(nextSummary); success(instruction.includes("fresh") ? "Summary generated" : "Summary polished", instruction.includes("fresh") ? "A new AI summary has been added to your resume." : "AI suggestions have been applied to your resume summary.");
    } catch (e: any) { toastError(instruction.includes("fresh") ? "AI generation failed" : "AI rewrite failed", e?.message || "AI is temporarily unavailable."); } finally { setAiLoading(false); }
  };
  const aiGenerateResume = async () => aiPolishSummary("Write a fresh professional resume summary in 3-4 concise sentences.");
  const [saveAlertOpen, setSaveAlertOpen] = useState(false);

  const handleSave = async () => {
    if (!urlId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("resumes")
        .update({
          data: resumeData,
          name: resumeData.title,
          slug: resumeData.slug,
          tags: resumeData.tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", urlId);
      if (error) throw error;
      success("Resume saved", "Your latest resume changes have been saved.");
      setSaveAlertOpen(true);
    } catch (e: any) {
      toastError("Save failed", e?.message || "Unable to save your resume right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='product-page-shell flex flex-col h-full relative overflow-hidden'>
      {/* Save Alert Modal */}
      <Modal
        open={saveAlertOpen}
        onClose={() => setSaveAlertOpen(false)}
        title="Resume Saved"
        size="sm"
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setSaveAlertOpen(false)}>Close</Button>
          </div>
        }
      >
        <div className="text-foreground/80 py-4">
          Your resume has been saved successfully.
        </div>
      </Modal>

      {/* Header toolbar */}
      <header className='h-16 shrink-0 border-b border-border/40 bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/85 flex items-center justify-between z-10'>
        <div className='flex items-center gap-4'>
          <button
            onClick={() => navigate("/dashboard/resume")}
            className='product-helper-text flex items-center gap-2 text-sm transition-colors hover:text-foreground'
          >
            <ArrowLeft className='w-4 h-4' />
            <span>Back</span>
          </button>
          <div className='h-6 w-px bg-border/60' />
          <div className='flex items-center gap-2 group'>
            <input
              value={resumeData.title || "Untitled Resume"}
              onChange={(e) => setResumeTitle(e.target.value)}
              className='product-page-title min-w-[200px] rounded bg-transparent px-1 font-semibold outline-none focus:ring-1 focus:ring-[#ffd700]' 
            />
            <Edit2 className='product-helper-text w-3.5 h-3.5 opacity-0 transition-opacity group-hover:opacity-100' />
          </div>
        </div>

        <div className='flex items-center gap-3'>
          <button
            onClick={() => setIsTemplateSelectorOpen(true)}
            className='product-outline-button flex items-center gap-2 px-3 py-2 text-sm font-medium'
          >
            <LayoutTemplate className='w-4 h-4' />
            Templates
            <ChevronDown className='w-3 h-3 opacity-50' />
          </button>

          <button
            onClick={() => setIsShareOpen(true)}
            className='product-outline-button flex items-center gap-2 px-3 py-2 text-sm font-medium'
          >
            <Share2 className='w-4 h-4' />
            Share
          </button>

          <button
            onClick={() => aiPolishSummary()}
            disabled={aiLoading}
            className='flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1dff00] hover:bg-[#15bd00] text-black text-sm font-bold transition-all shadow-[0_0_15px_rgba(29,255,0,0.3)] disabled:opacity-60'>
            <Sparkles className='w-4 h-4' />
            {aiLoading ? "Polishing..." : "AI Polish"}
          </button>
          <button
            onClick={aiGenerateResume}
            disabled={aiLoading}
            className='product-outline-button flex items-center gap-2 px-4 py-2 text-sm font-bold hover:border-[#ffd700]/60 hover:bg-[#fff2b3]' 
          >
            <Wand2 className={`w-4 h-4 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Generating..." : "AI Generate"}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !urlId}
            className='product-outline-button flex items-center gap-2 px-4 py-2 text-sm font-bold disabled:opacity-50' 
          >
            <FileText className={`w-4 h-4 ${saving ? "animate-pulse" : ""}`} />
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <button
            onClick={downloadPDF}
            className='product-outline-button flex items-center gap-2 px-4 py-2 text-sm font-medium'
          >
            <Download className='w-4 h-4' />
            Download PDF
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className='flex-1 flex overflow-hidden'>
        {/* Editor Panel (Left) */}
        <div className='product-section-card-muted w-[40%] min-w-[350px] max-w-[500px] flex flex-col overflow-y-auto custom-scrollbar rounded-none border-y-0 border-l-0 pb-20'>
          <div className='p-6 space-y-4'>
            {/* Content Header */}
            <div className='flex items-center justify-between mb-2'>
              <h3 className='product-helper-text text-xs font-bold uppercase tracking-wider'>
                Content
              </h3>
              <div className='text-[10px] text-[#1dff00] flex items-center gap-1 font-medium'>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${saving ? "bg-yellow-500 animate-pulse" : "bg-[#1dff00]"}`}
                />
                {saving ? "Saving..." : "Ready"}
              </div>
            </div>

            {/* Personal Info Section */}
            <div
              className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === "personal" ? "ring-1 ring-[#1dff00]/50" : "hover:border-[#1dff00]/30"}`}
            >
              <div
                className='p-5 flex items-center justify-between cursor-pointer'
                onClick={() => toggleSection("personal")}
              >
                <div className='flex items-center gap-3'>
                  <User className='w-5 h-5 text-[#1dff00]' />
                  <h4 className='font-semibold product-page-title'>
                    Personal Info
                  </h4>
                </div>
                {expandedSection === "personal" ? (
                  <ChevronUp className='w-4 h-4 product-helper-text' />
                ) : (
                  <ChevronDown className='w-4 h-4 product-helper-text' />
                )}
              </div>
              {expandedSection === "personal" && <PersonalDetailsEditor />}
            </div>

            {/* Summary Section */}
            {!summary.hidden && (
              <div
                className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === "summary" ? "ring-1 ring-[#1dff00]/50" : "hover:border-[#1dff00]/30"}`}
              >
                <div
                  className='p-5 flex items-center justify-between cursor-pointer'
                  onClick={() => toggleSection("summary")}
                >
                  <div className='flex items-center gap-3'>
                    <FileText className='w-5 h-5 text-[#1dff00]' />
                    <h4 className='font-semibold product-page-title'>
                      Summary
                    </h4>
                  </div>
                  {expandedSection === "summary" ? (
                    <ChevronUp className='w-4 h-4 product-helper-text' />
                  ) : (
                    <ChevronDown className='w-4 h-4 product-helper-text' />
                  )}
                </div>

                {expandedSection === "summary" && (
                  <div className='p-5 pt-0 animate-in slide-in-from-top-2 duration-200'>
                    <textarea
                      value={summary.content || ""}
                      onChange={(e) => setSummary(e.target.value)}
                      rows={4}
                      className='product-input-surface w-full rounded-lg px-3 py-2 text-sm outline-none transition-all focus:border-[#ffd700] focus:ring-1 focus:ring-[#ffd700]'
                      placeholder='Brief professional summary...'
                    />
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Sections */}
            {visibleSections.map((sectionId) => {
              const section = sections[sectionId];
              if (!section || section.hidden) return null;

              const Icon = SECTION_ICONS[sectionId] || SECTION_ICONS.custom;

              return (
                <div
                  key={sectionId}
                  className={`product-section-card rounded-xl overflow-hidden transition-all ${expandedSection === sectionId ? "ring-1 ring-[#1dff00]/50" : "hover:border-[#1dff00]/30"}`}
                >
                  <div
                    className='p-5 flex items-center justify-between cursor-pointer'
                    onClick={() => toggleSection(sectionId)}
                  >
                    <div className='flex items-center gap-3'>
                      <Icon className='w-5 h-5 text-[#1dff00]' />
                      <h4 className='font-semibold product-page-title'>
                        {section.title}
                      </h4>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        className='p-1 hover:bg-muted rounded product-helper-text hover:text-red-500 transition-colors'
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSectionVisibility(sectionId);
                        }}
                        title='Hide Section'
                      >
                        <X className='w-4 h-4' />
                      </button>
                      {expandedSection === sectionId ? (
                        <ChevronUp className='w-4 h-4 product-helper-text' />
                      ) : (
                        <ChevronDown className='w-4 h-4 product-helper-text' />
                      )}
                    </div>
                  </div>

                  {expandedSection === sectionId && (
                    <div className='p-5 pt-0'>
                      {section.type === "list" ? (
                        <ListEditor sectionId={sectionId} />
                      ) : (
                        <SectionEditor sectionId={sectionId} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Section Button */}
            <div className='pt-4 pb-20'>
              <Button
                variant='outline'
                className='w-full py-6 border-dashed border-gray-300 dark:border-foreground/20 hover:border-[#1dff00] hover:text-[#1dff00] hover:bg-[#1dff00]/5'
                onClick={() => setIsAddSectionOpen(true)}
              >
                <Plus className='w-5 h-5 mr-2' />
                Add Section
              </Button>
            </div>
          </div>
        </div>

        {/* Preview Panel (Right) */}
        <div className='flex-1 overflow-y-auto flex justify-center p-8 relative custom-scrollbar bg-[hsl(var(--product-surface-muted))] dark:bg-background'>
          <div className='fixed top-24 right-8 z-10 flex flex-col gap-2'>
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.1, 1.5))}
              className='product-section-card flex h-10 w-10 items-center justify-center rounded-full shadow-xl product-helper-text transition-colors hover:text-[#ffd700]'
            >
              <ZoomIn className='w-5 h-5' />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
              className='product-section-card flex h-10 w-10 items-center justify-center rounded-full shadow-xl product-helper-text transition-colors hover:text-[#ffd700]'
            >
              <ZoomOut className='w-5 h-5' />
            </button>
          </div>

          <div
            className='bg-white shadow-2xl origin-top transition-transform duration-200 min-h-[1123px] w-[794px]'
            style={{
              transform: `scale(${zoom})`,
              marginBottom: `${(zoom - 1) * 1123}px`,
            }}
          >
            {selectedTemplate === "azurill" && <AzurillTemplate />}
            {selectedTemplate === "onyx" && <OnyxTemplate />}
            {selectedTemplate === "bronzor" && <BronzorTemplate />}
            {selectedTemplate === "chikorita" && <ChikoritaTemplate />}
            {selectedTemplate === "ditgar" && <DitgarTemplate />}
            {selectedTemplate === "ditto" && <DittoTemplate />}
            {selectedTemplate === "gengar" && <GengarTemplate />}
            {selectedTemplate === "glalie" && <GlalieTemplate />}
            {selectedTemplate === "kakuna" && <KakunaTemplate />}
            {selectedTemplate === "pikachu" && <PikachuTemplate />}
            {selectedTemplate === "rhyhorn" && <RhyhornTemplate />}
          </div>
        </div>
      </div>

      <TemplateSelector
        isOpen={isTemplateSelectorOpen}
        onClose={() => setIsTemplateSelectorOpen(false)}
      />
      <AddSectionDialog
        open={isAddSectionOpen}
        onOpenChange={setIsAddSectionOpen}
      />
      <ShareDialog open={isShareOpen} onOpenChange={setIsShareOpen} />
    </div>
  );
};

export default ResumeBuilderPage;







