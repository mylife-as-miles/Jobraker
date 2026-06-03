import { useState, useMemo } from "react";
import {
  Database,
  Plus,
  Trash2,
  Edit2,
  Tag,
  BookOpen,
  Brain,
  Volume2,
  Briefcase,
  Layers,
  HelpCircle,
  FolderOpen,
  Info,
  Sparkles,
} from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import Modal from "../../../components/ui/modal";
import { useAnswerBank, AnswerBankEntry, AnswerTheme } from "../../../hooks/useAnswerBank";

const THEME_CONFIGS: Record<
  AnswerTheme,
  { label: string; icon: React.ReactNode; desc: string; placeholder: string }
> = {
  identity: {
    label: "Identity",
    icon: <Info className="h-4 w-4" />,
    desc: "Hard facts: contact info, work authorization, relocation preferences, demographic details.",
    placeholder: "e.g., Legal Name: John Doe\nLocation: San Francisco, CA\nWork Authorization: Authorized to work in the US without sponsorship.",
  },
  beliefs: {
    label: "Beliefs",
    icon: <Brain className="h-4 w-4" />,
    desc: "Core philosophies: how you work, what values you prioritize, what great engineering culture looks like.",
    placeholder: "e.g., I believe in product-driven engineering where developer feedback loops are short and engineers talk to customers directly...",
  },
  stories: {
    label: "Stories",
    icon: <BookOpen className="h-4 w-4" />,
    desc: "Anecdotes (Situation-Action-Outcome): project deliveries, conflicts resolved, technical scaling feats.",
    placeholder: "Situation: Our payments system was bottlenecked at 50 requests/sec.\nAction: I refactored the database connection pooling and introduced Redis cache.\nOutcome: Throughput increased by 4x to 200 requests/sec with zero downtime.",
  },
  career: {
    label: "Career",
    icon: <Briefcase className="h-4 w-4" />,
    desc: "Role history: why you joined/left past companies, what you want next, roles/environments you target.",
    placeholder: "e.g., Next Step: I want to join an early-stage team building devtools or AI infrastructure where I can wear multiple hats...",
  },
  skills: {
    label: "Skills",
    icon: <Layers className="h-4 w-4" />,
    desc: "Technical competencies: your core stack, tools you reach for daily, speaking engagements, OSS work.",
    placeholder: "e.g., Primary Stack: TypeScript, React, Next.js, Node.js, PostgreSQL\nFamiliar with: Python, FastAPI, Docker, GCP, Terraform",
  },
  voice: {
    label: "Voice",
    icon: <Volume2 className="h-4 w-4" />,
    desc: "Tone samples: examples of your writing style so the AI drafts essays mimicking your natural voice.",
    placeholder: "e.g., I write with a concise, direct, and slightly informal tone. I prefer active verbs, short sentences, and avoiding corporate buzzwords.",
  },
};

export function AnswerBankPanel() {
  const {
    answers,
    addAnswer,
    updateAnswer,
    deleteAnswer,
    generateAnswers,
  } = useAnswerBank();

  const [activeTheme, setActiveTheme] = useState<AnswerTheme>("identity");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AnswerBankEntry | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form states
  const [formTheme, setFormTheme] = useState<AnswerTheme>("identity");
  const [formSlug, setFormSlug] = useState("");
  const [formQuestion, setFormQuestion] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formBody, setFormBody] = useState("");

  const filteredEntries = useMemo(() => {
    return answers.data.filter((entry) => entry.theme === activeTheme);
  }, [answers.data, activeTheme]);

  const countsByTheme = useMemo(() => {
    const counts: Record<AnswerTheme, number> = {
      identity: 0,
      beliefs: 0,
      stories: 0,
      career: 0,
      skills: 0,
      voice: 0,
    };
    answers.data.forEach((entry) => {
      if (entry.theme in counts) {
        counts[entry.theme]++;
      }
    });
    return counts;
  }, [answers.data]);

  const openAddModal = () => {
    setEditingEntry(null);
    setFormTheme(activeTheme);
    setFormSlug("");
    setFormQuestion("");
    setFormTags("");
    setFormBody("");
    setModalOpen(true);
  };

  const openEditModal = (entry: AnswerBankEntry) => {
    setEditingEntry(entry);
    setFormTheme(entry.theme);
    setFormSlug(entry.slug);
    setFormQuestion(entry.question);
    setFormTags((entry.tags || []).join(", "));
    setFormBody(entry.body || "");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formSlug.trim() || !formQuestion.trim() || !formBody.trim()) {
      return;
    }

    const payload = {
      theme: formTheme,
      slug: formSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-"),
      question: formQuestion.trim(),
      body: formBody.trim(),
      tags: formTags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    };

    if (editingEntry) {
      await updateAnswer(editingEntry.id, payload);
    } else {
      await addAnswer(payload);
    }

    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (!editingEntry) return;
    if (confirm("Are you sure you want to delete this Answer Bank entry? This cannot be undone.")) {
      await deleteAnswer(editingEntry.id);
      setModalOpen(false);
    }
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      await generateAnswers();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="product-section-card p-4 sm:p-6 hover:border-brand/30 hover:shadow-lg transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between border-b border-foreground/10 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-brand/80 font-medium">
            <Database className="h-3.5 w-3.5" />
            Answer Bank Library
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Personal Knowledge Repository
          </h3>
          <p className="product-helper-text max-w-2xl text-sm">
            Configure reusable snippets, beliefs, and project experiences. Future auto-apply runs will pull from these records to dynamically generate finished application answers in your own voice.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="border-brand/25 text-brand hover:bg-brand/10 font-medium rounded-xl inline-flex items-center gap-2"
          >
            <Sparkles className={`h-4 w-4 ${isGenerating ? "animate-pulse" : ""}`} />
            {isGenerating ? "Generating..." : "Generate from profile"}
          </Button>
          <Button
            type="button"
            onClick={openAddModal}
            className="bg-brand text-black hover:bg-brand/90 font-medium rounded-xl inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Theme selector Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-foreground/10 pb-4">
        {(Object.keys(THEME_CONFIGS) as AnswerTheme[]).map((theme) => {
          const cfg = THEME_CONFIGS[theme];
          const isActive = theme === activeTheme;
          return (
            <button
              key={theme}
              onClick={() => setActiveTheme(theme)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-brand/10 text-brand border border-brand/20 shadow-sm"
                  : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/80 border border-transparent"
              }`}
            >
              {cfg.icon}
              {cfg.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-brand/20 text-brand' : 'bg-foreground/5 text-foreground/50'}`}>
                {countsByTheme[theme]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Theme Info Panel */}
      <div className="mt-4 bg-foreground/[0.02] border border-foreground/5 rounded-xl p-4 flex gap-3 items-start text-xs text-foreground/60">
        <Info className="h-4 w-4 text-brand/80 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-foreground/80 block mb-0.5">
            {THEME_CONFIGS[activeTheme].label} Category
          </span>
          {THEME_CONFIGS[activeTheme].desc}
        </div>
      </div>

      {/* Grid of cards */}
      <div className="mt-6">
        {answers.loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-foreground/50 gap-3">
            <div className="h-6 w-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Loading entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="border border-dashed border-foreground/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center bg-foreground/[0.01]">
            <FolderOpen className="h-10 w-10 text-foreground/30 mb-3" />
            <h4 className="text-sm font-medium text-foreground mb-1">
              No entries in {THEME_CONFIGS[activeTheme].label}
            </h4>
            <p className="text-xs text-foreground/45 max-w-sm mb-4">
              Add your first reusable {THEME_CONFIGS[activeTheme].label.toLowerCase()} text snippet or story to build your automation context.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={openAddModal}
              className="border-brand/30 text-brand hover:bg-brand/10"
            >
              Add first entry
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => openEditModal(entry)}
                className="group relative cursor-pointer border border-foreground/10 hover:border-brand/40 bg-card rounded-xl p-4 sm:p-5 transition-all duration-200 hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors line-clamp-1">
                      {entry.question}
                    </h4>
                    <span className="text-[10px] text-foreground/35 font-mono select-all">
                      {entry.slug}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-foreground/55 line-clamp-3 leading-relaxed whitespace-pre-line">
                    {entry.body}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-foreground/5 flex flex-wrap gap-1.5 items-center">
                  <Tag className="h-3 w-3 text-foreground/35" />
                  {(entry.tags || []).length > 0 ? (
                    (entry.tags || []).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 bg-foreground/5 border border-foreground/5 text-foreground/60 rounded-md font-medium"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-foreground/35 italic">
                      no tags
                    </span>
                  )}
                  <button
                    type="button"
                    className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-foreground/40 hover:text-brand"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(entry);
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Editor / Creator */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEntry ? "Edit Answer Entry" : "Create Answer Entry"}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Theme Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/75">
                Category / Theme
              </label>
              <select
                value={formTheme}
                onChange={(e) => setFormTheme(e.target.value as AnswerTheme)}
                className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand/40"
              >
                {(Object.keys(THEME_CONFIGS) as AnswerTheme[]).map((theme) => (
                  <option key={theme} value={theme} className="bg-card">
                    {THEME_CONFIGS[theme].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Slug input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/75">
                Unique Slug (kebab-case)
              </label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="e.g. visa-status"
                disabled={!!editingEntry}
                required
                className="w-full bg-foreground/[0.04] disabled:opacity-50 border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand/40"
              />
            </div>
          </div>

          {/* Question / Title input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/75">
              Question or short title
            </label>
            <input
              type="text"
              value={formQuestion}
              onChange={(e) => setFormQuestion(e.target.value)}
              placeholder="e.g. What are your sponsorship requirements?"
              required
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand/40"
            />
          </div>

          {/* Tags input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/75 flex items-center gap-1">
              Tags <span className="text-[10px] text-foreground/45">(comma separated)</span>
            </label>
            <input
              type="text"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              placeholder="e.g. sponsorship, visa, legal"
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand/40"
            />
          </div>

          {/* Markdown Content / Body input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/75">
              Entry content / Body
            </label>
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              rows={8}
              required
              placeholder={THEME_CONFIGS[formTheme].placeholder}
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:border-brand/40 font-sans min-h-[160px] whitespace-pre-wrap"
            />
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between border-t border-foreground/10 pt-4 mt-6">
            <div>
              {editingEntry && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-500/20 rounded-xl px-4 py-2 font-medium"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-foreground/10 text-foreground/70 hover:bg-foreground/[0.05] rounded-xl px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-brand text-black hover:bg-brand/90 rounded-xl px-5 py-2 font-medium"
              >
                {editingEntry ? "Save Changes" : "Create Entry"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
