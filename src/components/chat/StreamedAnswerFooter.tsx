import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

type StreamSource = { href: string; label: string; domain: string };

type StreamedAnswerFooterProps = {
  content: string;
  isStreaming: boolean;
  onRegenerate: () => void;
  onFollowUp: (prompt: string) => void;
};

const sourceFromUrl = (href: string, label?: string): StreamSource | null => {
  try {
    const url = new URL(href);
    if (!/^https?:$/.test(url.protocol)) return null;
    const domain = url.hostname.replace(/^www\./, "");
    return { href: url.href, label: label?.trim() || domain, domain };
  } catch {
    return null;
  }
};

const extractSources = (content: string): StreamSource[] => {
  const byHref = new Map<string, StreamSource>();
  const add = (href: string, label?: string) => {
    const source = sourceFromUrl(href, label);
    if (source && !byHref.has(source.href)) byHref.set(source.href, source);
  };

  for (const match of content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)[^)]*\)/g)) {
    add(match[2], match[1]);
  }
  for (const match of content.matchAll(/https?:\/\/[^\s<>)\]]+/g)) add(match[0]);

  return [...byHref.values()].slice(0, 8);
};

const followUpsFor = (content: string) => {
  const normalized = content.toLowerCase();
  if (normalized.includes("interview")) {
    return ["Help me prepare for the interview", "Create concise STAR answers for this role"];
  }
  if (normalized.includes("resume") || normalized.includes("cv")) {
    return ["Tailor my resume to this role", "Check my resume for ATS gaps"];
  }
  if (normalized.includes("application") || normalized.includes("apply")) {
    return ["Find similar roles for me", "Draft a follow-up for this application"];
  }
  return ["Turn this into a job-search plan", "Find roles that match my profile"];
};

export function StreamedAnswerFooter({
  content,
  isStreaming,
  onRegenerate,
  onFollowUp,
}: StreamedAnswerFooterProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sources = useMemo(() => extractSources(content), [content]);
  const followUps = useMemo(() => followUpsFor(content), [content]);
  const isError = /^\s*error:/i.test(content);

  if (!content.trim() || isError) return null;

  const copyAnswer = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="mt-3 border-t border-foreground/10 pt-2.5 transition-opacity duration-300"
      style={{ opacity: isStreaming ? 0.45 : 1, pointerEvents: isStreaming ? "none" : "auto" }}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => void copyAnswer()}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          aria-label="Copy answer"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          aria-label="Regenerate answer"
        >
          <RefreshCw size={14} />
          Regenerate
        </button>
        {sources.length > 0 && (
          <button
            type="button"
            onClick={() => setSourcesOpen((open) => !open)}
            aria-expanded={sourcesOpen}
            className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-md bg-brand/5 px-2 text-xs text-brand transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <Search size={13} />
            {sources.length} source{sources.length === 1 ? "" : "s"}
            <ChevronDown className={sourcesOpen ? "rotate-180 transition-transform" : "transition-transform"} size={13} />
          </button>
        )}
      </div>

      {sourcesOpen && sources.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-lg border border-foreground/10 bg-background/55" aria-label="Sources used in this answer">
          {sources.map((source) => (
            <li key={source.href} className="border-b border-foreground/[0.06] last:border-0">
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2.5 py-2 text-xs transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded bg-brand/10 text-brand">
                  <ExternalLink size={12} />
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{source.label}</span>
                <span className="max-w-[42%] truncate text-[11px] text-muted-foreground">{source.domain}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-3" aria-label="Suggested follow-up questions">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Continue exploring</p>
        <div className="mt-1.5 flex flex-col">
          {followUps.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onFollowUp(prompt)}
              className="-mx-1 flex items-center gap-2 rounded-md px-1 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              <ArrowUpRight aria-hidden className="shrink-0 text-brand" size={12} />
              {prompt}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
