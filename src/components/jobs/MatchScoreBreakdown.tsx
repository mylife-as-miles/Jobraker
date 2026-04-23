import React from "react";
import { Card } from "../../components/ui/card";

export default function MatchScoreBreakdown({
  matched = [],
  missing = [],
}: {
  matched?: string[];
  missing?: string[];
}) {
  if (!matched.length && !missing.length) return null;
  return (
    <Card className='bg-gradient-to-br from-foreground/5 via-foreground/5 to-foreground/5 border border-foreground/10 p-4'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
        <div>
          <h4 className='text-white font-semibold mb-2'>Matched skills</h4>
          <div className='flex flex-wrap gap-2'>
            {matched.map((s, i) => (
              <span
                key={i}
                className='px-2 py-1 bg-[#1dff0020] text-brand text-xs rounded border border-brand/30'
              >
                {s}
              </span>
            ))}
            {!matched.length && (
              <span className='text-foreground/40'>None</span>
            )}
          </div>
        </div>
        <div>
          <h4 className='text-white font-semibold mb-2'>Missing skills</h4>
          <div className='flex flex-wrap gap-2'>
            {missing.map((s, i) => (
              <span
                key={i}
                className='px-2 py-1 bg-foreground/10 text-white text-xs rounded border border-foreground/20'
              >
                {s}
              </span>
            ))}
            {!missing.length && (
              <span className='text-foreground/40'>None</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
