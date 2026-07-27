import { useEffect, useState } from "react";
import { Sparkles, Brain, CheckCircle, AlertTriangle, Lightbulb, Target, RefreshCw, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import { Button } from "@/components/ui/button";

interface AIInsights {
  executiveSummary?: string;
  successFactors?: string[];
  failureDiagnostics?: string[];
  actionableTips?: string[];
  crmNextSteps?: string[];
  skillGapAnalysis?: string[];
}

export function AIAnalyticsIntelligenceCard() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAIInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invokeProtectedFunction<{
        success?: boolean;
        insights?: AIInsights;
        error?: string;
      }>("ai-analytics-insights");

      if (res.error) throw new Error(res.error);
      if (res.insights) setInsights(res.insights);
    } catch (err: any) {
      console.error("Failed to fetch AI insights:", err);
      setError(err.message || "Failed to generate AI analytics diagnosis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIInsights();
  }, []);

  return (
    <Card className='relative overflow-hidden border border-brand/30 bg-gradient-to-br from-background via-[#0b1410] to-background p-6 rounded-2xl shadow-xl shadow-brand/5'>
      {/* Decorative ambient background */}
      <div className='absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl pointer-events-none' />

      <div className='flex items-center justify-between mb-6 border-b border-brand/20 pb-4'>
        <div className='flex items-center gap-3'>
          <div className='p-2.5 rounded-xl bg-brand/20 text-brand border border-brand/40 shadow-inner'>
            <Brain className='w-6 h-6 animate-pulse' />
          </div>
          <div>
            <h3 className='text-xl font-bold text-foreground flex items-center gap-2'>
              Gemini AI Career Diagnostics & CRM Suite
              <span className='px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-full bg-brand/20 text-brand border border-brand/30'>
                Live AI Engine
              </span>
            </h3>
            <p className='text-xs text-foreground/60'>
              Automated root-cause rejection analysis, success drivers, ATS optimization & CRM coaching
            </p>
          </div>
        </div>

        <Button
          onClick={fetchAIInsights}
          disabled={loading}
          variant='outline'
          size='sm'
          className='border-brand/30 text-brand hover:bg-brand/10 gap-2 text-xs font-medium'
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing..." : "Refresh Insights"}
        </Button>
      </div>

      {loading ? (
        <div className='py-12 text-center space-y-3'>
          <RefreshCw className='w-8 h-8 text-brand animate-spin mx-auto' />
          <p className='text-sm text-foreground/70 font-medium'>
            Running Gemini AI Deep Career Diagnostics across your application history...
          </p>
        </div>
      ) : error ? (
        <div className='p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between'>
          <span>{error}</span>
          <Button onClick={fetchAIInsights} size='sm' variant='ghost' className='text-xs text-rose-300 underline'>
            Retry
          </Button>
        </div>
      ) : insights ? (
        <div className='space-y-6'>
          {/* Executive Summary */}
          {insights.executiveSummary && (
            <div className='p-4 rounded-xl bg-brand/10 border border-brand/25 text-sm text-foreground/90 leading-relaxed font-medium'>
              <span className='font-bold text-brand block mb-1'>Strategic Executive Assessment:</span>
              {insights.executiveSummary}
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {/* Success Drivers */}
            <div className='p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2'>
              <h4 className='text-sm font-semibold text-emerald-400 flex items-center gap-2'>
                <CheckCircle className='w-4 h-4 text-emerald-400' />
                Success Factors
              </h4>
              <ul className='space-y-1.5 text-xs text-foreground/80'>
                {insights.successFactors?.map((sf, i) => (
                  <li key={i} className='flex items-start gap-1.5'>
                    <span className='text-emerald-400 font-bold'>•</span>
                    <span>{sf}</span>
                  </li>
                )) || <li className='text-foreground/50 italic'>No specific success patterns yet.</li>}
              </ul>
            </div>

            {/* Failure & Rejection Diagnostics */}
            <div className='p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2'>
              <h4 className='text-sm font-semibold text-rose-400 flex items-center gap-2'>
                <AlertTriangle className='w-4 h-4 text-rose-400' />
                Rejection Diagnostics
              </h4>
              <ul className='space-y-1.5 text-xs text-foreground/80'>
                {insights.failureDiagnostics?.map((fd, i) => (
                  <li key={i} className='flex items-start gap-1.5'>
                    <span className='text-rose-400 font-bold'>•</span>
                    <span>{fd}</span>
                  </li>
                )) || <li className='text-foreground/50 italic'>No rejection bottlenecks detected.</li>}
              </ul>
            </div>

            {/* Actionable Resume & ATS Modification Tips */}
            <div className='p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2'>
              <h4 className='text-sm font-semibold text-amber-400 flex items-center gap-2'>
                <Lightbulb className='w-4 h-4 text-amber-400' />
                Modification Tips
              </h4>
              <ul className='space-y-1.5 text-xs text-foreground/80'>
                {insights.actionableTips?.map((tip, i) => (
                  <li key={i} className='flex items-start gap-1.5'>
                    <span className='text-amber-400 font-bold'>•</span>
                    <span>{tip}</span>
                  </li>
                )) || <li className='text-foreground/50 italic'>Keep applying to build tips.</li>}
              </ul>
            </div>

            {/* CRM Next Steps */}
            <div className='p-4 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-2'>
              <h4 className='text-sm font-semibold text-sky-400 flex items-center gap-2'>
                <Target className='w-4 h-4 text-sky-400' />
                CRM Action Steps
              </h4>
              <ul className='space-y-1.5 text-xs text-foreground/80'>
                {insights.crmNextSteps?.map((step, i) => (
                  <li key={i} className='flex items-start gap-1.5'>
                    <span className='text-sky-400 font-bold'>•</span>
                    <span>{step}</span>
                  </li>
                )) || <li className='text-foreground/50 italic'>No pending CRM actions.</li>}
              </ul>
            </div>

            {/* Skill Gap Analysis */}
            <div className='p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2 lg:col-span-2'>
              <h4 className='text-sm font-semibold text-purple-400 flex items-center gap-2'>
                <Layers className='w-4 h-4 text-purple-400' />
                Target Skill & Qualification Gaps
              </h4>
              <ul className='space-y-1.5 text-xs text-foreground/80'>
                {insights.skillGapAnalysis?.map((sg, i) => (
                  <li key={i} className='flex items-start gap-1.5'>
                    <span className='text-purple-400 font-bold'>•</span>
                    <span>{sg}</span>
                  </li>
                )) || <li className='text-foreground/50 italic'>No skill gaps detected.</li>}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
