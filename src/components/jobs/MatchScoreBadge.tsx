import React from "react";
import { Sparkles } from "lucide-react";

export function getMatchScoreClasses(score: number | null | undefined) {
  if (typeof score !== "number") {
    return "text-foreground/60 bg-foreground/5 border-foreground/10 hover:border-[#2fd968]/50 hover:text-[#2fd968] hover:bg-[#2fd968]/10";
  }
  if (score >= 85) return "text-brand bg-brand/20 border-brand/30 hover:border-brand/60";
  if (score >= 65) return "text-[#f8d74a] bg-[#f8d74a]/12 border-[#f8d74a]/25 hover:border-[#f8d74a]/50";
  return "text-[#f97316] bg-[#f97316]/12 border-[#f97316]/25 hover:border-[#f97316]/50";
}

export default function MatchScoreBadge({
  score,
  size = "sm",
  label = "match",
  onClick,
}: {
  score: number | null | undefined;
  size?: "sm" | "md";
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const base = getMatchScoreClasses(score);
  const sizing = size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 ${sizing} rounded-full font-medium border transition-all duration-200 ${base} ${
        onClick ? "cursor-pointer active:scale-95" : ""
      }`}
      title={typeof score === "number" ? `Match score: ${score}%` : "Click to evaluate job match with AI"}
    >
      {typeof score === "number" ? (
        `${score}% ${label}`
      ) : (
        <>
          <Sparkles className="w-3 h-3 text-[#2fd968]/80 group-hover:text-[#2fd968]" />
          <span>No score</span>
        </>
      )}
    </span>
  );
}
