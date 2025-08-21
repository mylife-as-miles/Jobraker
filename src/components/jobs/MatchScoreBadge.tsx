import React from "react";

export function getMatchScoreClasses(score: number) {
  if (score >= 90) return "text-green-400 bg-green-400/20 border-green-400/30";
  if (score >= 75) return "text-yellow-400 bg-yellow-400/20 border-yellow-400/30";
  return "text-red-400 bg-red-400/20 border-red-400/30";
}

export default function MatchScoreBadge({
  score,
  size = "sm",
  label = "match"
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
