import { Copy, Crown, ExternalLink, Eye, Globe2, Palette, Sparkles } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { useToast } from "../../../components/ui/toast";
import type { Profile } from "../../../hooks/useProfileSettings";
import { usePublicProfileSite, type PublicProfileTheme } from "../../../hooks/usePublicProfileSite";
import { useSubscriptionTier } from "../../../hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "../../../lib/subscriptionAccess";

const THEME_OPTIONS: Array<{
  value: PublicProfileTheme;
  label: string;
  note: string;
}> = [
  { value: "obsidian", label: "Obsidian", note: "dark, cinematic, neon" },
  { value: "atelier", label: "Atelier", note: "editorial, warm, refined" },
  { value: "prism", label: "Prism", note: "glass, color, motion" },
  { value: "mono", label: "Mono", note: "sharp, minimal, senior" },
];

export function PublicProfileShareCard({ profile }: { profile: Profile | null }) {
  const { success, error: toastError } = useToast();
  const { site, saving, publicUrl, ensureSite, updateSite } = usePublicProfileSite(profile);
  const { subscriptionTier } = useSubscriptionTier();
  const isPublished = site?.is_public === true;
  const canHideWatermark = hasSubscriptionAccess(subscriptionTier, "Basics");
  const watermarkVisible = site?.design?.showWatermark !== false;

  const handleCopy = async () => {
    try {
      const current = site || (await ensureSite());
      if (!current) return;
      const publishedSite = current.is_public ? current : await updateSite({ is_public: true });
      const slug = publishedSite?.slug || current.slug;
      const url = `${window.location.origin}/u/${slug}`;
      await navigator.clipboard.writeText(url);
      success(current.is_public ? "Profile link copied" : "Portfolio published and link copied");
    } catch (err: any) {
      toastError("Copy failed", err.message);
    }
  };

  const handlePreview = async () => {
    try {
      const current = site || (await ensureSite());
      if (!current) return;
      const url = current.is_public
        ? `/u/${current.slug}`
        : `/u/${current.slug}?preview=1`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toastError("Preview failed", err.message);
    }
  };

  const handlePublishToggle = async () => {
    try {
      const current = site || (await ensureSite());
      await updateSite({ is_public: !(current?.is_public === true) });
      success(current?.is_public ? "Portfolio unpublished" : "Portfolio published");
    } catch (err: any) {
      toastError("Update failed", err.message);
    }
  };

  const handleTheme = async (theme: PublicProfileTheme) => {
    try {
      await updateSite({ theme });
      success("Portfolio aesthetic updated");
    } catch (err: any) {
      toastError("Theme update failed", err.message);
    }
  };

  const handleWatermarkToggle = async () => {
    if (!canHideWatermark) return;
    try {
      const current = site || (await ensureSite());
      if (!current) return;
      await updateSite({
        design: {
          ...(current.design || {}),
          showWatermark: !watermarkVisible,
        },
      });
      success(watermarkVisible ? "Watermark hidden" : "Watermark shown");
    } catch (err: any) {
      toastError("Watermark update failed", err.message);
    }
  };

  return (
    <Card className="product-section-card overflow-hidden p-0">
      <div className="relative p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(29,255,0,0.16),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.05),transparent)]" />
        <div className="relative">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand">
                <Globe2 className="h-3.5 w-3.5" />
                Public portfolio
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Recruiter-ready profile
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Publish a polished profile link for recruiters, hiring managers, and portfolio requests.
              </p>
            </div>
            <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
              isPublished
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-foreground/10 bg-foreground/5 text-muted-foreground"
            }`}>
              {isPublished ? "Live" : "Draft"}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            {THEME_OPTIONS.map((option) => {
              const active = (site?.theme || "obsidian") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  onClick={() => void handleTheme(option.value)}
                  className={`rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                    active
                      ? "border-brand/40 bg-brand/10 text-foreground"
                      : "border-foreground/10 bg-background/50 text-muted-foreground hover:border-brand/25 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Palette className="h-3.5 w-3.5 text-brand" />
                    {option.label}
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed opacity-75">
                    {option.note}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mb-4 rounded-xl border border-foreground/10 bg-black/20 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Share URL
            </p>
            <p className="truncate font-mono text-xs text-foreground/75">
              {site?.slug ? publicUrl : "Create your public profile link"}
            </p>
          </div>

          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-black/20 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Crown className="h-3.5 w-3.5 text-brand" />
                Made with JobRaker watermark
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                {canHideWatermark
                  ? "Paid portfolios can hide the floating public tab."
                  : "Paid users can turn off the floating public tab."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving || !canHideWatermark}
              onClick={() => void handleWatermarkToggle()}
              className="shrink-0 border-foreground/10"
            >
              {watermarkVisible ? "Hide" : "Show"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={handlePublishToggle}
              className="bg-brand text-black hover:bg-brand/90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isPublished ? "Unpublish" : "Publish"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={handleCopy}
              className="border-foreground/10"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void handlePreview()}
              className="border-foreground/10"
            >
              <Eye className="mr-2 h-4 w-4" />
              {isPublished ? "Preview" : "Draft Preview"}
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
