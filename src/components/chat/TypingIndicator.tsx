import React from "react";
import { ThinkingOrb, OrbState } from "thinking-orbs";

export const TypingIndicator: React.FC<{
  className?: string;
  state?: OrbState;
  text?: string;
}> = ({ className = "", state = "composing", text = "AI is thinking..." }) => {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 shadow-lg text-xs font-medium text-slate-200 backdrop-blur-md ${className}`}>
      <ThinkingOrb state={state} size={20} theme="dark" />
      <span className="text-brand-300 font-medium">{text}</span>
    </div>
  );
};
