import React from "react";
import { Hand, Zap, Sparkles, RefreshCw } from "lucide-react";
import { ACTION_RECIPES, type ActionRecipe } from "@/lib/presets/actionRecipes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatPresetsBarProps {
  onSelectRecipe: (recipeId: string) => void;
  activeRecipeId?: string | null;
  className?: string;
}

export const ChatPresetsBar: React.FC<ChatPresetsBarProps> = ({
  onSelectRecipe,
  activeRecipeId,
  className = "",
}) => {
  const recipes = Object.values(ACTION_RECIPES);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open quick presets"
          title="Quick presets"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent transition-colors hover:border-brand/30 hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 sm:h-9 sm:w-9 ${
            activeRecipeId
              ? "border-brand/30 bg-brand/10 text-brand"
              : "text-muted-foreground"
          } ${className}`}
        >
          <Hand className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={8}
        className="z-[70] w-[min(20rem,calc(100vw-2rem))] bg-card/95 p-2"
        aria-label="Quick presets"
      >
        <div className="px-2 pb-2 pt-1">
          <p className="text-xs font-semibold text-foreground">Quick presets</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Start a guided action without writing a prompt.
          </p>
        </div>

        <div className="space-y-1">
        {recipes.map((recipe: ActionRecipe) => {
          const isActive = activeRecipeId === recipe.id;
          const isPrimary = recipe.id === "recruiter_cold_outreach";

          return (
            <DropdownMenuItem
              key={recipe.id}
              onSelect={() => onSelectRecipe(recipe.id)}
              className={`group flex cursor-pointer items-start gap-3 rounded-xl border px-2.5 py-2.5 ${
                isActive
                  ? "border-brand/40 bg-brand/10"
                  : isPrimary
                    ? "border-brand/20 bg-brand/5 focus:bg-brand/10"
                    : "border-transparent bg-transparent focus:border-border focus:bg-foreground/5"
              }`}
            >
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isPrimary ? "bg-amber-500/15" : "bg-foreground/5"
              }`}>
                {recipe.id === "recruiter_cold_outreach" ? (
                  <Zap className="h-4 w-4 fill-amber-400/20 text-amber-400" aria-hidden="true" />
                ) : recipe.id === "instant_job_pitch" ? (
                  <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-purple-400" aria-hidden="true" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold text-foreground group-focus:text-brand">
                    {recipe.title}
                  </span>
                  {recipe.badge && (
                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      isPrimary
                        ? "border-brand/30 bg-brand/15 text-brand"
                        : "border-border bg-muted text-muted-foreground"
                    }`}>
                      {recipe.badge}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                  {recipe.tagline}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
