import { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Download,
    Wand2,
    Share2,
    Printer,
    FileText,

    Plus,
    Minus,
    Trash2,
    ArrowUp,
    ArrowDown,
    X,
    Lock,
    FileType,
    Edit2,
    Menu,
    Eye,
    Sparkles
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
// Fix Supabase import
import { createClient } from '@/lib/supabaseClient';
// Fix Toast import (use local shadcn/ui toast instead of sonner)
import { useToast } from '@/components/ui/toast';
// Fix Store import
import { useArtboardStore } from '@/store/artboard';
// Local PDF/Docx generation imports (assuming these pkgs exist or mocks handle them)
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { useProfileSettings } from '@/hooks/useProfileSettings';

const supabase = createClient();

// Local implementation of saveAs to avoid missing 'file-saver' types/dependency
const saveAs = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const CoverLetterBuilderPage = () => {
    const navigate = useNavigate();
    const { success, error: toastErrorFn } = useToast();

    // Helper for toasts to match previous API slightly
    const toastError = (title: string, desc: string) => toastErrorFn(title, desc);
    const toastSuccess = (title: string, desc: string) => success(title, desc);

    // Global State
    const coverLetter = useArtboardStore((state) => state.coverLetter);
    const setCoverLetter = useArtboardStore((state) => state.setCoverLetter);
    const setCoverLetterField = useArtboardStore((state) => state.setCoverLetterField);
    const setNested = useArtboardStore((state) => state.setCoverLetterNested);
    const setCoverLetterTitle = useArtboardStore((state) => state.setCoverLetterTitle);
    const setCoverLetterId = useArtboardStore((state) => state.setCoverLetterId);

    // Destructure for easier access
    const {
        id, role, company, jobDescription, tone, lengthPref,
        sender, recipient, content, typography
    } = coverLetter;

    // Helper setters
    const setRole = (val: string) => setCoverLetterField('role', val);
    const setCompany = (val: string) => setCoverLetterField('company', val);
    const setJobDescription = (val: string) => setCoverLetterField('jobDescription', val);
    const setTone = (val: any) => setCoverLetterField('tone', val);
    const setLengthPref = (val: any) => setCoverLetterField('lengthPref', val);

    const setSenderName = (val: string) => setNested('sender', 'name', val);
    const setSenderEmail = (val: string) => setNested('sender', 'email', val);
    const setSenderPhone = (val: string) => setNested('sender', 'phone', val);
    const setSenderAddress = (val: string) => setNested('sender', 'address', val);

    const setRecipientName = (val: string) => setNested('recipient', 'name', val);
    const setRecipientTitle = (val: string) => setNested('recipient', 'title', val);

    const setRecipientAddress = (val: string) => setNested('recipient', 'address', val);

    const setDate = (val: string) => setNested('content', 'date', val);
    const setSubject = (val: string) => setNested('content', 'subject', val);
    const setSalutation = (val: string) => setNested('content', 'salutation', val);
    const setParagraphs = (val: string[]) => setNested('content', 'paragraphs', val);
    const setClosing = (val: string) => setNested('content', 'closing', val);
    const setSignatureName = (val: string) => setNested('content', 'signature', val);
    const setContentString = (val: string) => setNested('content', 'rawBody', val);

    const setFontSize = (val: number) => setNested('typography', 'fontSize', val);


    // Local UI State

    const [aiLoading, setAiLoading] = useState(false);
    // Remove unused savedAt if not used, or use it 
    // const [savedAt, setSavedAt] = useState<string | null>(null); 
    const [subscriptionTier, setSubscriptionTier] = useState<string>('Free');
    const [exportOpen, setExportOpen] = useState(false);
    const [exportBusy, setExportBusy] = useState<string | null>(null);
    // Remove unused lastExport
    // const [lastExport, setLastExport] = useState<string | null>(null);
    // Remove unused copied
    // const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const { id: routeId } = useParams();

    // Derived
    const finalBody = content.paragraphs.length ? content.paragraphs.join('\n\n') : content.rawBody;

    // --- Effects ---

    // Load Initial Data
    useEffect(() => {
        const loadData = async () => {
            if (!routeId) return;

            try {
                const { data, error } = await supabase
                    .from('cover_letters')
                    .select('*')
                    .eq('id', routeId)
                    .single();

                if (error) throw error;
                if (data) {
                    // Populate store
                    setCoverLetterId(data.id);
                    setCoverLetterTitle(data.name);

                    if (data.data) {
                        setCoverLetter(data.data);
                    }
                }
            } catch (error) {
                console.error('Error loading cover letter:', error);
                toastError('Load failed', 'Could not load cover letter');
                navigate('/dashboard/cover-letter');
            }
        };
        loadData();
    }, [routeId]);

    // Profile Data for Auto-population
    const { profile } = useProfileSettings();
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.email) setUserEmail(data.user.email);
        });
    }, []);

    // Auto-populate
    useEffect(() => {
        if (!id && !sender.name && profile) {
            const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
            if (name) setSenderName(name);
            if (profile.phone) setSenderPhone(profile.phone);
            if (profile.location) setSenderAddress(profile.location);
            if (userEmail) setSenderEmail(userEmail);
            if (profile.job_title) setRole(profile.job_title);
        }
    }, [profile, id, userEmail]);

    // Save Function
    const handleSave = async () => {
        if (!id) return;
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const letterData = {
                title: coverLetter.title,
                role, company, jobDescription, tone, lengthPref,
                sender, recipient, content, typography
            };

            const { error } = await supabase
                .from('cover_letters')
                .update({
                    name: coverLetter.title,
                    data: letterData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            if (error) throw error;
        } catch (error) {
            console.error('Save failed:', error);
            toastError('Save failed', 'Could not save changes');
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-save
    useEffect(() => {
        if (!id) return;

        const timeout = setTimeout(() => {
            handleSave();
        }, 2000);

        return () => clearTimeout(timeout);
    }, [coverLetter, id]); // Deep dependency might trigger too often, strictly relying on debounce

    // Check subscription
    useEffect(() => {
        const checkSub = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('subscription_tier')
                    .eq('id', user.id)
                    .single();
                if (data) setSubscriptionTier(data.subscription_tier || 'Free');
            }
        };
        checkSub();
    }, []);

    // Helper: Serialize for export/copy
    const serializeLetter = () => {
        const parts = [];
        // Sender
        if (sender.name) parts.push(sender.name);
        if (sender.email) parts.push(sender.email);
        if (sender.phone) parts.push(sender.phone);
        if (sender.address) parts.push(sender.address);
        if (parts.length) parts.push('');

        // Date
        if (content.date) {
            parts.push(new Date(content.date).toLocaleDateString());
            parts.push('');
        }

        // Recipient
        if (recipient.name) parts.push(recipient.name);
        if (recipient.title) parts.push(recipient.title);
        // Uses global company for recipient company usually
        if (company) parts.push(company);
        if (recipient.address) parts.push(recipient.address);
        if (parts.length > 0 && parts[parts.length - 1] !== '') parts.push('');

        // Subject
        if (content.subject) {
            parts.push(`Subject: ${content.subject}`);
            parts.push('');
        }

        // Salutation
        if (content.salutation) {
            parts.push(content.salutation);
            parts.push('');
        }

        // Body
        parts.push(finalBody);
        parts.push('');

        // Closing
        if (content.closing) parts.push(content.closing);
        if (content.signature) parts.push(content.signature);

        return parts.join('\n');
    };

    // --- Actions ---



    const loadProfile = async () => {
        try {
            if (!profile) {
                toastError('Profile not loaded', 'Please wait for profile data to load.');
                return;
            }

            const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
            if (name) {
                setSenderName(name);
                if (!content.signature) setSignatureName(name);
            }
            if (profile.phone) setSenderPhone(profile.phone);
            if (userEmail) setSenderEmail(userEmail);
            if (profile.location) setSenderAddress(profile.location);
            if (profile.job_title) setRole(profile.job_title);
            toastSuccess('Profile loaded', 'Filled details from your profile');
        } catch (e: any) {
            console.error(e);
            toastError('Profile load failed', e?.message);
        }
    };

    const aiPolish = async () => {
        if (!finalBody.trim()) return toastError('Empty content', 'Write something first.');
        setAiLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-polish-cover-letter', {
                body: { content: finalBody, tone }
            });
            if (error) throw error;
            if (data?.polished) {
                setParagraphs([]);
                setContentString(data.polished);
                toastSuccess('Polished!', 'Your cover letter has been refined.');
            }
        } catch (e: any) {
            console.error(e);
            toastError('AI failed', e?.message);
        } finally {
            setAiLoading(false);
        }
    };

    const aiWriteFull = async () => {
        if (!role || !company) return toastError('Missing info', 'Role and Company are required.');
        setAiLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-generate-cover-letter', {
                body: { role, company, jobDescription, tone, lengthRef: lengthPref, senderName: sender.name }
            });
            if (error) throw error;
            if (data?.content) {
                const txt = data.content as string;
                setParagraphs([]);
                setContentString(txt);
                toastSuccess('Generated!', 'Draft created.');
            }
        } catch (e: any) {
            console.error(e);
            toastError('AI failed', e?.message);
        } finally {
            setAiLoading(false);
        }
    };

    // --- Exports ---
    const exportTxt = () => {
        const blob = new Blob([serializeLetter()], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `Cover_Letter_${company.replace(/\s+/g, '_')}.txt`);
        // setLastExport('txt');
    };

    const exportPdf = async () => {
        setExportBusy('pdf');
        try {
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const margin = 72;
            const top = 72;
            const width = 595 - margin * 2;

            doc.setFontSize(typography.fontSize);
            doc.setFont('times', 'normal');

            const text = serializeLetter();
            const lines = doc.splitTextToSize(text, width);
            doc.text(lines, margin, top);

            doc.save(`Cover_Letter_${company}.pdf`);
            // setLastExport('pdf');
        } catch (e) {
            console.error(e);
            toastError('Export failed', 'PDF generation error');
        } finally {
            setExportBusy(null);
        }
    };

    const exportDocx = async () => {
        setExportBusy('docx');
        try {
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: serializeLetter().split('\n').map(line =>
                        new Paragraph({
                            children: [new TextRun(line)],
                            spacing: { after: 120 }
                        })
                    )
                }]
            });
            const blob = await Packer.toBlob(doc);
            saveAs(blob, `Cover_Letter_${company}.docx`);
            // setLastExport('docx');
        } catch (e) {
            console.error(e);
            toastError('Export failed', 'DOCX generation error');
        } finally {
            setExportBusy(null);
        }
    };

    const printLetter = () => {
        const win = window.open('', '', 'width=800,height=900');
        if (!win) return;
        win.document.write(`<html><head><title>Print Cover Letter</title><style>body{font-family:serif;white-space:pre-wrap;margin:40px;font-size:${typography.fontSize}px;}</style></head><body>${serializeLetter()}</body></html>`);
        win.document.close();
        win.focus();
        win.print();
        win.close();
    };

    const copyPlain = async () => {
        try {
            await navigator.clipboard.writeText(serializeLetter());
            // setCopied(true);
            // setTimeout(() => setCopied(false), 2000);
            toastSuccess('Copied', 'Ready to paste.');
        } catch {
            toastError('Copy failed', 'Access denied.');
        }
    };

    const share = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: `Cover Letter - ${company}`, text: serializeLetter() });
            } catch (e) { console.error(e); }
        } else {
            copyPlain();
        }
    };

    const clearDraft = () => {
        if (confirm('Are you sure you want to clear all fields?')) {
            setRole('');
            setCompany('');
            setNested('sender', 'name', '');
            setNested('sender', 'email', '');
            setNested('sender', 'phone', '');
            setNested('sender', 'address', '');
            setNested('recipient', 'name', '');
            setNested('recipient', 'title', '');
            setNested('recipient', 'address', '');
            setNested('content', 'subject', '');
            setNested('content', 'rawBody', '');
            setNested('content', 'paragraphs', []);
            setNested('content', 'closing', 'Best regards,');
        }
    };

    // --- Formatting Helpers ---
    const addParagraph = () => setParagraphs([...content.paragraphs, '']);
    const updateParagraph = (idx: number, val: string) => {
        const next = [...content.paragraphs];
        next[idx] = val;
        setParagraphs(next);
    };
    const removeParagraph = (idx: number) => setParagraphs(content.paragraphs.filter((_, i) => i !== idx));
    const moveParagraphUp = (idx: number) => {
        if (idx <= 0) return;
        const next = [...content.paragraphs];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        setParagraphs(next);
    };
    const moveParagraphDown = (idx: number) => {
        if (idx >= content.paragraphs.length - 1) return;
        const next = [...content.paragraphs];
        [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
        setParagraphs(next);
    };
    const splitContentString = () => {
        const parts = content.rawBody.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
        if (parts.length) {
            setParagraphs(parts);
            setContentString('');
            toastSuccess('Split', 'Content split into paragraphs.');
        }
    };
    const zoomIn = () => setFontSize(Math.min(typography.fontSize + 1, 24));
    const zoomOut = () => setFontSize(Math.max(typography.fontSize - 1, 10));

    // --- Render ---
    return (
        <div id="cover-page-root" className="relative flex min-h-[calc(100vh-4rem)] flex-col gap-6 px-4 sm:px-6 lg:px-8 py-6">
            {/* Ambient Background Glows */}
            <div className="fixed top-20 right-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-30 pointer-events-none -z-10" />
            <div className="fixed bottom-20 left-0 h-96 w-96 bg-[#1dff00]/5 rounded-full blur-3xl opacity-20 pointer-events-none -z-10" />

            {/* Header toolbar */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard/cover-letter')}
                        className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                    <div className="h-6 w-px bg-gray-200 dark:bg-white/10" />
                    <div className="flex items-center gap-2 group">
                        <input
                            value={coverLetter.title || 'Untitled Cover Letter'}
                            onChange={(e) => setCoverLetterTitle(e.target.value)}
                            className="font-semibold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-1 focus:ring-[#1dff00] rounded px-1 min-w-[200px]"
                        />
                        <Edit2 className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>

                {/* Desktop Toolbar */}
                <div className="hidden md:flex items-center gap-3">
                    <button
                        onClick={share}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
                    >
                        <Share2 className="w-4 h-4" />
                        Share
                    </button>

                    <button
                        onClick={aiPolish}
                        disabled={aiLoading || subscriptionTier === 'Free'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1dff00] hover:bg-[#15bd00] text-black text-sm font-bold transition-all shadow-[0_0_15px_rgba(29,255,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles className="w-4 h-4" />
                        {aiLoading ? 'Polishing...' : 'AI Polish'}
                        {subscriptionTier === 'Free' && <Lock className="ml-2 w-3 h-3 opacity-50" />}
                    </button>

                    <button
                        onClick={aiWriteFull}
                        disabled={aiLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-white/10 border border-[#1dff00]/30 hover:bg-[#1dff00]/10 text-gray-700 dark:text-white text-sm font-bold transition-all"
                    >
                        <Wand2 className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                        {aiLoading ? 'Generating...' : 'AI Generate'}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={isSaving || !routeId}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-white/10 border border-brand/50 hover:bg-brand/10 text-gray-700 dark:text-white text-sm font-bold transition-all disabled:opacity-50"
                    >
                        <FileText className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>

                    <button
                        onClick={() => setExportOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-sm font-medium transition-all text-gray-700 dark:text-white"
                    >
                        <Download className="w-4 h-4" />
                        Download
                    </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden p-2 text-gray-500"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    <Menu className="w-6 h-6" />
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            {
                mobileMenuOpen && (
                    <div className="absolute top-16 left-0 right-0 bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-white/10 p-4 z-50 md:hidden flex flex-col gap-3 shadow-xl">
                        <button
                            onClick={() => { share(); setMobileMenuOpen(false); }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-sm font-medium transition-colors text-gray-700 dark:text-gray-300"
                        >
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>

                        <button
                            onClick={aiPolish}
                            disabled={aiLoading || subscriptionTier === 'Free'}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1dff00] hover:bg-[#15bd00] text-black text-sm font-bold transition-all"
                        >
                            <Sparkles className="w-4 h-4" />
                            AI Polish
                        </button>

                        <button
                            onClick={aiWriteFull}
                            disabled={aiLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-white/10 border border-[#1dff00]/30 hover:bg-[#1dff00]/10 text-gray-700 dark:text-white text-sm font-bold transition-all"
                        >
                            <Wand2 className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                            {aiLoading ? 'Generating...' : 'AI Generate'}
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving || !routeId}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-white/10 border border-brand/50 hover:bg-brand/10 text-gray-700 dark:text-white text-sm font-bold transition-all disabled:opacity-50"
                        >
                            <FileText className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>

                        <button
                            onClick={() => { setExportOpen(true); setMobileMenuOpen(false); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/20 text-sm font-medium transition-all text-gray-700 dark:text-white"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                    </div>
                )
            }

            {/* Mobile Tab Bar */}
            <div className="xl:hidden flex border-b border-[#1dff00]/30 bg-black/20 shrink-0 mb-4 rounded-xl overflow-hidden">
                <button
                    onClick={() => setActiveTab('editor')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'editor' ? 'bg-[#1dff00]/20 text-[#1dff00]' : 'text-gray-400 hover:text-white'}`}
                >
                    <Edit2 className="w-4 h-4" /> Editor
                </button>
                <button
                    onClick={() => setActiveTab('preview')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'preview' ? 'bg-[#1dff00]/20 text-[#1dff00]' : 'text-gray-400 hover:text-white'}`}
                >
                    <Eye className="w-4 h-4" /> Preview
                </button>
            </div>

            {/* Main Layout */}
            < div id="cover-main-layout" className="grid gap-6 grid-cols-1 xl:grid-cols-[460px_minmax(0,1fr)] max-w-[1800px] mx-auto w-full" >

                {/* CONFIG PANEL (LEFT) */}
                < Card className={`p-6 rounded-2xl bg-gradient-to-br from-[#0a0a0a]/98 to-[#0f0f0f]/98 border border-[#1dff00]/30 backdrop-blur-xl ${activeTab === 'editor' ? 'block' : 'hidden'} xl:block`}>
                    <div className="grid gap-6">


                        {/* Sender */}
                        <div className="grid gap-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-semibold text-white">Sender Info</label>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={loadProfile} className="h-7 text-xs">Use Profile</Button>
                                    <Button size="sm" variant="outline" onClick={() => { setSenderName(''); setSenderEmail(''); setSenderPhone(''); setSenderAddress(''); }} className="h-7 text-xs">Clear</Button>
                                </div>
                            </div>
                            <input value={sender.name} onChange={e => setSenderName(e.target.value)} placeholder="Name" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                            <div className="grid grid-cols-2 gap-3">
                                <input value={sender.email} onChange={e => setSenderEmail(e.target.value)} placeholder="Email" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                                <input value={sender.phone} onChange={e => setSenderPhone(e.target.value)} placeholder="Phone" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                            </div>
                            <input value={sender.address} onChange={e => setSenderAddress(e.target.value)} placeholder="Address" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                        </div>

                        {/* Recipient */}
                        <div className="grid gap-3">
                            <label className="text-sm font-semibold text-white">Recipient Info</label>
                            <div className="grid grid-cols-2 gap-3">
                                <input value={recipient.name} onChange={e => setRecipientName(e.target.value)} placeholder="Name" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                                <input value={recipient.title} onChange={e => setRecipientTitle(e.target.value)} placeholder="Title" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                                <input value={recipient.address} onChange={e => setRecipientAddress(e.target.value)} placeholder="Address" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                            </div>
                        </div>

                        {/* Letter Details */}
                        <div className="grid gap-3">
                            <label className="text-sm font-semibold text-white">Details</label>
                            <div className="grid grid-cols-2 gap-3">
                                <input type="date" value={content.date} onChange={e => setDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                                <input value={content.subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                            </div>
                            <input value={content.salutation} onChange={e => setSalutation(e.target.value)} placeholder="Salutation" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                            <div className="grid grid-cols-2 gap-3">
                                <select value={tone} onChange={e => setTone(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none">
                                    <option value="professional">Professional</option>
                                    <option value="friendly">Friendly</option>
                                    <option value="enthusiastic">Enthusiastic</option>
                                </select>
                                <select value={lengthPref} onChange={e => setLengthPref(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none">
                                    <option value="short">Short</option>
                                    <option value="medium">Medium</option>
                                    <option value="long">Long</option>
                                </select>
                            </div>
                        </div>

                        {/* Body / Content */}
                        <div className="grid gap-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-semibold text-white">Body</label>
                                <Button size="sm" variant="ghost" onClick={splitContentString} className="h-6 text-xs text-[#1dff00]">Split to Paragraphs</Button>
                            </div>
                            {/* Raw Body Editor */}
                            <textarea
                                value={content.rawBody}
                                onChange={e => setContentString(e.target.value)}
                                rows={6}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none"
                                placeholder="Raw content..."
                            />

                            {/* Paragraphs Editor */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400">Paragraphs ({content.paragraphs.length})</span>
                                    <Button size="sm" variant="ghost" onClick={addParagraph} className="h-6 text-xs"><Plus className="w-3 h-3" /></Button>
                                </div>
                                {content.paragraphs.map((p, idx) => (
                                    <div key={idx} className="relative group">
                                        <textarea
                                            value={p}
                                            onChange={e => updateParagraph(idx, e.target.value)}
                                            rows={3}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#1dff00] outline-none"
                                        />
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 bg-black/50 rounded">
                                            <button onClick={() => moveParagraphUp(idx)} className="p-1 hover:text-[#1dff00]"><ArrowUp className="w-3 h-3" /></button>
                                            <button onClick={() => moveParagraphDown(idx)} className="p-1 hover:text-[#1dff00]"><ArrowDown className="w-3 h-3" /></button>
                                            <button onClick={() => removeParagraph(idx)} className="p-1 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <input
                                value={jobDescription}
                                onChange={e => setJobDescription(e.target.value)}
                                placeholder="Paste Job Description for AI context..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none mt-2"
                            />
                        </div>

                        {/* Closing */}
                        <div className="grid grid-cols-2 gap-3">
                            <input value={content.closing} onChange={e => setClosing(e.target.value)} placeholder="Closing" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                            <input value={content.signature} onChange={e => setSignatureName(e.target.value)} placeholder="Signature" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-[#1dff00] outline-none" />
                        </div>
                    </div>
                </Card >

                {/* PREVIEW PANEL (RIGHT) */}
                < Card className={`p-8 bg-white min-h-[800px] text-black shadow-2xl overflow-y-auto ${activeTab === 'preview' ? 'block' : 'hidden'} xl:block`}>
                    <div className="max-w-[800px] mx-auto space-y-6" style={{ fontSize: `${typography.fontSize}px`, fontFamily: 'Times New Roman, serif' }}>
                        {/* Header Section */}
                        <div className="text-right space-y-1">
                            <h2 className="font-bold text-lg">{sender.name || 'Your Name'}</h2>
                            {[sender.address, sender.phone, sender.email].filter(Boolean).map((line, i) => (
                                <p key={i} className="text-gray-600">{line}</p>
                            ))}
                        </div>

                        <div className="pt-4 border-b border-gray-200" />

                        <p>{new Date(content.date || Date.now()).toLocaleDateString()}</p>

                        <div className="space-y-1">
                            <p className="font-bold">{recipient.name || 'Recipient Name'}</p>
                            {[recipient.title, company, recipient.address].filter(Boolean).map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>

                        {content.subject && (
                            <p className="font-bold underline mt-4">Subject: {content.subject}</p>
                        )}

                        <p className="mt-4">{content.salutation || 'Dear Hiring Manager,'}</p>

                        {/* Content Body */}
                        <div className="space-y-4 leading-relaxed whitespace-pre-wrap">
                            {(content.paragraphs.length ? content.paragraphs : content.rawBody.split(/\n\n+/)).map((para, i) => (
                                <p key={i}>{para}</p>
                            ))}
                        </div>

                        <div className="mt-8 space-y-4">
                            <p>{content.closing || 'Sincerely,'}</p>
                            <div className="h-12">
                                {content.signature && <p className="font-script text-xl">{content.signature}</p>}
                            </div>
                            <p className="font-bold">{content.signature || sender.name}</p>
                        </div>
                    </div>
                </Card >
            </div >

            {/* Config Toolbar */}
            < div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0a0a0a]/90 backdrop-blur border border-[#1dff00]/30 p-2 rounded-2xl shadow-xl z-50" >
                <Button size="icon" variant="ghost" onClick={zoomOut} className="hover:text-[#1dff00]"><Minus className="w-4 h-4" /></Button>
                <span className="text-xs font-mono w-12 text-center">{typography.fontSize}px</span>
                <Button size="icon" variant="ghost" onClick={zoomIn} className="hover:text-[#1dff00]"><Plus className="w-4 h-4" /></Button>
                <div className="w-px h-4 bg-white/20 mx-2" />
                <Button size="sm" variant="ghost" onClick={clearDraft} className="text-red-400 hover:text-red-500 hover:bg-red-500/10">Clear</Button>
            </div >

            {/* Export Modal */}
            {
                exportOpen && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="relative w-full max-w-md bg-[#0a0a0a] border border-[#1dff00]/30 rounded-2xl p-6 shadow-2xl">
                            <button onClick={() => setExportOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                            <h2 className="text-xl font-bold text-white mb-2">Export Cover Letter</h2>
                            <p className="text-sm text-gray-400 mb-6">Choose a format to download your letter.</p>

                            <div className="space-y-3">
                                <Button onClick={exportPdf} disabled={!!exportBusy} className="w-full justify-start h-12 border-[#1dff00]/30 hover:bg-[#1dff00]/10" variant="outline">
                                    <FileText className="w-5 h-5 mr-3 text-[#1dff00]" /> PDF Document
                                    {exportBusy === 'pdf' && <span className="ml-auto animate-pulse">Processing...</span>}
                                </Button>
                                <Button onClick={exportDocx} disabled={!!exportBusy} className="w-full justify-start h-12 border-[#1dff00]/30 hover:bg-[#1dff00]/10" variant="outline">
                                    <FileType className="w-5 h-5 mr-3 text-blue-400" /> Word (DOCX)
                                    {exportBusy === 'docx' && <span className="ml-auto animate-pulse">Processing...</span>}
                                </Button>
                                <Button onClick={exportTxt} className="w-full justify-start h-12 border-[#1dff00]/30 hover:bg-[#1dff00]/10" variant="outline">
                                    <FileText className="w-5 h-5 mr-3 text-gray-400" /> Plain Text
                                </Button>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/10 flex gap-3">
                                <Button onClick={printLetter} className="flex-1" variant="ghost"><Printer className="w-4 h-4 mr-2" /> Print</Button>
                                <Button onClick={copyPlain} className="flex-1" variant="ghost"><Share2 className="w-4 h-4 mr-2" /> Copy</Button>
                                <Button onClick={share} className="flex-1" variant="ghost"><Share2 className="w-4 h-4 mr-2" /> Share</Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div>
    );
};
