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
      className="mt-5 max-w-xl overflow-hidden rounded-2xl border border-border bg-card/75 px-5 py-4 shadow-sm shadow-black/20"
    >
      <h3
        id={`recommendation-${recommendation.id}`}
        className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
      >
        Continue exploring
      </h3>
      <div className="divide-y divide-border/60">
        {recommendations.map((item) => {
          const accepted = acceptedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAcceptedId(item.id);
                onRunPrompt(item.actionPrompt);
              }}
              className="group flex w-full items-start gap-3 py-3 text-left transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {accepted ? (
                <Check className="size-3.5 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" />
              ) : (
                <ArrowUpRight className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground transition-colors group-hover:text-brand">
                {accepted ? "Queued for review" : item.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
