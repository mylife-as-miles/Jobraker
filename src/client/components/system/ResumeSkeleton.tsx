import React from 'react';

export const ResumeSkeleton: React.FC<{ label?: string }> = ({ label = 'Preparing builder…' }) => (
  <div className="h-screen w-screen bg-black grid place-items-center">
    <div className="animate-pulse rounded-2xl border border-[#1dff00]/30 ring-1 ring-[#1dff00]/20 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] p-6 shadow-xl shadow-[#1dff00]/10">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-[#1dff00]/40 border-t-[#1dff00] animate-spin" />
        <div>
          <p className="text-white font-medium text-sm">{label}</p>
          <p className="text-xs text-[#888]">Initializing default resume data</p>
        </div>
      </div>
    </div>
  </div>
);
