import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BrainCircuit,
  Briefcase,
  Flag,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import type { Profile } from "../../../hooks/useProfileSettings";

type ProofPoint = {
  title: string;
  evidence: string;
  metric?: string;
  tags?: string[];
};

type Story = {
  title: string;
  situation: string;
  outcome?: string;
  relevance?: string;
};

type TrackedCompany = {
  name: string;
  careers_url?: string;
  source_hint?: string;
  domain?: string;
};

interface CandidateMemoryEditorProps {
  profile: Profile | null;
  onSave: (patch: Partial<Profile>) => Promise<void>;
  loading?: boolean;
}

const splitLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeProofPoints = (value: Profile["proof_points"]): ProofPoint[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          title: "Proof point",
          evidence: item,
        };
      }
      if (!item || typeof item !== "object") return null;
      return {
        title: item.title ?? "",
        evidence: item.evidence ?? "",
        metric: item.metric ?? "",
        tags: Array.isArray(item.tags) ? item.tags : [],
      } satisfies ProofPoint;
    })
    .filter(Boolean) as ProofPoint[];
};

const normalizeStories = (value: Profile["story_bank"]): Story[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      return {
        title: item.title ?? "",
        situation: item.situation ?? "",
        outcome: item.outcome ?? "",
        relevance: item.relevance ?? "",
      } satisfies Story;
    })
    .filter(Boolean) as Story[];
};

const normalizeTrackedCompanies = (
  value: Profile["tracked_companies"],
): TrackedCompany[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): TrackedCompany[] => {
      const company: TrackedCompany = typeof item === "string"
        ? { name: item }
        : {
        name: item.name ?? "",
        careers_url: item.careers_url ?? "",
        source_hint: item.source_hint ?? "",
        domain: item.domain ?? "",
      };
      return company.name.trim() ? [company] : [];
    });
};

const sanitizeProofPoints = (items: ProofPoint[]): Profile["proof_points"] =>
  items
    .map((item) => ({
      title: item.title.trim(),
      evidence: item.evidence.trim(),
      metric: item.metric?.trim() || undefined,
      tags: splitLines((item.tags || []).join("\n")),
    }))
    .filter((item) => item.title && item.evidence);

const sanitizeStories = (items: Story[]): Profile["story_bank"] =>
  items
    .map((item) => ({
      title: item.title.trim(),
      situation: item.situation.trim(),
      outcome: item.outcome?.trim() || undefined,
      relevance: item.relevance?.trim() || undefined,
    }))
    .filter((item) => item.title && item.situation);

const sanitizeTrackedCompanies = (
  items: TrackedCompany[],
): Profile["tracked_companies"] =>
  items
    .map((item) => ({
      name: item.name.trim(),
      careers_url: item.careers_url?.trim() || undefined,
      source_hint: item.source_hint?.trim() || undefined,
      domain: item.domain?.trim() || undefined,
    }))
    .filter((item) => item.name);

export function CandidateMemoryEditor({
  profile,
  onSave,
  loading = false,
}: CandidateMemoryEditorProps) {
  const [preferredNarrativesText, setPreferredNarrativesText] = useState("");
  const [redFlagsText, setRedFlagsText] = useState("");
  const [targetArchetypesText, setTargetArchetypesText] = useState("");
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [trackedCompanies, setTrackedCompanies] = useState<TrackedCompany[]>(
    [],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPreferredNarrativesText(
      (profile?.preferred_narratives || []).join("\n"),
    );
    setRedFlagsText((profile?.red_flags || []).join("\n"));
    setTargetArchetypesText((profile?.target_archetypes || []).join("\n"));
    setProofPoints(normalizeProofPoints(profile?.proof_points));
    setStories(normalizeStories(profile?.story_bank));
    setTrackedCompanies(normalizeTrackedCompanies(profile?.tracked_companies));
  }, [profile]);

  const proofPointCount = useMemo(
    () =>
      proofPoints.filter((item) => item.title.trim() && item.evidence.trim())
        .length,
    [proofPoints],
  );
  const storyCount = useMemo(
    () =>
      stories.filter((item) => item.title.trim() && item.situation.trim())
        .length,
    [stories],
  );

  const updateProofPoint = (index: number, patch: Partial<ProofPoint>) => {
    setProofPoints((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateStory = (index: number, patch: Partial<Story>) => {
    setStories((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateTrackedCompany = (
    index: number,
    patch: Partial<TrackedCompany>,
  ) => {
    setTrackedCompanies((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        preferred_narratives: splitLines(preferredNarrativesText),
        red_flags: splitLines(redFlagsText),
        target_archetypes: splitLines(targetArchetypesText),
        proof_points: sanitizeProofPoints(proofPoints),
        story_bank: sanitizeStories(stories),
        tracked_companies: sanitizeTrackedCompanies(trackedCompanies),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='relative rounded-3xl border border-brand/35 bg-[#050505] p-6 sm:p-8 shadow-2xl shadow-brand/10 transition-all duration-300 space-y-6'>
      {/* Ambient Green Corner Glow */}
      <div className='absolute -top-12 -right-12 h-48 w-48 bg-brand/10 rounded-full blur-3xl pointer-events-none' />

      {/* Header & Stat Cards */}
      <div className='flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between relative z-10'>
        <div className='space-y-2 max-w-2xl'>
          <div className='inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-[0.25em] text-brand'>
            <BrainCircuit className='h-4 w-4' />
            CANDIDATE MEMORY
          </div>
          <h2 className='text-2xl sm:text-3xl font-bold text-foreground tracking-tight'>
            Career ops context
          </h2>
          <p className='text-sm text-muted-foreground leading-relaxed'>
            These notes ground discovery, evaluations, and tailoring in your
            strongest proof points instead of generic resume text.
          </p>
        </div>

        {/* 4 Stat Badges matching screenshot */}
        <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:min-w-[420px] shrink-0'>
          <div className='rounded-2xl border border-border/50 bg-[#0d0d0d] px-4 py-3 text-center shadow-inner'>
            <div className='text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground'>
              NARRATIVES
            </div>
            <div className='mt-1 text-xl font-extrabold text-foreground'>
              {splitLines(preferredNarrativesText).length}
            </div>
          </div>
          <div className='rounded-2xl border border-border/50 bg-[#0d0d0d] px-4 py-3 text-center shadow-inner'>
            <div className='text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground'>
              PROOF POINTS
            </div>
            <div className='mt-1 text-xl font-extrabold text-foreground'>
              {proofPointCount}
            </div>
          </div>
          <div className='rounded-2xl border border-border/50 bg-[#0d0d0d] px-4 py-3 text-center shadow-inner'>
            <div className='text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground'>
              STORY BANK
            </div>
            <div className='mt-1 text-xl font-extrabold text-foreground'>
              {storyCount}
            </div>
          </div>
          <div className='rounded-2xl border border-border/50 bg-[#0d0d0d] px-4 py-3 text-center shadow-inner'>
            <div className='text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground'>
              TRACKED COMPANIES
            </div>
            <div className='mt-1 text-xl font-extrabold text-foreground'>
              {trackedCompanies.filter((item) => item.name.trim()).length}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Text Card Grid: Preferred Narratives, Red Flags, Target Archetypes */}
      <div className='grid gap-5 xl:grid-cols-3 relative z-10'>
        <div className='rounded-2xl border border-border/60 bg-[#0a0a0a] p-5 space-y-3.5 hover:border-brand/30 transition-all'>
          <div className='inline-flex items-center gap-2 text-sm font-semibold text-foreground'>
            <Sparkles className='h-4 w-4 text-brand' />
            Preferred narratives
          </div>
          <textarea
            value={preferredNarrativesText}
            onChange={(event) => setPreferredNarrativesText(event.target.value)}
            rows={7}
            className='w-full min-h-[170px] rounded-xl border border-border/40 bg-[#000000] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 focus:ring-1 focus:ring-brand/30 outline-none transition-all resize-y'
            placeholder='One narrative per line. Example: I thrive in customer-facing product roles where I can translate technical complexity into adoption.'
          />
        </div>

        <div className='rounded-2xl border border-border/60 bg-[#0a0a0a] p-5 space-y-3.5 hover:border-brand/30 transition-all'>
          <div className='inline-flex items-center gap-2 text-sm font-semibold text-foreground'>
            <Flag className='h-4 w-4 text-brand' />
            Red flags
          </div>
          <textarea
            value={redFlagsText}
            onChange={(event) => setRedFlagsText(event.target.value)}
            rows={7}
            className='w-full min-h-[170px] rounded-xl border border-border/40 bg-[#000000] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 focus:ring-1 focus:ring-brand/30 outline-none transition-all resize-y'
            placeholder='One red flag per line. Example: Recruiter asks for relocation despite a remote listing.'
          />
        </div>

        <div className='rounded-2xl border border-border/60 bg-[#0a0a0a] p-5 space-y-3.5 hover:border-brand/30 transition-all'>
          <div className='inline-flex items-center gap-2 text-sm font-semibold text-foreground'>
            <Briefcase className='h-4 w-4 text-brand' />
            Target archetypes
          </div>
          <textarea
            value={targetArchetypesText}
            onChange={(event) => setTargetArchetypesText(event.target.value)}
            rows={7}
            className='w-full min-h-[170px] rounded-xl border border-border/40 bg-[#000000] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 focus:ring-1 focus:ring-brand/30 outline-none transition-all resize-y'
            placeholder='One archetype per line. Example: Solutions engineer, forward deployed engineer, AI product operator.'
          />
        </div>
      </div>

      {/* 2-Column Grid: Proof Points & Interview Story Bank */}
      <div className='grid gap-5 xl:grid-cols-2 relative z-10'>
        {/* Proof Points */}
        <div className='rounded-2xl border border-border/60 bg-[#0a0a0a] p-5 space-y-4 hover:border-brand/30 transition-all'>
          <div className='flex items-center justify-between gap-3'>
            <div className='inline-flex items-center gap-2 text-sm font-semibold text-foreground'>
              <Bookmark className='h-4 w-4 text-brand' />
              Proof points
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='border-brand/40 bg-brand/5 text-brand hover:bg-brand/15 hover:border-brand/60 rounded-xl text-xs font-semibold'
              onClick={() =>
                setProofPoints((prev) => [
                  ...prev,
                  { title: "", evidence: "", metric: "", tags: [] },
                ])
              }
            >
              <Plus className='mr-1.5 h-3.5 w-3.5' />
              Add proof point
            </Button>
          </div>

          <div className='space-y-3'>
            {proofPoints.length === 0 ? (
              <div className='rounded-xl border border-dashed border-border/40 bg-[#000000]/60 p-4 text-center text-sm text-muted-foreground/70'>
                Add quantified wins, customer outcomes, or delivery highlights
                you want future evaluations to reuse.
              </div>
            ) : null}
            {proofPoints.map((item, index) => (
              <div
                key={`proof-point-${index}`}
                className='rounded-xl border border-border/50 bg-[#000000] p-4 space-y-3 shadow-inner'
              >
                <div className='grid gap-3 md:grid-cols-2'>
                  <input
                    value={item.title}
                    onChange={(event) =>
                      updateProofPoint(index, { title: event.target.value })
                    }
                    placeholder='Proof point title'
                    className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                  />
                  <input
                    value={item.metric ?? ""}
                    onChange={(event) =>
                      updateProofPoint(index, { metric: event.target.value })
                    }
                    placeholder='Metric or outcome'
                    className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                  />
                </div>
                <textarea
                  value={item.evidence}
                  onChange={(event) =>
                    updateProofPoint(index, { evidence: event.target.value })
                  }
                  rows={3}
                  placeholder='What happened, what you owned, and what changed?'
                  className='w-full rounded-xl border border-border/40 bg-[#0a0a0a] p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                />
                <div className='flex items-center justify-between gap-3'>
                  <input
                    value={(item.tags || []).join(", ")}
                    onChange={(event) =>
                      updateProofPoint(index, {
                        tags: event.target.value
                          .split(",")
                          .map((entry) => entry.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder='Tags, comma separated'
                    className='flex-1 rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                  />
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 h-8 px-2.5 text-xs'
                    onClick={() =>
                      setProofPoints((prev) =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className='mr-1.5 h-3.5 w-3.5' />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interview Story Bank */}
        <div className='rounded-2xl border border-border/60 bg-[#0a0a0a] p-5 space-y-4 hover:border-brand/30 transition-all'>
          <div className='flex items-center justify-between gap-3'>
            <div className='inline-flex items-center gap-2 text-sm font-semibold text-foreground'>
              <Sparkles className='h-4 w-4 text-brand' />
              Interview story bank
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='border-brand/40 bg-brand/5 text-brand hover:bg-brand/15 hover:border-brand/60 rounded-xl text-xs font-semibold'
              onClick={() =>
                setStories((prev) => [
                  ...prev,
                  { title: "", situation: "", outcome: "", relevance: "" },
                ])
              }
            >
              <Plus className='mr-1.5 h-3.5 w-3.5' />
              Add story
            </Button>
          </div>

          <div className='space-y-3'>
            {stories.length === 0 ? (
              <div className='rounded-xl border border-dashed border-border/40 bg-[#000000]/60 p-4 text-center text-sm text-muted-foreground/70'>
                Saved stories will feed future evaluations and tailoring
                suggestions automatically.
              </div>
            ) : null}
            {stories.map((item, index) => (
              <div
                key={`story-${index}`}
                className='rounded-xl border border-border/50 bg-[#000000] p-4 space-y-3 shadow-inner'
              >
                <div className='grid gap-3 md:grid-cols-2'>
                  <input
                    value={item.title}
                    onChange={(event) =>
                      updateStory(index, { title: event.target.value })
                    }
                    placeholder='Story title'
                    className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                  />
                  <input
                    value={item.relevance ?? ""}
                    onChange={(event) =>
                      updateStory(index, { relevance: event.target.value })
                    }
                    placeholder='Why this story matters'
                    className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                  />
                </div>
                <textarea
                  value={item.situation}
                  onChange={(event) =>
                    updateStory(index, { situation: event.target.value })
                  }
                  rows={3}
                  placeholder='Situation / action summary'
                  className='w-full rounded-xl border border-border/40 bg-[#0a0a0a] p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                />
                <div className='flex items-center justify-between gap-3'>
                  <input
                    value={item.outcome ?? ""}
                    onChange={(event) =>
                      updateStory(index, { outcome: event.target.value })
                    }
                    placeholder='Outcome or reflection'
                    className='flex-1 rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                  />
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 h-8 px-2.5 text-xs'
                    onClick={() =>
                      setStories((prev) =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className='mr-1.5 h-3.5 w-3.5' />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tracked Companies Section */}
      <div className='rounded-2xl border border-border/60 bg-[#0a0a0a] p-5 space-y-4 relative z-10 hover:border-brand/30 transition-all'>
        <div className='flex items-center justify-between gap-3'>
          <div className='inline-flex items-center gap-2 text-sm font-semibold text-foreground'>
            <Briefcase className='h-4 w-4 text-brand' />
            Tracked companies
          </div>
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='border-brand/40 bg-brand/5 text-brand hover:bg-brand/15 hover:border-brand/60 rounded-xl text-xs font-semibold'
            onClick={() =>
              setTrackedCompanies((prev) => [
                ...prev,
                { name: "", careers_url: "", source_hint: "", domain: "" },
              ])
            }
          >
            <Plus className='mr-1.5 h-3.5 w-3.5' />
            Add company
          </Button>
        </div>

        <div className='space-y-3'>
          {trackedCompanies.length === 0 ? (
            <div className='rounded-xl border border-dashed border-border/40 bg-[#000000]/60 p-4 text-center text-sm text-muted-foreground/70'>
              Add companies you care about most so hybrid discovery can
              prioritize them first.
            </div>
          ) : null}
          {trackedCompanies.map((item, index) => (
            <div
              key={`tracked-company-${index}`}
              className='rounded-xl border border-border/50 bg-[#000000] p-4 space-y-3 shadow-inner'
            >
              <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <input
                  value={item.name}
                  onChange={(event) =>
                    updateTrackedCompany(index, { name: event.target.value })
                  }
                  placeholder='Company name'
                  className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                />
                <input
                  value={item.domain ?? ""}
                  onChange={(event) =>
                    updateTrackedCompany(index, { domain: event.target.value })
                  }
                  placeholder='Domain'
                  className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                />
                <input
                  value={item.careers_url ?? ""}
                  onChange={(event) =>
                    updateTrackedCompany(index, {
                      careers_url: event.target.value,
                    })
                  }
                  placeholder='Careers URL'
                  className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                />
                <input
                  value={item.source_hint ?? ""}
                  onChange={(event) =>
                    updateTrackedCompany(index, {
                      source_hint: event.target.value,
                    })
                  }
                  placeholder='ATS hint (Greenhouse, Lever...)'
                  className='rounded-xl border border-border/40 bg-[#0a0a0a] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-brand/60 outline-none'
                />
              </div>
              <div className='flex justify-end'>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 h-8 px-2.5 text-xs'
                  onClick={() =>
                    setTrackedCompanies((prev) =>
                      prev.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className='mr-1.5 h-3.5 w-3.5' />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Action Footer */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-border/40 relative z-10'>
        <p className='text-xs text-muted-foreground'>
          Saved memory powers the evaluation layer, hybrid company discovery,
          and reusable interview prep.
        </p>
        <Button
          type='button'
          className='bg-brand text-black font-semibold hover:bg-brand/90 px-6 py-2.5 rounded-xl shadow-lg shadow-brand/20 transition-all disabled:opacity-50'
          onClick={() => void handleSave()}
          disabled={loading || saving}
        >
          <Save className='mr-2 h-4 w-4' />
          {saving ? "Saving memory..." : "Save candidate memory"}
        </Button>
      </div>
    </div>
  );
}
