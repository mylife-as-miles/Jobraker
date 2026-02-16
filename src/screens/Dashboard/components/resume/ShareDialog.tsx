import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../../components/ui/dialog';
import { Switch } from '../../../../components/ui/switch';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { useArtboardStore } from '../../../../store/artboard';
import { createClient } from '../../../../lib/supabaseClient';
import { Copy, Eye, Download, Globe, Share2 } from 'lucide-react';
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
            <DialogContent className="sm:max-w-md bg-white dark:bg-[#0A0A0A] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                <DialogHeader>
                    <DialogTitle>Share Resume</DialogTitle>
                    <DialogDescription>
                        Make your resume public to share it with recruiters.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between py-4">
                    <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">Public Access</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Anyone with the link can view your resume.
                        </span>
                    </div>
                    <Switch
                        checked={!!isPublic}
                        onCheckedChange={handleToggle}
                        disabled={loading}
                        className="data-[state=checked]:bg-[#1dff00]"
                    />
                </div>

                {isPublic && (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5">
                            <Globe className="w-4 h-4 text-[#1dff00]" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate select-all">
                                    {publicUrl}
                                </p>
                            </div>
                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={copyToClipboard}>
                                <Copy className="w-3 h-3" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 flex flex-col items-center justify-center gap-2">
                                <Eye className="w-5 h-5 text-blue-500" />
                                <span className="text-2xl font-bold">{views || 0}</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Views</span>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 flex flex-col items-center justify-center gap-2">
                                <Download className="w-5 h-5 text-green-500" />
                                <span className="text-2xl font-bold">{downloads || 0}</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Downloads</span>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
