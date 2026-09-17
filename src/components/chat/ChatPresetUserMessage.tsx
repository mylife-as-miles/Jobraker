import React, { useState } from "react";
import {
  Zap,
  Sparkles,
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface ParsedPresetData {
  isPreset: boolean;
  title: string;
  presetType: "outreach" | "pitch" | "followup" | "generic";
  targets: Array<{ index: number; company: string; title: string }>;
  tone?: string;
  rawContent: string;
}

export function parsePresetPrompt(content: string): ParsedPresetData | null {
  if (!content || !content.includes("🎯 **")) return null;

  const headerMatch = content.match(/🎯\s*\*\*([^*]+)\*\*/);
  if (!headerMatch) return null;

  const title = headerMatch[1].replace(/Preset$/, "").trim();

  let presetType: ParsedPresetData["presetType"] = "generic";
  const lower = title.toLowerCase();
  if (lower.includes("outreach") || lower.includes("cold")) {
    presetType = "outreach";
  } else if (lower.includes("pitch") || lower.includes("cover letter")) {
    presetType = "pitch";
  } else if (lower.includes("follow-up") || lower.includes("bump")) {
    presetType = "followup";
  }

  // Parse target jobs
  const targets: Array<{ index: number; company: string; title: string }> = [];
  const jobLineRegex = /(\d+)\.\s+\*\*([^*]+)\*\*\s+-\s+([^\n\r]+)/g;
  let match: RegExpExecArray | null;
  while ((match = jobLineRegex.exec(content)) !== null) {
    targets.push({
      index: parseInt(match[1], 10),
      company: match[2].trim(),
      title: match[3].trim(),
    });
  }

  // Parse Tone or Strategy
  let tone: string | undefined;
  const toneMatch = content.match(
    /-\s+\*\*(?:Tone|Follow-Up Strategy)\*\*:\s*([^\n\r]+)/i,
  );
  if (toneMatch) {
    tone = toneMatch[1].trim();
  }

  return {
    isPreset: true,
    title,
    presetType,
    targets,
    tone,
    rawContent: content,
  };
}

export const ChatPresetUserMessage: React.FC<{ content: string }> = ({
  content,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const parsed = parsePresetPrompt(content);

  if (!parsed || !parsed.isPreset) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  const icon =
    parsed.presetType === "outreach" ? (
      <Zap className="size-3.5 text-amber-400 fill-amber-400/20" />
    ) : parsed.presetType === "pitch" ? (
      <Sparkles className="size-3.5 text-blue-400" />
    ) : (
      <RefreshCw className="size-3.5 text-purple-400" />
    );

  return (
    <div className="space-y-2 text-xs text-foreground select-text">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-white/10 border border-white/15">
            {icon}
          </div>
          <span className="font-bold text-foreground text-xs">
            {parsed.title}
          </span>
          <span className="text-[10px] bg-brand/20 text-brand px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
            Preset
          </span>
        </div>
        {parsed.tone && (
          <span className="text-[10px] font-medium text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full truncate max-w-[140px] sm:max-w-none">
            {parsed.tone}
          </span>
        )}
      </div>

      {/* Target Jobs List */}
      {parsed.targets.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <span>Target {parsed.targets.length === 1 ? "Job" : "Jobs"}:</span>
          </div>
          <div className="space-y-1">
            {parsed.targets.map((target) => (
              <div
                key={target.index}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/10"
              >
                <Building2 className="size-3 text-brand shrink-0" />
                <span className="font-semibold text-foreground truncate">
                  {target.company}
                </span>
                <span className="text-muted-foreground text-[11px] truncate">
                  • {target.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible raw prompt disclosure */}
      <div className="pt-0.5">
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          {showDetails ? (
            <>
              <ChevronUp className="size-3" />
              <span>Hide prompt instructions</span>
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              <span>Show prompt instructions</span>
            </>
          )}
        </button>

        {showDetails && (
          <div className="mt-1.5 p-2 rounded-lg bg-black/30 border border-white/10 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
            {parsed.rawContent}
          </div>
        )}
      </div>
    </div>
  );
};
