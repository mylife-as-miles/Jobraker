import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../../components/ui/dialog";
import { Switch } from "../../../../components/ui/switch";
import { Button } from "../../../../components/ui/button";
import { useArtboardStore } from "../../../../store/artboard";
import { createClient } from "../../../../lib/supabaseClient";
import { Copy, Eye, Download, Globe } from "lucide-react";
import { useToast } from "../../../../components/ui/toast-provider";

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
  const togglePublicSharing = useArtboardStore(
    (state) => state.togglePublicSharing,
  );

  const [loading, setLoading] = useState(false);
  const canShare = Boolean(resumeId?.trim());

  const handleToggle = async (checked: boolean) => {
    if (!canShare) {
      addToast({
        title: "Save resume first",
        description:
          "This resume needs to be created before you can share it publicly.",
        variant: "info",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("resumes")
        .update({ public_share_enabled: checked })
        .eq("id", resumeId);

      if (error) throw error;

      togglePublicSharing(checked);
      addToast({
        title: checked ? "Resume Published" : "Resume Unpublished",
        description: checked
          ? "Your resume is now public."
          : "Your resume is now private.",
        variant: "success",
      });
    } catch (error) {
      console.error(error);
      addToast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const publicUrl = canShare ? `${window.location.origin}/r/${resumeId}` : "";

  const copyToClipboard = () => {
    if (!canShare) {
      addToast({
        title: "Unavailable",
        description: "Save this resume before copying a public link.",
        variant: "info",
      });
      return;
    }
    navigator.clipboard.writeText(publicUrl);
    addToast({
      title: "Copied",
      description: "Link copied to clipboard.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[520px] bg-white dark:bg-[#09090b] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-3xl shadow-2xl p-0 overflow-visible'>
        <div className='p-8'>
          <DialogHeader className='mb-6'>
            <DialogTitle className='text-xl font-bold tracking-tight'>
              Share Resume
            </DialogTitle>
            <DialogDescription className='text-zinc-500 dark:text-zinc-400'>
              Manage public access and track your resume performance.
            </DialogDescription>
          </DialogHeader>

          <div className='flex items-center justify-between p-5 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 mb-8'>
            <div className='flex flex-col gap-1'>
              <span className='font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100'>
                Public Access
              </span>
              <p className='text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[240px]'>
                {canShare
                  ? "Visible to anyone with the link. Track performance."
                  : "Save this resume first to generate a public link."}
              </p>
            </div>
            <Switch
              checked={!!isPublic}
              onCheckedChange={handleToggle}
              disabled={loading || !canShare}
              className='data-[state=checked]:bg-brand data-[state=checked]:dark:bg-brand'
            />
          </div>

          {canShare && isPublic && (
            <div className='space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300'>
              <div className='space-y-3'>
                <label className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-1'>
                  Share Link
                </label>
                <div className='flex items-center gap-3 p-4 bg-zinc-100/50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl group transition-all hover:border-zinc-300 dark:hover:border-white/20'>
                  <div className='w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0'>
                    <Globe className='w-4 h-4 text-brand' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate'>
                      {publicUrl}
                    </p>
                  </div>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-9 px-4 text-xs font-bold gap-2 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all rounded-xl border border-transparent dark:border-zinc-800'
                    onClick={copyToClipboard}
                  >
                    <Copy className='w-3.5 h-3.5' />
                    Copy
                  </Button>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='relative overflow-hidden group p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-1 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/80'>
                  <div className='absolute -right-2 -top-2 w-16 h-16 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all' />
                  <Eye className='w-5 h-5 text-blue-500 mb-1' />
                  <span className='text-3xl font-bold tabular-nums'>
                    {views || 0}
                  </span>
                  <span className='text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest'>
                    Total Views
                  </span>
                </div>

                <div className='relative overflow-hidden group p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-1 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800/80'>
                  <div className='absolute -right-2 -top-2 w-16 h-16 bg-brand/10 rounded-full blur-2xl group-hover:bg-brand/20 transition-all' />
                  <Download className='w-5 h-5 text-brand mb-1' />
                  <span className='text-3xl font-bold tabular-nums'>
                    {downloads || 0}
                  </span>
                  <span className='text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest'>
                    Downloads
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
