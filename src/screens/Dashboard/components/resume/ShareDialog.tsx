import { useState, useEffect, useCallback } from "react";
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
import {
  Copy,
  Eye,
  Download,
  Globe,
  Lock,
  RotateCw,
  Check,
  ShieldCheck,
  Loader2,
} from "lucide-react";
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
  const storeViews = useArtboardStore((state) => state.resume.views);
  const storeDownloads = useArtboardStore((state) => state.resume.downloads);
  const storeShareToken = useArtboardStore((state) => state.resume.share_token);
  const togglePublicSharing = useArtboardStore(
    (state) => state.togglePublicSharing,
  );
  const updateResumeStats = useArtboardStore(
    (state) => state.updateResumeStats,
  );

  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [views, setViews] = useState(storeViews || 0);
  const [downloads, setDownloads] = useState(storeDownloads || 0);
  const [shareToken, setShareToken] = useState<string | null>(storeShareToken || null);
  const [copiedPrivate, setCopiedPrivate] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);

  const canShare = Boolean(resumeId?.trim());

  const fetchLiveStats = useCallback(async () => {
    if (!resumeId) return;
    setLoadingStats(true);
    try {
      const { data, error } = await supabase
        .from("resumes")
        .select("views, downloads, public_share_enabled, share_token")
        .eq("id", resumeId)
        .single();

      if (!error && data) {
        let currentToken = data.share_token;
        // If resume exists but has no share token, generate one
        if (!currentToken) {
          const { data: newToken } = await supabase.rpc(
            "regenerate_resume_share_token",
            { p_resume_id: resumeId },
          );
          if (newToken) currentToken = newToken;
        }

        const freshViews = data.views ?? 0;
        const freshDownloads = data.downloads ?? 0;
        const isPublicVal = Boolean(data.public_share_enabled);

        setViews(freshViews);
        setDownloads(freshDownloads);
        setShareToken(currentToken || null);
        togglePublicSharing(isPublicVal);
        updateResumeStats({
          views: freshViews,
          downloads: freshDownloads,
          share_token: currentToken || null,
        });
      }
    } catch (err) {
      console.error("Failed to fetch live resume stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [resumeId, supabase, togglePublicSharing, updateResumeStats]);

  useEffect(() => {
    if (open && canShare) {
      fetchLiveStats();
    }
  }, [open, canShare, fetchLiveStats]);

  const handleToggle = async (checked: boolean) => {
    if (!canShare) {
      addToast({
        title: "Save resume first",
        description:
          "This resume needs to be saved before you can share it publicly.",
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
          ? "Your resume is now publicly accessible to anyone."
          : "Your resume is now private. Only people with your private link can view it.",
        variant: "success",
      });
    } catch (error) {
      console.error(error);
      addToast({
        title: "Error",
        description: "Failed to update public share settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!canShare) return;
    setIsRegenerating(true);
    try {
      const { data: newToken, error } = await supabase.rpc(
        "regenerate_resume_share_token",
        { p_resume_id: resumeId },
      );

      if (error) throw error;

      if (newToken) {
        setShareToken(newToken);
        updateResumeStats({ share_token: newToken });
        addToast({
          title: "Private Link Regenerated",
          description:
            "A new private share link was created. Previous private links are now revoked.",
          variant: "success",
        });
      }
    } catch (err: any) {
      console.error("Error regenerating share token:", err);
      addToast({
        title: "Regeneration Failed",
        description: err?.message || "Could not regenerate private link.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const privateUrl =
    canShare && shareToken
      ? `${window.location.origin}/r/${resumeId}?token=${shareToken}`
      : canShare
        ? `${window.location.origin}/r/${resumeId}`
        : "";

  const publicUrl = canShare ? `${window.location.origin}/r/${resumeId}` : "";

  const copyPrivateLink = () => {
    if (!canShare || !privateUrl) {
      addToast({
        title: "Unavailable",
        description: "Save this resume first to generate a link.",
        variant: "info",
      });
      return;
    }
    navigator.clipboard.writeText(privateUrl);
    setCopiedPrivate(true);
    setTimeout(() => setCopiedPrivate(false), 2000);
    addToast({
      title: "Private Link Copied",
      description: "Private link copied. Anyone with this link can view your resume.",
    });
  };

  const copyPublicLink = () => {
    if (!canShare || !publicUrl) {
      addToast({
        title: "Unavailable",
        description: "Save this resume first to copy the public link.",
        variant: "info",
      });
      return;
    }
    navigator.clipboard.writeText(publicUrl);
    setCopiedPublic(true);
    setTimeout(() => setCopiedPublic(false), 2000);
    addToast({
      title: "Public Link Copied",
      description: "Public link copied to clipboard.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=' max-w-fit max-h-[90vh] overflow-y-auto bg-white dark:bg-[#09090b] border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-3xl shadow-2xl p-4'>
          <DialogHeader className='mb-6'>
            <DialogTitle className='text-xl font-bold tracking-tight'>
              Share Resume
            </DialogTitle>
            <DialogDescription className='text-xs text-muted-foreground dark:text-muted-foreground'>
              Share your resume privately with recruiters or publish it publicly. Track live view and download performance.
            </DialogDescription>
          </DialogHeader>

          <div className='flex w-fit items-center justify-between p-5 bg-zinc-50 dark:bg-foreground/5 rounded-2xl border border-zinc-200 dark:border-foreground/10 mb-8'>
            <div className='flex flex-col gap-1'>
              <span className='font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100'>
                Public Access
              </span>
              <p className='text-xs text-muted-foreground dark:text-muted-foreground leading-relaxed max-w-[240px]'>
                {canShare
                  ? "Visible to anyone with the link. Track performance."
                  : "Save this resume first to generate a public link."}
              </p>
            </div>

          {canShare && isPublic && (
            <div className='space-y-6 w-fit animate-in fade-in slide-in-from-bottom-2 duration-300'>
              <div className='space-y-3'>
                <label className='text-[10px] font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-[0.2em] ml-1'>
                  Share Link
                </label>
                <div className='flex items-center gap-3 p-4 bg-zinc-100/50 dark:bg-foreground/5 border border-zinc-200 dark:border-foreground/10 rounded-2xl group transition-all hover:border-zinc-300 dark:hover:border-foreground/20'>
                  <div className='w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0'>
                    <Globe className='w-4 h-4 text-brand' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='text-xs font-mono text-muted-foreground dark:text-muted-foreground truncate'>
                      {publicUrl}
                    </p>
                  </div>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-9 px-4 text-xs font-bold gap-2 hover:bg-zinc-200 dark:hover:bg-foreground/10 transition-all rounded-xl border border-transparent dark:border-zinc-800'
                    onClick={copyToClipboard}
                  >
                    <Copy className='w-3.5 h-3.5' />
                    Copy
                  </Button>
                </div>
              </div>
              <Button
                size='sm'
                variant='outline'
                disabled={!canShare}
                className='h-8 px-3 text-xs font-semibold gap-1.5 shrink-0 bg-brand text-black hover:bg-brand/90 border-transparent'
                onClick={copyPrivateLink}
              >
                {copiedPrivate ? (
                  <>
                    <Check className='w-3.5 h-3.5' />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className='w-3.5 h-3.5' />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 2. Public Access Toggle */}
          <div className='p-4 bg-zinc-50 dark:bg-foreground/5 rounded-2xl border border-zinc-200 dark:border-foreground/10 space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500'>
                  <Globe className='w-3.5 h-3.5' />
                </div>
                <div>
                  <span className='font-bold text-xs tracking-tight text-zinc-900 dark:text-zinc-100'>
                    Public Access
                  </span>
                  <p className='text-[11px] text-muted-foreground dark:text-muted-foreground'>
                    {isPublic
                      ? "Resume is public without requiring a secret token."
                      : "Public access is disabled. Only private link works."}
                  </p>
                </div>
              </div>
              <Switch
                checked={!!isPublic}
                onCheckedChange={handleToggle}
                disabled={loading || !canShare}
                className='data-[state=checked]:bg-brand data-[state=checked]:dark:bg-brand'
              />
            </div>

            {canShare && isPublic && (
              <div className='pt-2 border-t border-border/30 flex items-center gap-2'>
                <div className='flex-1 min-w-0'>
                  <p className='text-xs font-mono text-muted-foreground dark:text-muted-foreground truncate select-all'>
                    {publicUrl}
                  </p>
                </div>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-8 px-3 text-xs font-semibold gap-1.5 shrink-0 border border-border/50 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  onClick={copyPublicLink}
                >
                  {copiedPublic ? (
                    <>
                      <Check className='w-3.5 h-3.5 text-brand' />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className='w-3.5 h-3.5' />
                      Copy Public
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* 3. Live Performance Metrics (Views & Downloads) */}
          <div className='space-y-2 pt-1'>
            <div className='flex items-center justify-between px-1'>
              <label className='text-[10px] font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-[0.2em]'>
                Engagement Metrics
              </label>
              <span className='text-[10px] text-muted-foreground flex items-center gap-1'>
                <ShieldCheck className='w-3 h-3 text-brand' />
                Live tracking enabled
              </span>
            </div>
          )}
        
      </DialogContent>
    </Dialog>
  );
};
