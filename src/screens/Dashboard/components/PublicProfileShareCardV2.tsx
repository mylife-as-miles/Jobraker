import { Compass, Copy, Crown, ExternalLink, Eye, Globe2, MonitorCog, Newspaper, Palette, Sparkles, Waves } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { useToast } from "../../../components/ui/toast";
import type { Profile } from "../../../hooks/useProfileSettings";
import { usePublicProfileSite, type PublicProfileTemplate, type PublicProfileTheme } from "../../../hooks/usePublicProfileSite";
import { useSubscriptionTier } from "../../../hooks/useSubscriptionTier";
import { hasSubscriptionAccess } from "../../../lib/subscriptionAccess";

type Option = { id: PublicProfileTemplate; theme: PublicProfileTheme; label: string; note: string; accent: string; icon: typeof Palette };
const OPTIONS: Option[] = [
  { id: "atelier", theme: "atelier", label: "Atelier", note: "editorial, warm, refined", accent: "#e6c27a", icon: Palette },
  { id: "navigator", theme: "navigator", label: "Navigator", note: "story-led, lively, JobRaker green", accent: "#2fd968", icon: Compass },
  { id: "editorial", theme: "navigator", label: "Editorial", note: "magazine cover, warm paper, personal", accent: "#b4532f", icon: Newspaper },
  { id: "kinetic", theme: "navigator", label: "Kinetic", note: "reactive waves, giant type, creative motion", accent: "#f40c3f", icon: Waves },
];

function activeTemplate(theme?: string, design?: Record<string, unknown>): PublicProfileTemplate {
  const variant = design?.templateVariant;
  if (theme !== "navigator" || variant === "atelier" || variant === "hologram") return "hologram";
  if (variant === "editorial") return "editorial";
  if (variant === "kinetic" || variant === "wodniack") return "kinetic";
  return "navigator";
}

export function PublicProfileShareCard({ profile }: { profile: Profile | null }) {
  const { success, error: toastError } = useToast();
  const { site, saving, publicUrl, ensureSite, updateSite } = usePublicProfileSite(profile);
  const { subscriptionTier } = useSubscriptionTier();
  const published = site?.is_public === true;
  const canHide = hasSubscriptionAccess(subscriptionTier, "Basics");
  const watermark = site?.design?.showWatermark !== false;
  const selected = activeTemplate(site?.theme, site?.design);

  const currentSite = async () => site || ensureSite();
  const fail = (title: string, error: unknown) => toastError(title, error instanceof Error ? error.message : String(error));

  const choose = async (option: Option) => {
    try {
      const current = await currentSite();
      if (!current) return;
      await updateSite({ theme: option.theme, design: { ...(current.design || {}), accent: option.accent, templateVariant: option.id } });
      success(`${option.label} portfolio selected`);
    } catch (error) { fail("Template update failed", error); }
  };

  const togglePublish = async () => {
    try {
      const current = await currentSite();
      await updateSite({ is_public: !(current?.is_public === true) });
      success(current?.is_public ? "Portfolio unpublished" : "Portfolio published");
    } catch (error) { fail("Update failed", error); }
  };

  const copy = async () => {
    try {
      const current = await currentSite();
      if (!current) return;
      const next = current.is_public ? current : await updateSite({ is_public: true });
      await navigator.clipboard.writeText(`${window.location.origin}/u/${next?.slug || current.slug}`);
      success(current.is_public ? "Profile link copied" : "Portfolio published and link copied");
    } catch (error) { fail("Copy failed", error); }
  };

  const preview = async () => {
    try {
      const current = await currentSite();
      if (!current) return;
      window.open(current.is_public ? `/u/${current.slug}` : `/u/${current.slug}?preview=1`, "_blank", "noopener,noreferrer");
    } catch (error) { fail("Preview failed", error); }
  };

  const toggleWatermark = async () => {
    if (!canHide) return;
    try {
      const current = await currentSite();
      if (!current) return;
      await updateSite({ design: { ...(current.design || {}), showWatermark: !watermark } });
      success(watermark ? "Watermark hidden" : "Watermark shown");
    } catch (error) { fail("Watermark update failed", error); }
  };

  return (
    <Card className="product-section-card overflow-hidden p-0">
      <div className="relative p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(47,217,104,0.16),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.05),transparent)]" />
        <div className="relative">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><div className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand"><Globe2 className="h-3.5 w-3.5" />Public portfolio</div><h3 className="text-base font-semibold text-foreground">Recruiter-ready profile</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Publish a polished profile link for recruiters, hiring managers, and portfolio requests.</p></div>
            <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${published ? "border-brand/40 bg-brand/10 text-brand" : "border-foreground/10 bg-foreground/5 text-muted-foreground"}`}>{published ? "Live" : "Draft"}</div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {OPTIONS.map((option) => { const Icon = option.icon; const active = selected === option.id; return <button key={option.id} type="button" disabled={saving} onClick={() => void choose(option)} className={`rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${active ? "border-brand/40 bg-brand/10 text-foreground" : "border-foreground/10 bg-background/50 text-muted-foreground hover:border-brand/25 hover:text-foreground"}`}><div className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-3.5 w-3.5 text-brand" />{option.label}</div><p className="mt-1 text-[10px] leading-relaxed opacity-75">{option.note}</p></button>; })}
          </div>

          <div className="mb-4 rounded-xl border border-foreground/10 bg-black/20 p-3"><p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Share URL</p><p className="truncate font-mono text-xs text-foreground/75">{site?.slug ? publicUrl : "Create your public profile link"}</p></div>

          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-black/20 p-3">
            <div className="min-w-0"><div className="flex items-center gap-2 text-xs font-semibold text-foreground"><Crown className="h-3.5 w-3.5 text-brand" />Made with JobRaker watermark</div><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{canHide ? "Paid portfolios can hide the floating public tab." : "Paid users can turn off the floating public tab."}</p></div>
            <Button type="button" size="sm" variant="outline" disabled={saving || !canHide} onClick={() => void toggleWatermark()} className="shrink-0 border-foreground/10">{watermark ? "Hide" : "Show"}</Button>
          </div>

          <div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={saving} onClick={togglePublish} className="bg-brand text-black hover:bg-brand/90"><Sparkles className="mr-2 h-4 w-4" />{published ? "Unpublish" : "Publish"}</Button><Button type="button" size="sm" variant="outline" disabled={saving} onClick={copy} className="border-foreground/10"><Copy className="mr-2 h-4 w-4" />Copy</Button><Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void preview()} className="border-foreground/10"><Eye className="mr-2 h-3.5 w-3.5" />{published ? "Preview" : "Draft Preview"}<ExternalLink className="ml-2 h-3.5 w-3.5" /></Button></div>
        </div>
      </div>
    </Card>
  );
}
