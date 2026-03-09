import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Switch } from '../../../../components/ui/switch';
import { Button } from '../../../../components/ui/button';
import { useArtboardStore } from '../../../../store/artboard';
import { createClient } from '../../../../lib/supabaseClient';
import { Copy, Eye, Download, Globe } from 'lucide-react';
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
        addToast({
            title: "Copied",
            description: "Link copied to clipboard.",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] bg-white dark:bg-[#09090b] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-2xl shadow-2xl p-0 overflow-hidden">
                <div className="p-6">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-xl font-bold tracking-tight">Share Resume</DialogTitle>
                        <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                            Manage public access and track your resume performance.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 mb-6">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">Public Access</span>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Share your resume via a public URL.
                            </p>
                        </div>
                        <Switch
                            checked={!!isPublic}
                            onCheckedChange={handleToggle}
                            disabled={loading}
                            className="data-[state=checked]:bg-[#1dff00] data-[state=checked]:dark:bg-[#1dff00]"
                        />
                    </div>

                    {isPublic && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1">Share Link</label>
                                <div className="flex items-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl group transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
                                    <Globe className="w-4 h-4 text-[#1dff00] shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 truncate select-all">
                                            {publicUrl}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-3 text-xs gap-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                        onClick={copyToClipboard}
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        Copy
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative overflow-hidden group p-5 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent dark:from-blue-500/5 rounded-2xl border border-blue-500/20 dark:border-blue-500/10 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                                    <div className="absolute -right-4 -top-4 w-12 h-12 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all" />
                                    <Eye className="w-6 h-6 text-blue-500 mb-1" />
                                    <span className="text-3xl font-black tracking-tight">{views || 0}</span>
                                    <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70 font-bold uppercase tracking-[0.1em]">Total Views</span>
                                </div>

                                <div className="relative overflow-hidden group p-5 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent dark:from-emerald-500/5 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/10 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                                    <div className="absolute -right-4 -top-4 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
                                    <Download className="w-6 h-6 text-emerald-500 mb-1" />
                                    <span className="text-3xl font-black tracking-tight">{downloads || 0}</span>
                                    <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-bold uppercase tracking-[0.1em]">Downloads</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
