import React from "react";
import { ThinkingOrb, OrbState } from "thinking-orbs";
import { TokenStream } from "./TokenStream";

export const TypingIndicator: React.FC<{
  className?: string;
  state?: OrbState;
  text?: string;
}> = ({ className = "", state = "composing", text = "Tokens cascading in like a live model response..." }) => {
  return (
    <div className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-xl text-xs font-medium text-slate-200 backdrop-blur-xl ${className}`}>
      <ThinkingOrb state={state} size={20} theme="dark" />
      <TokenStream text={text} isStreaming={true} className="text-[#2fd968] font-mono text-[11px]" />
    </div>
  );
};
