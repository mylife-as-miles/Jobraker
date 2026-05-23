import React from "react";

export function getMatchScoreClasses(score: number | null | undefined) {
  if (typeof score !== "number") {
    return "text-foreground/55 bg-foreground/5 border-foreground/10";
  }
  if (score >= 85) return "text-brand bg-brand/20 border-brand/30";
  if (score >= 65) return "text-[#f8d74a] bg-[#f8d74a]/12 border-[#f8d74a]/25";
  return "text-[#f97316] bg-[#f97316]/12 border-[#f97316]/25";
}

export default function MatchScoreBadge({
  score,
  size = "sm",
  label = "match",
}: {
  score: number | null | undefined;
  size?: "sm" | "md";
  label?: string;
}) {
  const base = getMatchScoreClasses(score);
  const sizing = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-1 text-xs";
  return (
    <span className={`${sizing} rounded-full font-medium border ${base}`}>
      {typeof score === "number" ? `${score}% ${label}` : "No score"}
    </span>
  );
}
