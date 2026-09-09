import { BriefcaseBusiness, ExternalLink, MapPin } from "lucide-react";
import type {
  ColdMailDiscoveryOutput,
  ColdMailTarget,
} from "@/lib/chatSkills/types";

type Props = {
  output: ColdMailDiscoveryOutput;
  disabled?: boolean;
  onSelect: (target: ColdMailTarget) => void;
};

export const ColdMailTargetSelectionCard = ({
  output,
  disabled = false,
  onSelect,
}: Props) => (
  <div className="mt-4 rounded-2xl border border-brand/20 bg-background/70 p-4">
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">
        Choose one company target
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {output.searchQuery} · {output.location}
      </p>
    </div>

    {output.targets.length ? (
      <div className="space-y-2">
        {output.targets.map((target) => (
          <div
            key={target.searchResultId || target.jobId}
            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/45 p-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0 text-brand" />
                <span className="truncate">{target.jobTitle}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {target.companyName}
                {target.location ? ` · ${target.location}` : ""}
                {target.source ? ` · ${target.source}` : ""}
              </p>
              <a
                href={target.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-brand hover:underline"
              >
                <span className="truncate">View job</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(target)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-brand/25 bg-brand px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MapPin className="h-3.5 w-3.5" />
              Select company
            </button>
          </div>
        ))}
      </div>
    ) : (
      <p className="rounded-xl border border-border/70 bg-card/45 p-3 text-xs text-muted-foreground">
        No new targets were found. Run Cold Mail again with a more specific role
        or location.
      </p>
    )}
  </div>
);
