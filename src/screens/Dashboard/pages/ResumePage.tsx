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
    Mail,
    Phone,
    MapPin,
    FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useArtboardStore, WorkExperience, Education } from '../../../store/artboard';
import { createClient } from '../../../lib/supabaseClient';
import jsPDF from 'jspdf';

export const ResumePage = () => {
    const navigate = useNavigate();
    const [zoom, setZoom] = useState(1);
    const [aiLoading, setAiLoading] = useState(false);
    const supabase = createClient();

    // Global State
    const resume = useArtboardStore((state) => state.resume);
    const setResumeSection = useArtboardStore((state) => state.setResumeSection);
    const setResume = useArtboardStore((state) => state.setResume);
    const addExperience = useArtboardStore((state) => state.addExperience);
    const updateExperience = useArtboardStore((state) => state.updateExperience);
    const removeExperience = useArtboardStore((state) => state.removeExperience);
    const addEducation = useArtboardStore((state) => state.addEducation);
    const updateEducation = useArtboardStore((state) => state.updateEducation);
    const removeEducation = useArtboardStore((state) => state.removeEducation);
    const setSummary = (val: string) => setResumeSection('summary', val);

    // Destructure for easier access
    const { personalInfo, experience, education, skills, summary } = resume;

    // Local UI State
    const [newSkill, setNewSkill] = useState('');
    const [expandedSection, setExpandedSection] = useState<string | null>('personal');

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const handleSkillAdd = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && newSkill.trim()) {
            setResumeSection('skills', [...skills, newSkill.trim()]);
            setNewSkill('');
        }
    };

    const removeSkill = (skillToRemove: string) => {
        setResumeSection('skills', skills.filter(skill => skill !== skillToRemove));
    };

    const updatePersonalInfo = (field: keyof typeof personalInfo, value: string) => {
        setResumeSection('personalInfo', { ...personalInfo, [field]: value });
    };

    const handleAddExperience = () => {
        const newExp: WorkExperience = {
            id: crypto.randomUUID(),
            title: 'New Position',
            company: 'Company Name',
            period: 'Present',
            description: ['Description of responsibilities...']
        };
        addExperience(newExp);
        // Automatically expand the new item logic could go here, but for now just adding it.
    };

    const handleAddEducation = () => {
        const newEdu: Education = {
            id: crypto.randomUUID(),
            degree: 'Degree',
            school: 'University',
            period: 'Year'
        };
        addEducation(newEdu);
    };

    const downloadPDF = () => {
        const doc = new jsPDF({
            format: 'a4',
            unit: 'pt'
        });

        const margin = 50;
        let y = margin;

        // Header
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(personalInfo.fullName, margin, y);
        y += 20;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(personalInfo.jobTitle, margin, y);
        y += 20;

        doc.setFontSize(10);
        doc.setTextColor(150);
        const contactInfo = [personalInfo.email, personalInfo.phone, personalInfo.location, personalInfo.website].filter(Boolean).join(' | ');
        doc.text(contactInfo, margin, y);
        y += 30;

        doc.setTextColor(0);

        // Summary
        if (summary) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('SUMMARY', margin, y);
            y += 15;
            doc.line(margin, y - 5, 595 - margin, y - 5);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const splitSummary = doc.splitTextToSize(summary, 595 - margin * 2);
            doc.text(splitSummary, margin, y);
            y += splitSummary.length * 12 + 15;
        }

        // Experience
        if (experience.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('EXPERIENCE', margin, y);
            y += 15;
            doc.line(margin, y - 5, 595 - margin, y - 5);

            experience.forEach(exp => {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(exp.title, margin, y);
                doc.setFont('helvetica', 'normal');
                doc.text(exp.period, 595 - margin - doc.getTextWidth(exp.period), y);
                y += 14;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.text(exp.company, margin, y);
                y += 14;

                doc.setFont('helvetica', 'normal');
                exp.description.forEach(desc => {
                    const bullet = '• ' + desc;
                    const splitDesc = doc.splitTextToSize(bullet, 595 - margin * 2 - 10);
                    doc.text(splitDesc, margin + 10, y);
                    y += splitDesc.length * 12;
                });
                y += 10;
            });
            y += 5;
        }

        // Education
        if (education.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('EDUCATION', margin, y);
            y += 15;
            doc.line(margin, y - 5, 595 - margin, y - 5);

            education.forEach(edu => {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(edu.school, margin, y);
                doc.setFont('helvetica', 'normal');
                doc.text(edu.period, 595 - margin - doc.getTextWidth(edu.period), y);
                y += 14;

                doc.setFontSize(10);
                doc.text(edu.degree, margin, y);
                y += 18;
            });
            y += 5;
        }

        // Skills
        if (skills.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('SKILLS', margin, y);
            y += 15;
            doc.line(margin, y - 5, 595 - margin, y - 5);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const skillText = skills.join(' • ');
            const splitSkills = doc.splitTextToSize(skillText, 595 - margin * 2);
            doc.text(splitSkills, margin, y);
        }

        doc.save(`${personalInfo.fullName.replace(/\s+/g, '_')}_Resume.pdf`);
    };

    const aiGenerateResume = async () => {
        setAiLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-generate-resume', {
                body: { targetRole: personalInfo.jobTitle, tone: 'professional' }
            });
            if (error) throw error;
            if (data) {
                // Update the store with generated data
                if (data.personalInfo) {
                    setResumeSection('personalInfo', {
                        ...personalInfo,
                        ...data.personalInfo
                    });
                }
                if (data.summary) {
                    setResumeSection('summary', data.summary);
                }
                if (Array.isArray(data.experience)) {
                    setResumeSection('experience', data.experience);
                }
                if (Array.isArray(data.education)) {
                    setResumeSection('education', data.education);
                }
                if (Array.isArray(data.skills)) {
                    setResumeSection('skills', data.skills);
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
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Dashboard</span>
                    </button>
                    <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
                    <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-gray-900 dark:text-white">Software Engineer Resume</h2>
                        <Edit2 className="w-3.5 h-3.5 text-gray-400 hover:text-white cursor-pointer" />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-medium transition-colors text-gray-700 dark:text-gray-300">
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
                                            value={personalInfo.fullName}
                                            onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Job Title</label>
                                        <input
                                            type="text"
                                            value={personalInfo.jobTitle}
                                            onChange={(e) => updatePersonalInfo('jobTitle', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                                        <input
                                            type="email"
                                            value={personalInfo.email}
                                            onChange={(e) => updatePersonalInfo('email', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone</label>
                                        <input
                                            type="text"
                                            value={personalInfo.phone}
                                            onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Location</label>
                                        <input
                                            type="text"
                                            value={personalInfo.location || ''}
                                            onChange={(e) => updatePersonalInfo('location', e.target.value)}
                                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] focus:ring-1 focus:ring-[#1dff00] outline-none transition-all text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Website</label>
                                        <input
                                            type="text"
                                            value={personalInfo.website || ''}
                                            onChange={(e) => updatePersonalInfo('website', e.target.value)}
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
                                        value={summary || ''}
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
                                    {experience.map((exp) => (
                                        <div key={exp.id} className="bg-gray-100 dark:bg-white/5 rounded-lg p-4 border border-gray-200 dark:border-white/5 relative group hover:border-[#1dff00]/30 transition-all">
                                            <div className="absolute right-3 top-3  flex gap-2">
                                                <button onClick={() => removeExperience(exp.id)} className="p-1.5 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>

                                            <div className="space-y-3 pr-8">
                                                <input
                                                    value={exp.title}
                                                    onChange={(e) => updateExperience(exp.id, { title: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-sm font-medium text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                                                    placeholder="Job Title"
                                                />
                                                <input
                                                    value={exp.company}
                                                    onChange={(e) => updateExperience(exp.id, { company: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-xs text-gray-500 dark:text-gray-400 outline-none"
                                                    placeholder="Company"
                                                />
                                                <input
                                                    value={exp.period}
                                                    onChange={(e) => updateExperience(exp.id, { period: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-xs text-gray-500 dark:text-gray-400 outline-none"
                                                    placeholder="Period (e.g., 2020 - Present)"
                                                />
                                                <textarea
                                                    value={exp.description.join('\n')}
                                                    onChange={(e) => updateExperience(exp.id, { description: e.target.value.split('\n') })}
                                                    rows={3}
                                                    className="w-full bg-transparent border border-gray-200 dark:border-white/10 rounded p-2 text-xs text-gray-600 dark:text-gray-300 outline-none focus:border-[#1dff00]"
                                                    placeholder="Description (one per line)"
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
                                    {education.map((edu) => (
                                        <div key={edu.id} className="bg-gray-100 dark:bg-white/5 rounded-lg p-4 border border-gray-200 dark:border-white/5 relative group hover:border-[#1dff00]/30 transition-all">
                                            <div className="absolute right-3 top-3 flex gap-2">
                                                <button onClick={() => removeEducation(edu.id)} className="p-1.5 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                            <div className="space-y-2 pr-8">
                                                <input
                                                    value={edu.degree}
                                                    onChange={(e) => updateEducation(edu.id, { degree: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-sm font-medium text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                                                    placeholder="Degree"
                                                />
                                                <input
                                                    value={edu.school}
                                                    onChange={(e) => updateEducation(edu.id, { school: e.target.value })}
                                                    className="w-full bg-transparent border-b border-transparent focus:border-[#1dff00] text-sm text-gray-700 dark:text-gray-300 outline-none"
                                                    placeholder="School"
                                                />
                                                <input
                                                    value={edu.period}
                                                    onChange={(e) => updateEducation(edu.id, { period: e.target.value })}
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
                                        {skills.map((skill) => (
                                            <span key={skill} className="px-2.5 py-1.5 bg-gray-100 dark:bg-white/10 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/5 flex items-center gap-1.5 group">
                                                {skill}
                                                <X
                                                    className="w-3 h-3 text-gray-400 group-hover:text-red-400 cursor-pointer transition-colors"
                                                    onClick={() => removeSkill(skill)}
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
                        <div className="p-12 text-gray-800 h-full flex flex-col gap-8">

                            {/* Header */}
                            <div className="border-b-2 border-gray-900 pb-6">
                                <h1 className="text-4xl font-bold uppercase tracking-tight text-gray-900 mb-2">{personalInfo.fullName}</h1>
                                <p className="text-lg font-medium text-gray-600 mb-4">{personalInfo.jobTitle}</p>
                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {personalInfo.email}</span>
                                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {personalInfo.phone}</span>
                                    {personalInfo.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {personalInfo.location}</span>}
                                    {personalInfo.website && <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {personalInfo.website}</span>}
                                </div>
                            </div>

                            {/* Optional Summary Display */}
                            {summary && (
                                <section>
                                    <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1 text-sm">Summary</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
                                </section>
                            )}

                            <div className="flex gap-8 flex-1">
                                {/* Left Column */}
                                <div className="flex-[3] space-y-8">
                                    {/* Experience */}
                                    <section>
                                        <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-1 text-sm">Experience</h3>
                                        <div className="space-y-6">
                                            {experience.map(exp => (
                                                <div key={exp.id}>
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <h4 className="font-bold text-gray-800 text-base">{exp.title}</h4>
                                                        <span className="text-sm text-gray-500 font-medium">{exp.period}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-gray-700 mb-2">{exp.company}</p>
                                                    <ul className="list-disc list-outside ml-4 text-sm text-gray-600 space-y-1.5 leading-relaxed">
                                                        {exp.description.map((desc, i) => (
                                                            <li key={i}>{desc}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                {/* Right Column */}
                                <div className="flex-[1.5] space-y-8">
                                    {/* Education */}
                                    <section>
                                        <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-1 text-sm">Education</h3>
                                        <div className="space-y-4">
                                            {education.map(edu => (
                                                <div key={edu.id}>
                                                    <h4 className="font-bold text-gray-800 text-sm">{edu.degree}</h4>
                                                    <p className="text-sm text-gray-700 mt-0.5">{edu.school}</p>
                                                    <p className="text-xs text-gray-500 mt-1">{edu.period}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Skills */}
                                    <section>
                                        <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-1 text-sm">Skills</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {skills.map((skill) => (
                                                <span key={skill} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium border border-gray-200">
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
