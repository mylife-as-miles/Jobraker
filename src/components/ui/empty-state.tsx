import React from "react";
import { Button } from "./button";
import type { LucideIcon } from "lucide-react";

/**
 * Unified enterprise-grade EmptyState component.
 * Backward compatible with the earlier simpler variant (title, description, illustrationSrc, primaryAction, secondaryAction, className).
 * Extended capabilities: tone variants, icon, secondaryChips, rich visual styling.
 */

type LegacyAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
};

export type EmptyStateProps = {
  title: string;
  description?: string;
  illustrationSrc?: string; // legacy prop still supported
  primaryAction?: LegacyAction;
  secondaryAction?: LegacyAction;
  className?: string;
  // New props
  icon?: LucideIcon;
  tone?: "neutral" | "info" | "primary" | "success" | "warning" | "danger";
  secondaryChips?: string[];
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  illustrationSrc,
  primaryAction,
  secondaryAction,
  className = "",
  icon: Icon,
  tone = "neutral",
  secondaryChips = [],
}) => {
  const ActionButton: React.FC<LegacyAction & { primary?: boolean }> = ({ label, onClick, href, variant, primary }) => {
    const v = variant || (primary ? "primary" : "outline");
    if (href) {
      return (
        <a href={href} onClick={onClick} className="inline-block">
          <Button variant={v as any}>{label}</Button>
        </a>
      );
    }
    return <Button onClick={onClick} variant={v as any}>{label}</Button>;
  };

  const toneStyles: Record<string, { ring: string; glow: string; accent: string; icon: string; pill: string }> = {
    neutral: { ring: 'ring-[#ffffff22]', glow: 'from-[#ffffff10] to-[#ffffff05]', accent: 'text-white', icon: 'text-white', pill: 'bg-[#ffffff12] text-[#ffffff99]' },
    info: { ring: 'ring-sky-400/30', glow: 'from-sky-500/10 to-sky-500/0', accent: 'text-sky-300', icon: 'text-sky-300', pill: 'bg-sky-500/15 text-sky-300' },
    primary: { ring: 'ring-[#1dff00]/40', glow: 'from-[#1dff00]/15 to-transparent', accent: 'text-[#1dff00]', icon: 'text-[#1dff00]', pill: 'bg-[#1dff00]/20 text-[#1dff00]' },
    success: { ring: 'ring-emerald-400/30', glow: 'from-emerald-500/15 to-transparent', accent: 'text-emerald-300', icon: 'text-emerald-300', pill: 'bg-emerald-500/15 text-emerald-300' },
    warning: { ring: 'ring-amber-400/30', glow: 'from-amber-500/15 to-transparent', accent: 'text-amber-300', icon: 'text-amber-300', pill: 'bg-amber-500/15 text-amber-300' },
    danger: { ring: 'ring-rose-400/30', glow: 'from-rose-500/15 to-transparent', accent: 'text-rose-300', icon: 'text-rose-300', pill: 'bg-rose-500/15 text-rose-300' },
  };
  const s = toneStyles[tone] || toneStyles.neutral;

  return (
    <div className={["relative overflow-hidden rounded-xl border border-[#ffffff18] bg-gradient-to-b", s.glow, "p-6 ring-1", s.ring, "backdrop-blur-xl group transition-all duration-500", className].join(" ")}
      role="status"
      aria-live="polite"
    >
      {illustrationSrc && !Icon && (
        <img src={illustrationSrc} alt="" className="mb-4 h-24 w-auto rounded-lg opacity-80 mx-auto" />
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 relative">
        <div className="flex gap-4">
          {Icon && (
            <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center bg-[#ffffff08] ring-1 ${s.ring} ${s.icon} shadow-inner`}> 
              <Icon className="w-7 h-7 drop-shadow" />
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${s.glow} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
            </div>
          )}
          <div className="space-y-2 max-w-xl">
            <h3 className={`text-lg font-semibold tracking-tight ${s.accent}`}>{title}</h3>
            {description && <p className="text-sm text-[#ffffff99] leading-relaxed">{description}</p>}
            {secondaryChips.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {secondaryChips.slice(0, 8).map(ch => (
                  <span key={ch} className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full font-medium ${s.pill} border border-white/5 backdrop-blur-sm`}>
                    {ch}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            {primaryAction && (
              <ActionButton {...primaryAction} primary />
            )}
            {secondaryAction && (
              <ActionButton {...secondaryAction} />
            )}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 bg-[conic-gradient(from_90deg_at_50%_50%,#1dff00_0deg,transparent_140deg)] opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" />
    </div>
  );
};

export default EmptyState;
