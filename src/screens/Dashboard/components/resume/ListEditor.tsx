import { useState, useMemo } from "react";
import { useArtboardStore, ResumeSectionItem } from "../../../../store/artboard";
import { X, Plus, ChevronDown, Sparkles, RotateCcw } from "lucide-react";
import { Input } from "../../../../components/ui/input";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../components/ui/toast";

interface ListEditorProps {
  sectionId: string;
}

const RATING_OPTIONS = [
  { value: 0, label: "No Rating (Unrated)" },
  { value: 1, label: "1 - Novice (★)" },
  { value: 2, label: "2 - Competent (★★)" },
  { value: 3, label: "3 - Proficient (★★★)" },
  { value: 4, label: "4 - Advanced (★★★★)" },
  { value: 5, label: "5 - Expert (★★★★★)" },
];

export const ListEditor = ({ sectionId }: ListEditorProps) => {
  const section = useArtboardStore(
    (state) => state.resume.data.sections[sectionId],
  );
  const addSectionItem = useArtboardStore((state) => state.addSectionItem);
  const removeSectionItem = useArtboardStore(
    (state) => state.removeSectionItem,
  );
  const updateSectionItem = useArtboardStore(
    (state) => state.updateSectionItem,
  );

  const { success, info } = useToast();
  const [newItemName, setNewItemName] = useState("");
  const [newItemLevel, setNewItemLevel] = useState(0);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const isSkillsOrLanguages = sectionId === "skills" || sectionId === "languages";

  const hasAnyRatings = useMemo(() => {
    return (section?.items || []).some((item) => typeof item.level === "number" && item.level > 0);
  }, [section?.items]);

  if (!section) return null;

  const handleAddItem = () => {
    if (!newItemName.trim()) return;

    const newItem: ResumeSectionItem = {
      id: crypto.randomUUID(),
      hidden: false,
      name: newItemName.trim(),
      level: newItemLevel, // User-set by default (0 = unrated)
    };
    addSectionItem(sectionId, newItem);
    setNewItemName("");
    setNewItemLevel(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleAiSuggestRatings = () => {
    setIsSuggesting(true);
    try {
      const resumeData = useArtboardStore.getState().resume.data;
      const experienceItems = resumeData.sections?.experience?.items || [];
      const headline = resumeData.basics?.headline || "";
      const summaryContent = resumeData.summary?.content || "";

      // Combine text from experiences, headline, and summary to evaluate depth of skill
      const corpus = [
        headline,
        summaryContent,
        ...experienceItems.map((e) => `${e.position || ""} ${e.title || ""} ${e.description || ""}`),
      ]
        .join(" ")
        .toLowerCase();

      let appliedCount = 0;
      let preservedCount = 0;

      section.items.forEach((item) => {
        // Strict requirement: Stop AI from overriding user-set ratings!
        if (typeof item.level === "number" && item.level > 0) {
          preservedCount++;
          return;
        }

        const skillName = (item.name || "").trim().toLowerCase();
        if (!skillName) return;

        // Count occurrences and recency
        const regex = new RegExp(`\\b${skillName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
        const matches = corpus.match(regex)?.length || 0;

        // Headline / recent title match gives highest score
        const inHeadline = headline.toLowerCase().includes(skillName);
        const inRecentTitle = (experienceItems[0]?.position || experienceItems[0]?.title || "")
          .toLowerCase()
          .includes(skillName);

        let suggestedLevel = 3; // Proficient default
        if (inHeadline || (inRecentTitle && matches >= 3)) {
          suggestedLevel = 5; // Expert
        } else if (matches >= 4 || inRecentTitle) {
          suggestedLevel = 4; // Advanced
        } else if (matches <= 1) {
          suggestedLevel = 2; // Competent
        }

        updateSectionItem(sectionId, item.id, { level: suggestedLevel });
        appliedCount++;
      });

      if (appliedCount > 0) {
        success(
          "AI Ratings Suggested",
          preservedCount > 0
            ? `Suggested ratings for ${appliedCount} unrated skills. ${preservedCount} user-set rating${preservedCount > 1 ? "s were" : " was"} preserved.`
            : `Suggested ratings applied to ${appliedCount} skills. You can adjust or remove any rating.`,
        );
      } else if (preservedCount > 0) {
        info(
          "Ratings Preserved",
          "All skills already have user-set ratings. AI did not override them.",
        );
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleClearAllRatings = () => {
    section.items.forEach((item) => {
      if (typeof item.level === "number" && item.level > 0) {
        updateSectionItem(sectionId, item.id, { level: 0 });
      }
    });
    info("Ratings Cleared", "All skills are now unrated.");
  };

  return (
    <div className='space-y-4 animate-in slide-in-from-top-2 duration-200'>
      {isSkillsOrLanguages && (
        <div className='flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border/40'>
          <div className='text-xs text-muted-foreground'>
            Ratings are <span className='font-semibold text-foreground'>user-set</span> by default. Unrated skills render cleanly without dots or bars.
          </div>
          <div className='flex items-center gap-1.5'>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleAiSuggestRatings}
              disabled={isSuggesting}
              className='h-7 text-xs text-brand hover:text-brand hover:bg-brand/10 gap-1.5'
              title="Suggest ratings for unrated skills based on work history (preserves user ratings)"
            >
              <Sparkles className='w-3 h-3' />
              Suggest Ratings (AI)
            </Button>
            {hasAnyRatings && (
              <Button
                variant='ghost'
                size='sm'
                onClick={handleClearAllRatings}
                className='h-7 text-xs text-muted-foreground hover:text-foreground gap-1'
                title="Clear ratings from all items"
              >
                <RotateCcw className='w-3 h-3' />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      <div className='flex flex-wrap gap-2'>
        {section.items.map((item) => {
          const currentLevel = typeof item.level === "number" ? item.level : 0;
          return (
            <div
              key={item.id}
              className='product-section-card-muted group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:border-brand/60 hover:bg-brand/15'
            >
              <span>{item.name}</span>
              {isSkillsOrLanguages && (
                <div className='relative flex items-center'>
                  <select
                    className={`appearance-none bg-transparent pl-1 pr-4 py-0.5 text-xs outline-none cursor-pointer ${
                      currentLevel > 0
                        ? "text-brand font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    value={currentLevel}
                    onChange={(e) =>
                      updateSectionItem(sectionId, item.id, {
                        level: Number(e.target.value),
                      })
                    }
                    title="Skill Level (User-set)"
                  >
                    {RATING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className='bg-background text-foreground'>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className='absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none' />
                </div>
              )}
              <button
                onClick={() => removeSectionItem(sectionId, item.id)}
                className='p-0.5 rounded-full hover:bg-brand/20 hover:text-brand opacity-0 group-hover:opacity-100 transition-all ml-1'
                title="Remove item"
              >
                <X className='w-3 h-3' />
              </button>
            </div>
          );
        })}
      </div>

      <div className='flex flex-col gap-2 sm:flex-row'>
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${section.title.toLowerCase()}...`}
          className='flex-1'
        />
        {isSkillsOrLanguages && (
          <div className='relative flex items-center min-w-[150px]'>
            <select
              value={newItemLevel}
              onChange={(e) => setNewItemLevel(Number(e.target.value))}
              className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none pr-8'
              title="Initial Rating (User-set)"
            >
              {RATING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className='bg-background text-foreground'>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className='absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none' />
          </div>
        )}
        <Button
          onClick={handleAddItem}
          disabled={!newItemName.trim()}
          className='bg-brand text-black hover:bg-brand sm:w-auto'
        >
          <Plus className='w-4 h-4' />
        </Button>
      </div>
    </div>
  );
};
