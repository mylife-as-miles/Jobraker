import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Switch } from '../../../../components/ui/switch';
import { Button } from '../../../../components/ui/button';
import { useArtboardStore } from '../../../../store/artboard';
import { createClient } from '../../../../lib/supabaseClient';
import { Copy, Eye, Download, Globe, Check } from 'lucide-react';
import { useToast } from '../../../../components/ui/toast-provider';

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ShareDialog = ({ open, onOpenChange }: ShareDialogProps) => {
    const { addToast } = useToast();
    const supabase = createClient();

    const resumeId = useArtboardStore((state) => state.resume.id);
    const isPublic = useArtboardStore((state) => state.resume.is_public);
    const views = useArtboardStore((state) => state.resume.views);
    const downloads = useArtboardStore((state) => state.resume.downloads);
    const togglePublicSharing = useArtboardStore((state) => state.togglePublicSharing);

    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleToggle = async (checked: boolean) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('resumes')
                .update({ public_share_enabled: checked })
                .eq('id', resumeId);

            if (error) throw error;

            togglePublicSharing(checked);
            addToast({
                title: checked ? "Resume Published" : "Resume Unpublished",
                description: checked ? "Your resume is now public." : "Your resume is now private.",
                variant: "success"
            });
        } catch (error) {
            console.error(error);
            addToast({
                title: "Error",
                description: "Failed to update settings.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const publicUrl = `${window.location.origin}/r/${resumeId}`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        addToast({
            title: "Copied",
            description: "Link copied to clipboard.",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-[#0A0A0A] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl">Share Resume</DialogTitle>
                    <DialogDescription className="text-gray-500 dark:text-gray-400">
                        Make your resume public to share it with recruiters.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-sm">Public Access</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Anyone with the link can view your resume
                        </span>
                    </div>
                    <Switch
                        checked={!!isPublic}
                        onCheckedChange={handleToggle}
                        disabled={loading}
                        className="data-[state=checked]:bg-[#1dff00] data-[state=checked]:border-[#1dff00]"
                    />
                </div>

                {isPublic && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Link Box */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Public Link</label>
                            <div className="flex items-center gap-2 p-1.5 pl-3 bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-white/10 focus-within:ring-1 focus-within:ring-[#1dff00] transition-all">
                                <Globe className="w-4 h-4 text-[#1dff00]" />
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate select-all font-mono">
                                        {publicUrl}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-8 w-8 shrink-0 hover:bg-gray-100 dark:hover:bg-white/10 ${copied ? 'text-[#1dff00]' : ''}`}
                                    onClick={copyToClipboard}
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-500/10 dark:to-transparent rounded-xl border border-blue-100 dark:border-blue-500/20 flex flex-col items-center justify-center gap-1 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Eye className="w-12 h-12 text-blue-500" />
                                </div>
                                <Eye className="w-5 h-5 text-blue-500 mb-1" />
                                <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-blue-600 to-blue-400 dark:from-blue-400 dark:to-blue-600">{views || 0}</span>
                                <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70 font-bold uppercase tracking-widest">Views</span>
                            </div>

                            <div className="p-4 bg-gradient-to-br from-green-50 to-transparent dark:from-[#1dff00]/10 dark:to-transparent rounded-xl border border-green-100 dark:border-[#1dff00]/20 flex flex-col items-center justify-center gap-1 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Download className="w-12 h-12 text-[#1dff00]" />
                                </div>
                                <Download className="w-5 h-5 text-green-600 dark:text-[#1dff00] mb-1" />
                                <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-green-600 to-green-400 dark:from-[#1dff00] dark:to-green-600">{downloads || 0}</span>
                                <span className="text-[10px] text-green-600/70 dark:text-[#1dff00]/70 font-bold uppercase tracking-widest">Downloads</span>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
