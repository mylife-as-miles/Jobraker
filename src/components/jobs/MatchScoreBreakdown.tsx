import React from "react";
import { Card } from "../../components/ui/card";

export default function MatchScoreBreakdown({
  matched = [],
  missing = []
}: {
  matched?: string[];
  missing?: string[];
}) {
  if (!matched.length && !missing.length) return null;
  return (
    <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="text-white font-semibold mb-2">Matched skills</h4>
          <div className="flex flex-wrap gap-2">
            {matched.map((s, i) => (
              <span key={i} className="px-2 py-1 bg-[#1dff0020] text-[#1dff00] text-xs rounded border border-[#1dff00]/30">
                {s}
              </span>
            ))}
            {!matched.length && <span className="text-[#ffffff60]">None</span>}
          </div>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-2">Missing skills</h4>
          <div className="flex flex-wrap gap-2">
            {missing.map((s, i) => (
              <span key={i} className="px-2 py-1 bg-[#ffffff1a] text-white text-xs rounded border border-[#ffffff33]">
                {s}
              </span>
            ))}
            {!missing.length && <span className="text-[#ffffff60]">None</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}
