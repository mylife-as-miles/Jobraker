import React, { useState } from 'react';
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
    Trash2,
    GraduationCap,
    BrainCircuit,
    X,
    ZoomIn,
    ZoomOut,
    FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useArtboardStore } from '../../../store/artboard';
import { createClient } from '../../../lib/supabaseClient';
import jsPDF from 'jspdf';
import { AzurillTemplate } from '../../../templates/azurill/index';
import { TemplateSelector } from '../components/TemplateSelector';
import { OnyxTemplate } from '../../../templates/onyx';
import { BronzorTemplate } from '../../../templates/bronzor';
import { useProfileSettings } from '../../../hooks/useProfileSettings';

export const ResumeBuilderPage = () => {
    const navigate = useNavigate();
    const [zoom, setZoom] = useState(0.8);
    const [aiLoading, setAiLoading] = useState(false);
    const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
    const supabase = createClient();

    // State
    const resumeData = useArtboardStore((state) => state.resume.data);
    const setResumeData = useArtboardStore((state) => state.setResumeData);
    const setResumeTitle = useArtboardStore((state) => state.setResumeTitle);

    // Profile Data for Auto-population
    const { profile, experiences, education: profileEducation, skills: profileSkills } = useProfileSettings();
    const [userEmail, setUserEmail] = useState('');

    React.useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.email) setUserEmail(data.user.email);
        });
    }, [supabase]);

    // Auto-populate from profile if default
    React.useEffect(() => {
        if (resumeData.basics.name === 'John Doe' && profile) {
            const newBasics = {
                ...resumeData.basics,
                name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
                headline: profile.job_title || resumeData.basics.headline,
                location: profile.location || resumeData.basics.location,
                email: userEmail || resumeData.basics.email,
                phone: profile.phone || resumeData.basics.phone,
            };

            // Map Experience
            const newExperience = {
                ...resumeData.sections.experience,
                items: experiences.data.length > 0 ? experiences.data.map(exp => ({
                    id: exp.id,
                    hidden: false,
                    company: exp.company,
                    title: exp.title,
                    period: `${new Date(exp.start_date).getFullYear()} - ${exp.end_date ? new Date(exp.end_date).getFullYear() : 'Present'}`,
                    description: exp.description,
                    location: exp.location
                })) : resumeData.sections.experience.items
            };

            // Map Education
            const newEducation = {
                ...resumeData.sections.education,
                items: profileEducation.data.length > 0 ? profileEducation.data.map(edu => ({
                    id: edu.id,
                    hidden: false,
                    school: edu.school,
                    degree: edu.degree,
                    period: `${new Date(edu.start_date).getFullYear()} - ${edu.end_date ? new Date(edu.end_date).getFullYear() : 'Present'}`,
                    location: edu.location
                })) : resumeData.sections.education.items
            };

            // Map Skills
            const newSkills = {
                ...resumeData.sections.skills,
                items: profileSkills.data.length > 0 ? profileSkills.data.map(skill => ({
                    id: skill.id,
                    hidden: false,
                    name: skill.name,
                    level: 3 // Default level
                })) : resumeData.sections.skills.items
            };

            setResumeData({
                basics: newBasics,
                sections: {
                    ...resumeData.sections,
                    experience: newExperience,
                    education: newEducation,
                    skills: newSkills
                }
            });
        }
    }, [profile, experiences.data, profileEducation.data, profileSkills.data, resumeData.basics.name, userEmail]);

    // Actions
    const updateBasics = useArtboardStore((state) => state.updateBasics);
    const addSectionItem = useArtboardStore((state) => state.addSectionItem);
    const updateSectionItem = useArtboardStore((state) => state.updateSectionItem);
    const removeSectionItem = useArtboardStore((state) => state.removeSectionItem);

    // Helper for summary
    const setSummary = (val: string) => setResumeData({ summary: { ...resumeData.summary, content: val } });

    // Destructure for easier access
    const { basics, sections, summary, metadata } = resumeData;
    const { experience, education, skills } = sections;

    // Derive selected template from store, default to azurill
    const selectedTemplate = metadata?.template || 'azurill';

    // Local UI State
    const [newSkill, setNewSkill] = useState('');
    const [expandedSection, setExpandedSection] = useState<string | null>('personal');

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const handleSkillAdd = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && newSkill.trim()) {
            const newItem = {
                id: crypto.randomUUID(),
                hidden: false,
                name: newSkill.trim(),
                level: 3,
            };
            addSectionItem('skills', newItem);
            setNewSkill('');
        }
    };

    const removeSkill = (itemId: string) => {
        removeSectionItem('skills', itemId);
    };

    const updatePersonalInfo = (field: keyof typeof basics, value: any) => {
        updateBasics({ [field]: value });
    };

    const handleAddExperience = () => {
        const newExp = {
            id: crypto.randomUUID(),
            hidden: false,
            title: 'New Position',
            company: 'Company Name',
            period: 'Present',
            description: 'Description of responsibilities...',
        };
        addSectionItem('experience', newExp);
        setExpandedSection('experience');
    };

    const handleAddEducation = () => {
        const newEdu = {
            id: crypto.randomUUID(),
            hidden: false,
            degree: 'Degree',
            school: 'University',
            period: 'Year'
        };
        addSectionItem('education', newEdu);
        setExpandedSection('education');
    };

    const downloadPDF = () => {
        // Basic PDF download - ideally this would render the selected template to PDF
        // For now, we'll keep the simple jsPDF implementation or later switch to html2canvas/jspdf
        // to screenshot the actual rendered template.
        // A robust solution is to print the specific component.

        const doc = new jsPDF({
            format: 'a4',
            unit: 'pt'
        });

        const margin = 50;
        let y = margin;

        // Header
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(basics.name, margin, y);
        y += 20;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(basics.headline, margin, y);
        y += 20;

        doc.setFontSize(10);
        doc.setTextColor(150);
        const contactInfo = [basics.email, basics.phone, basics.location, basics.website?.url].filter(Boolean).join(' | ');
        doc.text(contactInfo, margin, y);
        y += 30;

        doc.setTextColor(0);

        // Summary
        if (summary.content) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('SUMMARY', margin, y);
            y += 15;
            doc.line(margin, y - 5, 595 - margin, y - 5);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const plainSummary = summary.content.replace(/<[^>]*>?/gm, '');
            const splitSummary = doc.splitTextToSize(plainSummary, 595 - margin * 2);
            doc.text(splitSummary, margin, y);
            y += splitSummary.length * 12 + 15;
        }

        // Experience
        if (experience?.items?.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('EXPERIENCE', margin, y);
            y += 15;
            doc.line(margin, y - 5, 595 - margin, y - 5);

            experience.items.forEach((exp: any) => {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(exp.title || '', margin, y);
                doc.setFont('helvetica', 'normal');
                if (exp.period) doc.text(exp.period, 595 - margin - doc.getTextWidth(exp.period), y);
                y += 14;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.text(exp.company || '', margin, y);
                y += 14;

                doc.setFont('helvetica', 'normal');
                const descText = exp.description ? exp.description.replace(/<[^>]*>?/gm, '\n') : '';
                const lines = descText.split('\n').filter(Boolean);
                lines.forEach((desc: string) => {
                    const bullet = '• ' + desc.trim();
                    const splitDesc = doc.splitTextToSize(bullet, 595 - margin * 2 - 10);
                    doc.text(splitDesc, margin + 10, y);
                    y += splitDesc.length * 12;
                });
                y += 10;
            });
            y += 5;
        }

        // Education
        if (education?.items?.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('EDUCATION', margin, y);
            y += 15;
            doc.line(margin, y - 5, 595 - margin, y - 5);

            education.items.forEach((edu: any) => {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(edu.school || '', margin, y);
                doc.setFont('helvetica', 'normal');
                if (edu.period) doc.text(edu.period, 595 - margin - doc.getTextWidth(edu.period), y);
                y += 14;

                doc.setFontSize(10);
                doc.text(edu.degree || '', margin, y);
                y += 18;
            });
            y += 5;
        }

        // Skills
        if (skills?.items?.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('SKILLS', margin, y);
            y += 15;
            doc.line(margin, y - 5, 595 - margin, y - 5);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const skillNames = skills.items.map((s: any) => s.name);
            const skillText = skillNames.join(' • ');
            const splitSkills = doc.splitTextToSize(skillText, 595 - margin * 2);
            doc.text(splitSkills, margin, y);
        }

        doc.save(`${basics.name.replace(/\s+/g, '_')}_Resume.pdf`);
    };

    const aiGenerateResume = async () => {
        setAiLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-generate-resume', {
                body: { targetRole: basics.headline, tone: 'professional' }
            });
            if (error) throw error;
            if (data) {
                if (data.basics) updateBasics(data.basics);
                if (data.summary) setResumeData({ summary: { ...summary, ...data.summary } });

                if (data.sections) {
                    const newSections = { ...sections };
                    Object.keys(data.sections).forEach(key => {
                        if (newSections[key] && data.sections[key]) {
                            newSections[key] = { ...newSections[key], ...data.sections[key] };
                        }
                    });
                    setResumeData({ sections: newSections });
                }
            }
        } catch (e: any) {
            console.error('AI Generate Resume failed:', e);
            alert('Failed to generate resume. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };


    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-white dark:bg-[#0A0A0A]">
            {/* Header toolbar */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard/resume')}
                        className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Dashboard</span>
                    </button>
                    <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
                    <div className="flex items-center gap-2 group">
                        <input
                            value={resumeData.title || 'Untitled Resume'}
                            onChange={(e) => setResumeTitle(e.target.value)}
                            className="font-semibold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-1 focus:ring-[#1dff00] rounded px-1 min-w-[200px]"
                        />
                        <Edit2 className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsTemplateSelectorOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
                    >
                        <LayoutTemplate className="w-4 h-4" />
                        Templates
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1dff00] hover:bg-[#15bd00] text-black text-sm font-bold transition-all shadow-[0_0_15px_rgba(29,255,0,0.3)]">
                        <Sparkles className="w-4 h-4" />
                        AI Polish
                    </button>

                    <button
                        onClick={aiGenerateResume}
                        disabled={aiLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-white/10 border border-[#1dff00]/30 hover:bg-[#1dff00]/10 text-gray-700 dark:text-white text-sm font-bold transition-all"
                    >
                        <Wand2 className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                        {aiLoading ? 'Generating...' : 'AI Generate'}
                    </button>

                    <button
                        onClick={downloadPDF}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-sm font-medium transition-all text-gray-700 dark:text-white"
                    >
                        <Download className="w-4 h-4" />
                        Download PDF
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* Editor Panel (Left) */}
                <div className="w-[40%] min-w-[350px] max-w-[500px] bg-gray-50 dark:bg-[#0A0A0A] border-r border-gray-200 dark:border-white/10 flex flex-col overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Content</h3>
                            <div className="text-[10px] text-[#1dff00] flex items-center gap-1 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1dff00] animate-pulse" />
                                Auto-saved
                            </div>
                        </div>

                        {/* Personal Info Section */}
                        <div className={`bg-white/50 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden transition-all ${expandedSection === 'personal' ? 'ring-1 ring-[#1dff00]/50' : 'hover:border-[#1dff00]/30'}`}>
                            <div
                                className="p-5 flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSection('personal')}
                            >
                                <div className="flex items-center gap-3">
                                    <User className="w-5 h-5 text-[#1dff00]" />
                                    <h4 className="font-semibold text-gray-900 dark:text-white">Personal Info</h4>
                                </div>
                                {expandedSection === 'personal' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                            </div>

                            {expandedSection === 'personal' && (
                                <div className="p-5 pt-0 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
                                        <input
                                            type="text"
                                            value={basics.name}
                                            onChange={(e) => updatePersonalInfo('name', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Job Title</label>
                                        <input
                                            type="text"
                                            value={basics.headline}
                                            onChange={(e) => updatePersonalInfo('headline', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                                        <input
                                            type="email"
                                            value={basics.email}
                                            onChange={(e) => updatePersonalInfo('email', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone</label>
                                        <input
                                            type="text"
                                            value={basics.phone}
                                            onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Location</label>
                                        <input
                                            type="text"
                                            value={basics.location || ''}
                                            onChange={(e) => updatePersonalInfo('location', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Website</label>
                                        <input
                                            type="text"
                                            value={basics.website?.url || ''}
                                            onChange={(e) => updatePersonalInfo('website', { ...basics.website, url: e.target.value })}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Summary Section */}
                        <div className={`bg-white/50 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden transition-all ${expandedSection === 'summary' ? 'ring-1 ring-[#1dff00]/50' : 'hover:border-[#1dff00]/30'}`}>
                            <div
                                className="p-5 flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSection('summary')}
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-[#1dff00]" />
                                    <h4 className="font-semibold text-gray-900 dark:text-white">Summary</h4>
                                </div>
                                {expandedSection === 'summary' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                            </div>

                            {expandedSection === 'summary' && (
                                <div className="p-5 pt-0 animate-in slide-in-from-top-2 duration-200">
                                    <textarea
                                        value={summary.content || ''}
                                        onChange={(e) => setSummary(e.target.value)}
                                        rows={4}
                                        className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        placeholder="Brief professional summary..."
                                    />
                                </div>
                            )}
                        </div>

                        {/* Work Experience Section */}
                        <div className={`bg-white/50 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden transition-all ${expandedSection === 'experience' ? 'ring-1 ring-[#1dff00]/50' : 'hover:border-[#1dff00]/30'}`}>
                            <div
                                className="p-5 flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSection('experience')}
                            >
                                <div className="flex items-center gap-3">
                                    <Briefcase className="w-5 h-5 text-[#1dff00]" />
                                    <h4 className="font-semibold text-gray-900 dark:text-white">Work Experience</h4>
                                </div>
                                {expandedSection === 'experience' ? (
                                    <button
                                        className="text-xs bg-[#1dff00]/10 text-[#1dff00] px-2 py-1 rounded hover:bg-[#1dff00]/20 transition-colors flex items-center gap-1"
                                        onClick={(e) => { e.stopPropagation(); handleAddExperience(); }}
                                    >
                                        <Plus className="w-3 h-3" /> Add
                                    </button>
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                            </div>

                            {expandedSection === 'experience' && (
                                <div className="p-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    {experience.items.map((exp: any) => (
                                        <div key={exp.id} className="bg-gray-100 dark:bg-white/5 rounded-lg p-4 border border-gray-200 dark:border-white/5 relative group hover:border-[#1dff00]/30 transition-all">
                                            <div className="absolute right-3 top-3  flex gap-2">
                                                <button onClick={() => removeSectionItem('experience', exp.id)} className="p-1.5 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>

                                            <div className="space-y-3 pr-8">
                                                <input
                                                    value={exp.title}
                                                    onChange={(e) => updateSectionItem('experience', exp.id, { title: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-sm font-medium text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                                                    placeholder="Job Title"
                                                />
                                                <input
                                                    value={exp.company}
                                                    onChange={(e) => updateSectionItem('experience', exp.id, { company: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-xs text-gray-500 dark:text-gray-400 outline-none"
                                                    placeholder="Company"
                                                />
                                                <input
                                                    value={exp.period}
                                                    onChange={(e) => updateSectionItem('experience', exp.id, { period: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-xs text-gray-500 dark:text-gray-400 outline-none"
                                                    placeholder="Period (e.g., 2020 - Present)"
                                                />
                                                <textarea
                                                    value={exp.description}
                                                    onChange={(e) => updateSectionItem('experience', exp.id, { description: e.target.value })}
                                                    rows={3}
                                                    className="w-full bg-transparent border border-gray-200 dark:border-white/10 rounded p-2 text-xs text-gray-600 dark:text-gray-300 outline-none focus:border-[#1dff00]"
                                                    placeholder="Description (HTML supported)"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Education Section */}
                        <div className={`bg-white/50 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden transition-all ${expandedSection === 'education' ? 'ring-1 ring-[#1dff00]/50' : 'hover:border-[#1dff00]/30'}`}>
                            <div
                                className="p-5 flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSection('education')}
                            >
                                <div className="flex items-center gap-3">
                                    <GraduationCap className="w-5 h-5 text-[#1dff00]" />
                                    <h4 className="font-semibold text-gray-900 dark:text-white">Education</h4>
                                </div>
                                {expandedSection === 'education' ? (
                                    <button
                                        className="text-xs bg-[#1dff00]/10 text-[#1dff00] px-2 py-1 rounded hover:bg-[#1dff00]/20 transition-colors flex items-center gap-1"
                                        onClick={(e) => { e.stopPropagation(); handleAddEducation(); }}
                                    >
                                        <Plus className="w-3 h-3" /> Add
                                    </button>
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                            </div>

                            {expandedSection === 'education' && (
                                <div className="p-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    {education.items.map((edu: any) => (
                                        <div key={edu.id} className="bg-gray-100 dark:bg-white/5 rounded-lg p-4 border border-gray-200 dark:border-white/5 relative group hover:border-[#1dff00]/30 transition-all">
                                            <div className="absolute right-3 top-3 flex gap-2">
                                                <button onClick={() => removeSectionItem('education', edu.id)} className="p-1.5 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                            <div className="space-y-2 pr-8">
                                                <input
                                                    value={edu.degree}
                                                    onChange={(e) => updateSectionItem('education', edu.id, { degree: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-sm font-medium text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                                                    placeholder="Degree"
                                                />
                                                <input
                                                    value={edu.school}
                                                    onChange={(e) => updateSectionItem('education', edu.id, { school: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-sm text-gray-700 dark:text-gray-300 outline-none"
                                                    placeholder="School"
                                                />
                                                <input
                                                    value={edu.period}
                                                    onChange={(e) => updateSectionItem('education', edu.id, { period: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-xs text-gray-500 dark:text-gray-400 outline-none"
                                                    placeholder="Year"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Skills Section */}
                        <div className={`bg-white/50 dark:bg-white/[0.03] backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden transition-all ${expandedSection === 'skills' ? 'ring-1 ring-[#1dff00]/50' : 'hover:border-[#1dff00]/30'}`}>
                            <div
                                className="p-5 flex items-center justify-between cursor-pointer"
                                onClick={() => toggleSection('skills')}
                            >
                                <div className="flex items-center gap-3">
                                    <BrainCircuit className="w-5 h-5 text-[#1dff00]" />
                                    <h4 className="font-semibold text-gray-900 dark:text-white">Skills</h4>
                                </div>
                                {expandedSection === 'skills' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                            </div>

                            {expandedSection === 'skills' && (
                                <div className="p-5 pt-0 animate-in slide-in-from-top-2 duration-200">
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {skills.items.map((skill: any) => (
                                            <span key={skill.id} className="px-2.5 py-1.5 bg-gray-100 dark:bg-white/10 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/5 flex items-center gap-1.5 group">
                                                {skill.name}
                                                <X
                                                    className="w-3 h-3 text-gray-400 group-hover:text-red-400 cursor-pointer transition-colors"
                                                    onClick={() => removeSkill(skill.id)}
                                                />
                                            </span>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={newSkill}
                                        onChange={(e) => setNewSkill(e.target.value)}
                                        onKeyDown={handleSkillAdd}
                                        placeholder="Type a skill and press Enter..."
                                        className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 px-0 py-2 text-sm focus:border-[#1dff00] outline-none transition-colors text-gray-900 dark:text-gray-100 placeholder:text-gray-500"
                                    />
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* Preview Panel (Right) */}
                <div className="flex-1 bg-gray-200 dark:bg-[#0A0A0A] overflow-y-auto flex justify-center p-8 relative custom-scrollbar">

                    {/* Zoom Controls */}
                    <div className="fixed top-24 right-8 z-10 flex flex-col gap-2">
                        <button
                            onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))}
                            className="w-10 h-10 bg-white dark:bg-[#121212] rounded-full shadow-xl flex items-center justify-center text-gray-500 hover:text-[#1dff00] transition-colors border border-gray-200 dark:border-white/10"
                        >
                            <ZoomIn className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
                            className="w-10 h-10 bg-white dark:bg-[#121212] rounded-full shadow-xl flex items-center justify-center text-gray-500 hover:text-[#1dff00] transition-colors border border-gray-200 dark:border-white/10"
                        >
                            <ZoomOut className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Resume Paper */}
                    <div
                        className="bg-white shadow-2xl origin-top transition-transform duration-200 min-h-[1123px] w-[794px]"
                        style={{ transform: `scale(${zoom})`, marginBottom: `${(zoom - 1) * 1123}px` }}
                    >
                        {selectedTemplate === 'azurill' && <AzurillTemplate />}
                        {selectedTemplate === 'onyx' && <OnyxTemplate />}
                        {selectedTemplate === 'bronzor' && <BronzorTemplate />}
                    </div>
                </div>
            </div>
            <TemplateSelector isOpen={isTemplateSelectorOpen} onClose={() => setIsTemplateSelectorOpen(false)} />
        </div>
    );
};
