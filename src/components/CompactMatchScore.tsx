"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface CompactMatchScoreProps {
  score: number;
  summary?: string;
}

export function CompactMatchScore({ score, summary }: CompactMatchScoreProps) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <Badge
        variant="outline"
        className={
          score >= 70
            ? "text-[#1dff00] bg-[#1dff00]/10 border-none text-xs px-2 py-1"
            : score >= 50
            ? "text-[#ffd78b] bg-[#ffd78b]/10 border-none text-xs px-2 py-1"
            : "text-[#ff8b8b] bg-[#ff8b8b]/10 border-none text-xs px-2 py-1"
        }
      >
        <TrendingUp className="h-3 w-3 mr-1" />
        <span>{score}% Match</span>
      </Badge>
      {summary && (
        <p className="text-xs text-white/60 truncate" title={summary}>{summary}</p>
      )}
    </div>
  );
}
