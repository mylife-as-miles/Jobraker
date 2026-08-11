import { useMemo, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";

export type AgentRecommendation = {
  id: string;
  title: string;
  description: string;
  confidence: number;
  confidenceLabel: string;
  detail?: string;
  actionPrompt: string;
};

type Props = {
  recommendation: AgentRecommendation;
  alternatives?: AgentRecommendation[];
  onRunPrompt: (prompt: string) => void;
};

const confidenceTone = (confidence: number) =>
  confidence >= 75
    ? "bg-brand"
    : confidence >= 50
      ? "bg-amber-300"
      : "bg-rose-400";

const confidenceText = (confidence: number) =>
  confidence >= 75
    ? "text-brand"
    : confidence >= 50
      ? "text-amber-200"
      : "text-rose-300";

export const AgentRecommendationCard = ({
  recommendation,
  alternatives = [],
  onRunPrompt,
}: Props) => {
  const [acceptedId, setAcceptedId] = useState<string | null>(null);
  const recommendations = useMemo(
    () => [recommendation, ...alternatives],
    [alternatives, recommendation],
  );

  return (
    <section
      aria-labelledby={`recommendation-${recommendation.id}`}
      className="mt-5 max-w-xl"
    >
      <h3
        id={`recommendation-${recommendation.id}`}
        className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
      >
        Continue exploring
      </h3>
      <div className="space-y-1">
        {recommendations.map((item, index) => {
          const meterBars = Math.max(1, Math.min(4, Math.ceil(item.confidence / 25)));
          const accepted = acceptedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAcceptedId(item.id);
                onRunPrompt(item.actionPrompt);
              }}
              className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                index === 0
                  ? "bg-brand/10 text-brand hover:bg-brand/15"
                  : "text-foreground hover:bg-brand/[0.07]"
              }`}
            >
              {accepted ? (
                <Check className="size-3.5 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" />
              ) : (
                <ArrowUpRight className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {accepted ? "Queued for review" : item.title}
              </span>
              <span className="flex h-3 items-end gap-0.5" aria-label={`${item.confidence}% ${item.confidenceLabel}`}>
                {Array.from({ length: 4 }, (_, meterIndex) => (
                  <span
                    key={meterIndex}
                    className={`w-1 rounded-full ${meterIndex < meterBars ? confidenceTone(item.confidence) : "bg-border"}`}
                    style={{ height: `${5 + meterIndex * 2}px` }}
                  />
                ))}
              </span>
              <span className={`shrink-0 text-[11px] font-medium ${confidenceText(item.confidence)}`}>
                {item.confidence}%
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
