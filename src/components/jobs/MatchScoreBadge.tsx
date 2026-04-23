import React from "react";

export function getMatchScoreClasses(score: number) {
  if (score >= 90) return "text-brand bg-brand/20 border-brand/30";
  if (score >= 75) return "text-brand bg-brand/20 border-brand/30";
  return "text-brand bg-brand/20 border-brand/30";
}

export default function MatchScoreBadge({
  score,
  size = "sm",
  label = "match",
}: {
  score: number;
  size?: "sm" | "md";
  label?: string;
}) {
  const base = getMatchScoreClasses(score);
  const sizing = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-1 text-xs";
  return (
    <span className={`${sizing} rounded-full font-medium border ${base}`}>
      {score}% {label}
    </span>
  );
}
