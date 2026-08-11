import { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe2,
  Paperclip,
  Search,
  Sparkles,
} from "lucide-react";

export type ChatSourceLauncherSkill = {
  id: string;
  name: string;
  description: string;
};

type Props = {
  open: boolean;
  skills: ChatSourceLauncherSkill[];
  onClose: () => void;
  onUpload: () => void;
};

const DEFAULT_VISIBLE_ITEMS = 7;

export const ChatSourceLauncher = ({
  open,
  skills,
  onClose,
  onUpload,
}: Props) => {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!launcherRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchingSkills = useMemo(
    () =>
      skills.filter((skill) =>
        `${skill.name} ${skill.description}`.toLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery, skills],
  );
  const uploadMatches =
    !normalizedQuery ||
    "add photos files upload computer".includes(normalizedQuery);
  const visibleSkills = normalizedQuery
    ? matchingSkills
    : matchingSkills.slice(0, Math.max(0, DEFAULT_VISIBLE_ITEMS - Number(uploadMatches)));
  const hiddenCount = Math.max(0, skills.length + Number(uploadMatches) - DEFAULT_VISIBLE_ITEMS);

  if (!open) return null;

  return (
    <div
      ref={launcherRef}
      className="absolute inset-x-0 bottom-full z-[80] mb-3 overflow-hidden rounded-2xl border border-border bg-card/98 shadow-2xl shadow-black/50 backdrop-blur-xl sm:left-0 sm:right-auto sm:w-[32rem]"
      role="dialog"
      aria-label="Add a file or choose a JobRaker skill"
    >
      <div className="max-h-[min(28rem,calc(100svh-9rem))] overflow-y-auto p-2">
        {uploadMatches ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onUpload();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-muted-foreground">
              <Paperclip className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">Add photos &amp; files</span>
              <span className="block truncate text-xs text-muted-foreground">Upload from your computer</span>
            </span>
          </button>
        ) : null}

        {visibleSkills.length > 0 ? (
          <div className={uploadMatches ? "mt-1 border-t border-border/70 pt-1" : ""}>
            {visibleSkills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{skill.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{skill.description}</span>
                </span>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Skill</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-8 text-center">
            <Globe2 className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-foreground">No skills found</p>
            <p className="mt-1 text-xs text-muted-foreground">Try another search term.</p>
          </div>
        )}

        {!normalizedQuery && hiddenCount > 0 ? (
          <div className="px-3 pb-1 pt-2 text-xs text-muted-foreground">
            Search to find {hiddenCount} more skill{hiddenCount === 1 ? "" : "s"}.
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-2 border-t border-border/70 px-3 py-2.5 text-muted-foreground focus-within:text-foreground">
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Search skills and files</span>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search skills & files"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
    </div>
  );
};
