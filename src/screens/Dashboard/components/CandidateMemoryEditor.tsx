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
  return value
    .map((item) => {
      if (typeof item === "string") {
        return { name: item };
      }
      if (!item || typeof item !== "object") return null;
      return {
        name: item.name ?? "",
        careers_url: item.careers_url ?? "",
        source_hint: item.source_hint ?? "",
        domain: item.domain ?? "",
      } satisfies TrackedCompany;
    })
    .filter((item): item is TrackedCompany => Boolean(item?.name?.trim()));
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
    <Card className='product-section-card p-6 hover:border-brand/60 hover:shadow-lg transition-all duration-300'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div className='space-y-2'>
          <div className='inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-brand/80'>
            <BrainCircuit className='h-3.5 w-3.5' />
            Candidate Memory
          </div>
          <h3 className='text-lg font-semibold text-foreground'>
            Career ops context
          </h3>
          <p className='product-helper-text max-w-2xl'>
            These notes ground discovery, evaluations, and tailoring in your
            strongest proof points instead of generic resume text.
          </p>
        </div>
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[360px]'>
          <div className='rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-3'>
            <div className='text-[10px] uppercase tracking-wide text-foreground/40'>
              Narratives
            </div>
            <div className='mt-1 text-lg font-semibold text-foreground'>
              {splitLines(preferredNarrativesText).length}
            </div>
          </div>
          <div className='rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-3'>
            <div className='text-[10px] uppercase tracking-wide text-foreground/40'>
              Proof points
            </div>
            <div className='mt-1 text-lg font-semibold text-foreground'>
              {proofPointCount}
            </div>
          </div>
          <div className='rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-3'>
            <div className='text-[10px] uppercase tracking-wide text-foreground/40'>
              Story bank
            </div>
            <div className='mt-1 text-lg font-semibold text-foreground'>
              {storyCount}
            </div>
          </div>
          <div className='rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-3'>
            <div className='text-[10px] uppercase tracking-wide text-foreground/40'>
              Tracked companies
            </div>
            <div className='mt-1 text-lg font-semibold text-foreground'>
              {trackedCompanies.filter((item) => item.name.trim()).length}
            </div>
          </div>
        </div>
      </div>

      <div className='mt-6 grid gap-4 xl:grid-cols-3'>
        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <Sparkles className='h-4 w-4 text-brand' />
            Preferred narratives
          </div>
          <textarea
            value={preferredNarrativesText}
            onChange={(event) => setPreferredNarrativesText(event.target.value)}
            rows={8}
            className='product-input-surface min-h-[180px] w-full rounded-xl px-3 py-3 text-sm'
            placeholder='One narrative per line. Example: I thrive in customer-facing product roles where I can translate technical complexity into adoption.'
          />
        </div>

        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <Flag className='h-4 w-4 text-brand' />
            Red flags
          </div>
          <textarea
            value={redFlagsText}
            onChange={(event) => setRedFlagsText(event.target.value)}
            rows={8}
            className='product-input-surface min-h-[180px] w-full rounded-xl px-3 py-3 text-sm'
            placeholder='One red flag per line. Example: Recruiter asks for relocation despite a remote listing.'
          />
        </div>

        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <Briefcase className='h-4 w-4 text-brand' />
            Target archetypes
          </div>
          <textarea
            value={targetArchetypesText}
            onChange={(event) => setTargetArchetypesText(event.target.value)}
            rows={8}
            className='product-input-surface min-h-[180px] w-full rounded-xl px-3 py-3 text-sm'
            placeholder='One archetype per line. Example: Solutions engineer, forward deployed engineer, AI product operator.'
          />
        </div>
      </div>

      <div className='mt-6 grid gap-4 xl:grid-cols-2'>
        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='flex items-center justify-between gap-3'>
            <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
              <Bookmark className='h-4 w-4 text-brand' />
              Proof points
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='border-brand/30 text-brand hover:bg-brand/10'
              onClick={() =>
                setProofPoints((prev) => [
                  ...prev,
                  { title: "", evidence: "", metric: "", tags: [] },
                ])
              }
            >
              <Plus className='mr-2 h-4 w-4' />
              Add proof point
            </Button>
          </div>
          <div className='space-y-3'>
            {proofPoints.length === 0 ? (
              <div className='rounded-xl border border-dashed border-foreground/12 bg-foreground/[0.02] px-4 py-4 text-sm text-foreground/45'>
                Add quantified wins, customer outcomes, or delivery highlights
                you want future evaluations to reuse.
              </div>
            ) : null}
            {proofPoints.map((item, index) => (
              <div
                key={`proof-point-${index}`}
                className='rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-3'
              >
                <div className='grid gap-3 md:grid-cols-2'>
                  <input
                    value={item.title}
                    onChange={(event) =>
                      updateProofPoint(index, { title: event.target.value })
                    }
                    placeholder='Proof point title'
                    className='product-input-surface rounded-xl px-3 py-2 text-sm'
                  />
                  <input
                    value={item.metric ?? ""}
                    onChange={(event) =>
                      updateProofPoint(index, { metric: event.target.value })
                    }
                    placeholder='Metric or outcome'
                    className='product-input-surface rounded-xl px-3 py-2 text-sm'
                  />
                </div>
                <textarea
                  value={item.evidence}
                  onChange={(event) =>
                    updateProofPoint(index, { evidence: event.target.value })
                  }
                  rows={3}
                  placeholder='What happened, what you owned, and what changed?'
                  className='product-input-surface w-full rounded-xl px-3 py-3 text-sm'
                />
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
                  className='product-input-surface rounded-xl px-3 py-2 text-sm'
                />
                <div className='flex justify-end'>
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-brand hover:bg-brand/10 hover:text-brand'
                    onClick={() =>
                      setProofPoints((prev) =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
          <div className='flex items-center justify-between gap-3'>
            <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
              <Sparkles className='h-4 w-4 text-brand' />
              Interview story bank
            </div>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='border-brand/30 text-brand hover:bg-brand/10'
              onClick={() =>
                setStories((prev) => [
                  ...prev,
                  { title: "", situation: "", outcome: "", relevance: "" },
                ])
              }
            >
              <Plus className='mr-2 h-4 w-4' />
              Add story
            </Button>
          </div>
          <div className='space-y-3'>
            {stories.length === 0 ? (
              <div className='rounded-xl border border-dashed border-foreground/12 bg-foreground/[0.02] px-4 py-4 text-sm text-foreground/45'>
                Saved stories will feed future evaluations and tailoring
                suggestions automatically.
              </div>
            ) : null}
            {stories.map((item, index) => (
              <div
                key={`story-${index}`}
                className='rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-3'
              >
                <div className='grid gap-3 md:grid-cols-2'>
                  <input
                    value={item.title}
                    onChange={(event) =>
                      updateStory(index, { title: event.target.value })
                    }
                    placeholder='Story title'
                    className='product-input-surface rounded-xl px-3 py-2 text-sm'
                  />
                  <input
                    value={item.relevance ?? ""}
                    onChange={(event) =>
                      updateStory(index, { relevance: event.target.value })
                    }
                    placeholder='Why this story matters'
                    className='product-input-surface rounded-xl px-3 py-2 text-sm'
                  />
                </div>
                <textarea
                  value={item.situation}
                  onChange={(event) =>
                    updateStory(index, { situation: event.target.value })
                  }
                  rows={3}
                  placeholder='Situation / action summary'
                  className='product-input-surface w-full rounded-xl px-3 py-3 text-sm'
                />
                <input
                  value={item.outcome ?? ""}
                  onChange={(event) =>
                    updateStory(index, { outcome: event.target.value })
                  }
                  placeholder='Outcome or reflection'
                  className='product-input-surface rounded-xl px-3 py-2 text-sm'
                />
                <div className='flex justify-end'>
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-brand hover:bg-brand/10 hover:text-brand'
                    onClick={() =>
                      setStories((prev) =>
                        prev.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='mt-6 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-5 space-y-4'>
        <div className='flex items-center justify-between gap-3'>
          <div className='inline-flex items-center gap-2 text-sm font-medium text-foreground/80'>
            <Briefcase className='h-4 w-4 text-brand' />
            Tracked companies
          </div>
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='border-brand/30 text-brand hover:bg-brand/10'
            onClick={() =>
              setTrackedCompanies((prev) => [
                ...prev,
                { name: "", careers_url: "", source_hint: "", domain: "" },
              ])
            }
          >
            <Plus className='mr-2 h-4 w-4' />
            Add company
          </Button>
        </div>
        <div className='space-y-3'>
          {trackedCompanies.length === 0 ? (
            <div className='rounded-xl border border-dashed border-foreground/12 bg-foreground/[0.02] px-4 py-4 text-sm text-foreground/45'>
              Add companies you care about most so hybrid discovery can
              prioritize them first.
            </div>
          ) : null}
          {trackedCompanies.map((item, index) => (
            <div
              key={`tracked-company-${index}`}
              className='rounded-xl border border-foreground/10 bg-foreground/5 p-4 space-y-3'
            >
              <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <input
                  value={item.name}
                  onChange={(event) =>
                    updateTrackedCompany(index, { name: event.target.value })
                  }
                  placeholder='Company name'
                  className='product-input-surface rounded-xl px-3 py-2 text-sm'
                />
                <input
                  value={item.domain ?? ""}
                  onChange={(event) =>
                    updateTrackedCompany(index, { domain: event.target.value })
                  }
                  placeholder='Domain'
                  className='product-input-surface rounded-xl px-3 py-2 text-sm'
                />
                <input
                  value={item.careers_url ?? ""}
                  onChange={(event) =>
                    updateTrackedCompany(index, {
                      careers_url: event.target.value,
                    })
                  }
                  placeholder='Careers URL'
                  className='product-input-surface rounded-xl px-3 py-2 text-sm'
                />
                <input
                  value={item.source_hint ?? ""}
                  onChange={(event) =>
                    updateTrackedCompany(index, {
                      source_hint: event.target.value,
                    })
                  }
                  placeholder='ATS hint (Greenhouse, Lever...)'
                  className='product-input-surface rounded-xl px-3 py-2 text-sm'
                />
              </div>
              <div className='flex justify-end'>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='text-brand hover:bg-brand/10 hover:text-brand'
                  onClick={() =>
                    setTrackedCompanies((prev) =>
                      prev.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='product-helper-text'>
          Saved memory powers the evaluation layer, hybrid company discovery,
          and reusable interview prep.
        </p>
        <Button
          type='button'
          className='bg-brand text-black hover:bg-brand/90'
          onClick={() => void handleSave()}
          disabled={loading || saving}
        >
          <Save className='mr-2 h-4 w-4' />
          {saving ? "Saving memory..." : "Save candidate memory"}
        </Button>
      </div>
    </Card>
  );
}
